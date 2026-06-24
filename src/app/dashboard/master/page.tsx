import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { isClientViewer } from "@/lib/access";
import { resolveClientScope } from "@/lib/data/client-scope";
import { computeMasterView } from "@/lib/data/master";
import { KpiCard } from "@/components/KpiCard";
import { ClientSwitcher } from "@/components/ClientSwitcher";
import { RevenueTrendChart } from "@/components/charts";

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
    return <p className="text-neutral-400">No clients available for your account.</p>;
  }

  const view = await computeMasterView(active.id, active.reportingCurrency);
  const readOnly = !ctx.isAdmin && isClientViewer(ctx, active.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Master dashboard</h1>
          <p className="text-sm text-neutral-400">
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

      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="mb-3 text-sm font-medium text-neutral-300">
          Revenue trend (closed deals, MTD)
        </h2>
        <RevenueTrendChart data={view.revenueTrend} />
      </div>
    </div>
  );
}
