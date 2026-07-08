import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { isClientViewer, canSeeAggregate, landingRoute } from "@/lib/access";
import { resolveClientScope } from "@/lib/data/client-scope";
import { computeMasterView } from "@/lib/data/master";
import { loadClosedDealsTrend } from "@/lib/data/dashboards";
import { loadNotifications } from "@/lib/data/notifications";
import { daysAgoIso, todayIso } from "@/lib/format";
import { KpiCard } from "@/components/KpiCard";
import { ClientSwitcher } from "@/components/ClientSwitcher";
import { DualAreaChart, DealsRevenueChart } from "@/components/charts";
import { AiPanel } from "@/components/AiPanel";

export default async function MasterDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  const { client } = await searchParams;
  const { active, options } = await resolveClientScope(ctx, client);
  if (!active) {
    return <p className="text-ink-soft">No clients available for your account.</p>;
  }
  // Aggregate view — closers/setters are sent to their own dashboard.
  if (!canSeeAggregate(ctx, active.id)) redirect(landingRoute(ctx));

  const [view, notifications, dealsTrend] = await Promise.all([
    computeMasterView(active.id, active.reportingCurrency),
    loadNotifications(active.id),
    loadClosedDealsTrend(active.id, daysAgoIso(99), todayIso()),
  ]);
  const readOnly = !ctx.isAdmin && isClientViewer(ctx, active.id);
  const dealsTotal = dealsTrend.reduce((s, d) => s + d.deals, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Master dashboard</h1>
          <p className="text-sm text-ink-soft">
            {active.name} · month to date · {active.reportingCurrency}
          </p>
        </div>
        <ClientSwitcher options={options} activeId={active.id} />
      </div>

      {/* Hero KPIs with sparklines */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {view.cards
          .filter((c) => c.spark)
          .map((card) => (
            <KpiCard
              key={card.key}
              card={card}
              clientId={active.id}
              periodStart={view.periodStart}
              periodEnd={view.periodEnd}
              readOnly={readOnly}
            />
          ))}
      </div>

      {/* Compact secondary KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {view.cards
          .filter((c) => !c.spark)
          .map((card) => (
            <KpiCard
              key={card.key}
              card={card}
              clientId={active.id}
              periodStart={view.periodStart}
              periodEnd={view.periodEnd}
              readOnly={readOnly}
            />
          ))}
      </div>

      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-soft">
            Deals closed &amp; revenue — last 100 days
          </h2>
          <span className="chip">{dealsTotal} deals closed</span>
        </div>
        <DealsRevenueChart data={dealsTrend} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-3 text-sm font-medium text-ink-soft">
            Revenue vs cash collected (MTD)
          </h2>
          <DualAreaChart
            data={view.moneyTrend}
            keys={[
              { key: "revenue", label: "Revenue", color: "#3B82F6" },
              { key: "cash", label: "Cash collected", color: "#60A5FA" },
            ]}
          />
        </div>
        <AiPanel
          clientId={active.id}
          notifications={notifications}
          readOnly={readOnly}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-3 text-sm font-medium text-ink-soft">
            Top performers (MTD)
          </h2>
          {view.leaderboard.length === 0 ? (
            <p className="text-sm text-ink-faint">No closer activity this month yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-ink-faint">
                <tr>
                  <th className="py-1">Closer</th>
                  <th className="py-1">Calls</th>
                  <th className="py-1">Deals</th>
                  <th className="py-1">Close Rate</th>
                  <th className="py-1">Show-Up</th>
                  <th className="py-1">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {view.leaderboard.map((row) => (
                  <tr key={row.userId} className="border-t border-line">
                    <td className="py-1.5">{row.name}</td>
                    <td className="py-1.5">{row.callsTaken}</td>
                    <td className="py-1.5">{row.dealsWon}</td>
                    <td className="py-1.5">{Math.round(row.closeRate * 100)}%</td>
                    <td className="py-1.5">{Math.round(row.showUpRate * 100)}%</td>
                    <td className="py-1.5 tabular-nums">
                      {row.revenue.toLocaleString("en-US", {
                        style: "currency",
                        currency: view.currency,
                        maximumFractionDigits: 0,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card p-4">
          <h2 className="mb-3 text-sm font-medium text-ink-soft">
            Setter activity (MTD)
          </h2>
          {view.setterSummary.length === 0 ? (
            <p className="text-sm text-ink-faint">No setter activity this month yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-ink-faint">
                <tr>
                  <th className="py-1">Setter</th>
                  <th className="py-1">Convos</th>
                  <th className="py-1">Replies</th>
                  <th className="py-1">Proposals</th>
                  <th className="py-1">Booked</th>
                  <th className="py-1">Follow-ups</th>
                </tr>
              </thead>
              <tbody>
                {view.setterSummary.map((row) => (
                  <tr key={row.userId} className="border-t border-line">
                    <td className="py-1.5">{row.name}</td>
                    <td className="py-1.5">{row.conversations}</td>
                    <td className="py-1.5">{row.replies}</td>
                    <td className="py-1.5">{row.proposals}</td>
                    <td className="py-1.5">{row.callsBooked}</td>
                    <td className="py-1.5">{row.followUps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
