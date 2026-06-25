import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { isClientViewer } from "@/lib/access";
import { resolveClientScope } from "@/lib/data/client-scope";
import { loadAdMetrics, loadCampaigns } from "@/lib/data/dashboards";
import { loadNotifications } from "@/lib/data/notifications";
import { AiPanel } from "@/components/AiPanel";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { daysAgoIso, todayIso } from "@/lib/format";
import { ClientSwitcher } from "@/components/ClientSwitcher";
import { SyncButton } from "@/components/SyncButton";
import { SeriesBarChart } from "@/components/charts";
import { AdCampaignTable, type CampaignAggregate } from "@/components/AdCampaignTable";

async function lastSyncedLabel(clientId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("ad_connections")
    .select("last_synced_at")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!data?.last_synced_at) return "Never synced";
  return `Last synced ${new Date(data.last_synced_at).toLocaleString()}`;
}

export default async function AdsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  const { client } = await searchParams;
  const { active, options } = await resolveClientScope(ctx, client);
  if (!active) return <p className="text-ink-soft">No client available.</p>;

  const [campaigns, metrics, syncedLabel, notifications] = await Promise.all([
    loadCampaigns(active.id),
    loadAdMetrics(active.id, daysAgoIso(29), todayIso()),
    lastSyncedLabel(active.id),
    loadNotifications(active.id),
  ]);
  const readOnly = !ctx.isAdmin && isClientViewer(ctx, active.id);

  // Aggregate metrics per campaign (last 30 days).
  const aggByCampaign = new Map<string, CampaignAggregate>();
  for (const c of campaigns) {
    aggByCampaign.set(c.campaignId, {
      campaignId: c.campaignId,
      name: c.name,
      status: c.status,
      category: c.category,
      currency: c.currency,
      spend: 0,
      impressions: 0,
      reach: 0,
      results: 0,
      ctr: 0,
    });
  }
  const ctrAccum = new Map<string, { sum: number; n: number }>();
  for (const m of metrics) {
    const agg = aggByCampaign.get(m.campaignId);
    if (!agg) continue;
    agg.spend += m.spend;
    agg.impressions += m.impressions;
    agg.reach += m.reach;
    agg.results += m.results;
    const acc = ctrAccum.get(m.campaignId) ?? { sum: 0, n: 0 };
    acc.sum += m.ctr;
    acc.n += 1;
    ctrAccum.set(m.campaignId, acc);
  }
  for (const [id, acc] of ctrAccum) {
    const agg = aggByCampaign.get(id);
    if (agg) agg.ctr = acc.n ? acc.sum / acc.n : 0;
  }
  const rows = [...aggByCampaign.values()];

  // Daily spend trend.
  const spendByDate = new Map<string, number>();
  for (const m of metrics) {
    spendByDate.set(m.date, (spendByDate.get(m.date) ?? 0) + m.spend);
  }
  const spendTrend = [...spendByDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, spend]) => ({ date, spend: Math.round(spend) }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Ads dashboard</h1>
          <p className="text-sm text-ink-soft">
            {active.name} · read-only · last 30 days
          </p>
        </div>
        <div className="flex items-center gap-4">
          <SyncButton clientId={active.id} lastSyncedLabel={syncedLabel} />
          <ClientSwitcher options={options} activeId={active.id} />
        </div>
      </div>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-medium text-ink-soft">Spend trend</h2>
        <SeriesBarChart data={spendTrend} dataKey="spend" color="#f59e0b" />
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-medium text-ink-soft">Campaigns</h2>
        <AdCampaignTable rows={rows} />
      </section>

      <AiPanel clientId={active.id} notifications={notifications} readOnly={readOnly} />
    </div>
  );
}
