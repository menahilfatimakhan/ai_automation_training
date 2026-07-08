import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { isClientViewer } from "@/lib/access";
import { resolveClientScope } from "@/lib/data/client-scope";
import { loadCalls, loadClientTimezone, loadMembersByRole } from "@/lib/data/dashboards";
import { loadNotifications } from "@/lib/data/notifications";
import { todayIsoInTz } from "@/lib/format";
import { resolveRange, isRangeKey, type RangeKey } from "@/lib/range";
import { bucketOf, type OutcomeBucket } from "@/domain/metrics";
import { LogCallForm } from "@/components/LogCallForm";
import { OutcomePie, Funnel, HBarChart, RevenueTrendChart } from "@/components/charts";
import { ClientSwitcher } from "@/components/ClientSwitcher";
import { RangeSelector } from "@/components/RangeSelector";
import { AiPanel } from "@/components/AiPanel";
import { TodaysCallRow } from "@/components/TodaysCallRow";

const BUCKET_LABEL: Record<OutcomeBucket, string> = {
  closed: "Closed",
  showed_not_closed: "Showed, didn't close",
  no_show: "No-show",
  rescheduled: "Rescheduled",
};

export default async function SalesDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; range?: string }>;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  const sp = await searchParams;
  const { active, options } = await resolveClientScope(ctx, sp.client);
  if (!active) return <p className="text-ink-soft">No client available.</p>;

  const range: RangeKey = isRangeKey(sp.range) ? sp.range : "mtd";
  const { from, to, label: rangeLabel } = resolveRange(range);
  // "Today" for the first-call gate/date default must match the closer's own
  // calendar day, not a UTC cutoff that drifts around midnight UTC.
  const timezone = await loadClientTimezone(active.id);
  const today = todayIsoInTz(timezone);
  const mtdCalls = await loadCalls(active.id, from, to);
  const todaysCalls = mtdCalls.filter((c) => c.date === today);
  const notifications = await loadNotifications(active.id);
  const closers = await loadMembersByRole(active.id, "closer");
  const closerNameById = new Map(closers.map((c) => [c.id, c.fullName ?? "Unknown"]));
  const readOnly = !ctx.isAdmin && isClientViewer(ctx, active.id);

  // First-call gate: a closer must log their first call today to unlock.
  const isCloser = ctx.memberships.some(
    (m) => m.clientId === active.id && m.role === "closer",
  );
  const gated = isCloser && !ctx.isAdmin && todaysCalls.length === 0;

  const bucketCounts = mtdCalls.reduce<Record<OutcomeBucket, number>>(
    (acc, c) => {
      const b = bucketOf(c.outcome);
      acc[b] = (acc[b] ?? 0) + 1;
      return acc;
    },
    { closed: 0, showed_not_closed: 0, no_show: 0, rescheduled: 0 },
  );
  const pieData = (Object.keys(BUCKET_LABEL) as OutcomeBucket[]).map((k) => ({
    name: k,
    value: bucketCounts[k] ?? 0,
  }));

  // Conversion funnel: calls taken → showed up → closed.
  const callsTaken = mtdCalls.length - bucketCounts.rescheduled;
  const shown = bucketCounts.closed + bucketCounts.showed_not_closed;
  const funnelSteps = [
    { label: "Calls Taken", value: callsTaken },
    { label: "Showed", value: shown },
    { label: "Closed", value: bucketCounts.closed },
  ];

  // Revenue by lead source (closed deals).
  const revBySource = new Map<string, number>();
  for (const c of mtdCalls) {
    if (bucketOf(c.outcome) === "closed") {
      const k = c.leadSource ?? "unknown";
      revBySource.set(k, (revBySource.get(k) ?? 0) + c.revenue);
    }
  }
  const sourceData = [...revBySource.entries()]
    .map(([label, value]) => ({ label, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);

  // Daily revenue trend (closed deals only), for this dashboard specifically.
  const revByDate = new Map<string, number>();
  for (const c of mtdCalls) {
    if (bucketOf(c.outcome) === "closed") {
      revByDate.set(c.date, (revByDate.get(c.date) ?? 0) + c.revenue);
    }
  }
  const revenueTrend = [...revByDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, revenue]) => ({ date, revenue: Math.round(revenue) }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Sales dashboard</h1>
          <p className="text-sm text-ink-soft">
            {active.name} · {rangeLabel} · {active.reportingCurrency}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <RangeSelector active={range} />
          <ClientSwitcher options={options} activeId={active.id} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-medium text-ink-soft">Log a call</h2>
          {gated && (
            <p className="mb-3 rounded border border-accent-amber/30 bg-accent-amber/10 p-2 text-xs text-accent-amber">
              Log your first call of the day to unlock today’s metrics.
            </p>
          )}
          <LogCallForm clientId={active.id} currency={active.reportingCurrency} today={today} />
        </section>

        <div className={gated ? "pointer-events-none select-none blur-sm" : ""}>
          <section className="card p-4">
            <h2 className="mb-3 text-sm font-medium text-ink-soft">
              Outcomes ({rangeLabel})
            </h2>
            <OutcomePie data={pieData} />
          </section>
        </div>
      </div>

      <div className={`grid gap-6 lg:grid-cols-2 ${gated ? "pointer-events-none select-none blur-sm" : ""}`}>
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-medium text-ink-soft">
            Conversion funnel ({rangeLabel})
          </h2>
          <Funnel steps={funnelSteps} />
        </section>
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-medium text-ink-soft">
            Revenue by lead source ({active.reportingCurrency})
          </h2>
          <HBarChart data={sourceData} />
        </section>
      </div>

      <section className={`card p-4 ${gated ? "pointer-events-none select-none blur-sm" : ""}`}>
        <h2 className="mb-3 text-sm font-medium text-ink-soft">
          Daily revenue trend ({rangeLabel})
        </h2>
        <RevenueTrendChart data={revenueTrend} />
      </section>

      <section
        className={`card p-4 ${
          gated ? "pointer-events-none select-none blur-sm" : ""
        }`}
      >
        <h2 className="mb-3 text-sm font-medium text-ink-soft">
          Today’s calls ({todaysCalls.length})
        </h2>
        {todaysCalls.length === 0 ? (
          <p className="text-sm text-ink-faint">No calls logged today yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-ink-faint">
              <tr>
                <th className="py-1">Outcome</th>
                <th className="py-1">Closer</th>
                <th className="py-1">Revenue</th>
                <th className="py-1">Cash</th>
                <th className="py-1">Source</th>
                <th className="py-1">Tags</th>
              </tr>
            </thead>
            <tbody>
              {todaysCalls.map((c) => (
                <TodaysCallRow
                  key={c.id}
                  call={c}
                  closerName={c.closerUserId ? closerNameById.get(c.closerUserId) ?? "Unknown" : "—"}
                />
              ))}
            </tbody>
          </table>
        )}
      </section>

      <AiPanel clientId={active.id} notifications={notifications} readOnly={readOnly} dashboard="sales" />
    </div>
  );
}
