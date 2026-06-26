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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {view.cards.map((card) => (
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
    </div>
  );
}
