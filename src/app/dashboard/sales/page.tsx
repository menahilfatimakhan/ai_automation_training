import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { isClientViewer } from "@/lib/access";
import { resolveClientScope } from "@/lib/data/client-scope";
import { loadCalls } from "@/lib/data/dashboards";
import { loadNotifications } from "@/lib/data/notifications";
import { monthStartIso, todayIso, formatMoney } from "@/lib/format";
import { LogCallForm } from "@/components/LogCallForm";
import { OutcomePie, Funnel, HBarChart } from "@/components/charts";
import { ClientSwitcher } from "@/components/ClientSwitcher";
import { TagEditor } from "@/components/TagEditor";
import { AiPanel } from "@/components/AiPanel";

const OUTCOME_LABEL: Record<string, string> = {
  closed: "Closed",
  rescheduled: "Rescheduled",
  lost: "Lost",
  no_show: "No-show",
};

export default async function SalesDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  const { client } = await searchParams;
  const { active, options } = await resolveClientScope(ctx, client);
  if (!active) return <p className="text-ink-soft">No client available.</p>;

  const today = todayIso();
  const mtdCalls = await loadCalls(active.id, monthStartIso(), today);
  const todaysCalls = mtdCalls.filter((c) => c.date === today);
  const notifications = await loadNotifications(active.id);
  const readOnly = !ctx.isAdmin && isClientViewer(ctx, active.id);

  // First-call gate: a closer must log their first call today to unlock.
  const isCloser = ctx.memberships.some(
    (m) => m.clientId === active.id && m.role === "closer",
  );
  const gated = isCloser && !ctx.isAdmin && todaysCalls.length === 0;

  const outcomeCounts = mtdCalls.reduce<Record<string, number>>((acc, c) => {
    acc[c.outcome] = (acc[c.outcome] ?? 0) + 1;
    return acc;
  }, {});
  const pieData = Object.keys(OUTCOME_LABEL).map((k) => ({
    name: k,
    value: outcomeCounts[k] ?? 0,
  }));

  // Conversion funnel: calls booked → showed up → closed.
  const noShows = outcomeCounts["no_show"] ?? 0;
  const funnelSteps = [
    { label: "Calls", value: mtdCalls.length },
    { label: "Showed", value: mtdCalls.length - noShows },
    { label: "Closed", value: outcomeCounts["closed"] ?? 0 },
  ];

  // Revenue by lead source (closed deals).
  const revBySource = new Map<string, number>();
  for (const c of mtdCalls) {
    if (c.outcome === "closed") {
      const k = c.leadSource ?? "unknown";
      revBySource.set(k, (revBySource.get(k) ?? 0) + c.revenue);
    }
  }
  const sourceData = [...revBySource.entries()]
    .map(([label, value]) => ({ label, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Sales dashboard</h1>
          <p className="text-sm text-ink-soft">
            {active.name} · {active.reportingCurrency}
          </p>
        </div>
        <ClientSwitcher options={options} activeId={active.id} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-medium text-ink-soft">Log a call</h2>
          {gated && (
            <p className="mb-3 rounded border border-accent-amber/30 bg-accent-amber/10 p-2 text-xs text-accent-amber">
              Log your first call of the day to unlock today’s metrics.
            </p>
          )}
          <LogCallForm clientId={active.id} currency={active.reportingCurrency} />
        </section>

        <div className={gated ? "pointer-events-none select-none blur-sm" : ""}>
          <section className="card p-4">
            <h2 className="mb-3 text-sm font-medium text-ink-soft">
              Outcomes (month to date)
            </h2>
            <OutcomePie data={pieData} />
          </section>
        </div>
      </div>

      <div className={`grid gap-6 lg:grid-cols-2 ${gated ? "pointer-events-none select-none blur-sm" : ""}`}>
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-medium text-ink-soft">
            Conversion funnel (MTD)
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
                <th className="py-1">Revenue</th>
                <th className="py-1">Cash</th>
                <th className="py-1">Source</th>
                <th className="py-1">Tags</th>
              </tr>
            </thead>
            <tbody>
              {todaysCalls.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="py-1.5">{OUTCOME_LABEL[c.outcome]}</td>
                  <td className="py-1.5">{formatMoney(c.revenue, c.currency)}</td>
                  <td className="py-1.5">{formatMoney(c.cashCollected, c.currency)}</td>
                  <td className="py-1.5 text-ink-soft">{c.leadSource ?? "—"}</td>
                  <td className="py-1.5">
                    <TagEditor id={c.id} tags={c.tags} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <AiPanel clientId={active.id} notifications={notifications} readOnly={readOnly} />
    </div>
  );
}
