import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { resolveClientScope } from "@/lib/data/client-scope";
import { loadCalls } from "@/lib/data/dashboards";
import { monthStartIso, todayIso, formatMoney } from "@/lib/format";
import { LogCallForm } from "@/components/LogCallForm";
import { OutcomePie } from "@/components/charts";
import { ClientSwitcher } from "@/components/ClientSwitcher";
import { TagEditor } from "@/components/TagEditor";

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
  if (!active) return <p className="text-neutral-400">No client available.</p>;

  const today = todayIso();
  const mtdCalls = await loadCalls(active.id, monthStartIso(), today);
  const todaysCalls = mtdCalls.filter((c) => c.date === today);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Sales dashboard</h1>
          <p className="text-sm text-neutral-400">
            {active.name} · {active.reportingCurrency}
          </p>
        </div>
        <ClientSwitcher options={options} activeId={active.id} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <h2 className="mb-3 text-sm font-medium text-neutral-300">Log a call</h2>
          {gated && (
            <p className="mb-3 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-300">
              Log your first call of the day to unlock today’s metrics.
            </p>
          )}
          <LogCallForm clientId={active.id} currency={active.reportingCurrency} />
        </section>

        <div className={gated ? "pointer-events-none select-none blur-sm" : ""}>
          <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <h2 className="mb-3 text-sm font-medium text-neutral-300">
              Outcomes (month to date)
            </h2>
            <OutcomePie data={pieData} />
          </section>
        </div>
      </div>

      <section
        className={`rounded-lg border border-neutral-800 bg-neutral-900 p-4 ${
          gated ? "pointer-events-none select-none blur-sm" : ""
        }`}
      >
        <h2 className="mb-3 text-sm font-medium text-neutral-300">
          Today’s calls ({todaysCalls.length})
        </h2>
        {todaysCalls.length === 0 ? (
          <p className="text-sm text-neutral-500">No calls logged today yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-neutral-500">
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
                <tr key={c.id} className="border-t border-neutral-800">
                  <td className="py-1.5">{OUTCOME_LABEL[c.outcome]}</td>
                  <td className="py-1.5">{formatMoney(c.revenue, c.currency)}</td>
                  <td className="py-1.5">{formatMoney(c.cashCollected, c.currency)}</td>
                  <td className="py-1.5 text-neutral-400">{c.leadSource ?? "—"}</td>
                  <td className="py-1.5">
                    <TagEditor id={c.id} tags={c.tags} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
