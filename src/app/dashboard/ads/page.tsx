import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { isClientViewer, canSeeAggregate, landingRoute } from "@/lib/access";
import { resolveClientScope } from "@/lib/data/client-scope";
import { loadAdMetrics, loadCalls, loadCampaigns, loadSetterActivity, toCallRecords } from "@/lib/data/dashboards";
import { loadNotifications } from "@/lib/data/notifications";
import { getProviders } from "@/providers/registry";
import { computeAdKpis, computeSalesKpis } from "@/lib/kpi/engine";
import { AiPanel } from "@/components/AiPanel";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveRange, isRangeKey, type RangeKey } from "@/lib/range";
import { formatMoney, formatPercent, formatMultiple } from "@/lib/format";
import { ClientSwitcher } from "@/components/ClientSwitcher";
import { RangeSelector } from "@/components/RangeSelector";
import { SyncButton } from "@/components/SyncButton";
import { SeriesBarChart, HBarChart } from "@/components/charts";
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
  searchParams: Promise<{ client?: string; range?: string }>;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  const sp = await searchParams;
  const { active, options } = await resolveClientScope(ctx, sp.client);
  if (!active) return <p className="text-ink-soft">No client available.</p>;
  // Complete ad data — closers/setters are sent to their own dashboard.
  if (!canSeeAggregate(ctx, active.id)) redirect(landingRoute(ctx));

  const range: RangeKey = isRangeKey(sp.range) ? sp.range : "30d";
  const { from, to, label: rangeLabel } = resolveRange(range);

  const [campaigns, metrics, syncedLabel, notifications, callRows, setterRows] = await Promise.all([
    loadCampaigns(active.id),
    loadAdMetrics(active.id, from, to),
    lastSyncedLabel(active.id),
    loadNotifications(active.id),
    loadCalls(active.id, from, to),
    loadSetterActivity(active.id, from, to),
  ]);
  const readOnly = !ctx.isAdmin && isClientViewer(ctx, active.id);

  // Headline ad KPIs (ROAS Cash/Rev, cost/call/conversation/customer/follower,
  // CTR/CPM/CPC) — sales/setter figures are supplied for the same range so the
  // Ads dashboard's attribution matches the Sales/Setter dashboards exactly.
  const fx = getProviders().fx;
  const sales = await computeSalesKpis(toCallRecords(callRows), active.reportingCurrency, fx);
  const newConversations = setterRows.reduce((s, r) => s + r.conversations, 0);
  const adKpis = await computeAdKpis(metrics, active.reportingCurrency, fx, {
    revenue: sales.revenue,
    cashCollected: sales.cashCollected,
    callsTaken: sales.callsTaken,
    closedDeals: sales.closedDeals,
    newConversations,
  });
  const money = (n: number) => formatMoney(n, active.reportingCurrency);
  const headlineCards: { label: string; value: string }[] = [
    { label: "Total Spend", value: money(adKpis.adSpend) },
    { label: "Total Leads", value: adKpis.totalLeads.toLocaleString("en-US") },
    {
      label: "Cost / Follower",
      value: adKpis.followersGained > 0 ? money(adKpis.costPerFollower) : "—",
    },
    { label: "Cost / Convo", value: money(adKpis.costPerConversation) },
    { label: "ROAS Cash", value: formatMultiple(adKpis.roasCash) },
    { label: "ROAS Rev", value: formatMultiple(adKpis.roasRev) },
    { label: "Cost / Call", value: money(adKpis.costPerCall) },
    { label: "Cost / Customer", value: money(adKpis.costPerCustomer) },
    { label: "CTR", value: formatPercent(adKpis.ctr) },
    { label: "CPM", value: money(adKpis.cpm) },
    { label: "CPC", value: money(adKpis.cpc) },
  ];

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

  // Daily results trend + spend share by campaign.
  const resultsByDate = new Map<string, number>();
  for (const m of metrics) {
    resultsByDate.set(m.date, (resultsByDate.get(m.date) ?? 0) + m.results);
  }
  const resultsTrend = [...resultsByDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, results]) => ({ date, results }));

  const spendByCampaign = rows
    .map((r) => ({ label: r.name.replace(/^[^—]*—\s*/, ""), value: Math.round(r.spend) }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Ads dashboard</h1>
          <p className="text-sm text-ink-soft">
            {active.name} · read-only · {rangeLabel}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SyncButton clientId={active.id} lastSyncedLabel={syncedLabel} />
          <RangeSelector active={range} />
          <ClientSwitcher options={options} activeId={active.id} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {headlineCards.map((c) => (
          <div key={c.label} className="card p-3">
            <div className="text-xs text-ink-soft">{c.label}</div>
            <div className="mt-1 text-lg font-semibold">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-medium text-ink-soft">Spend trend</h2>
          <SeriesBarChart data={spendTrend} dataKey="spend" color="#f59e0b" />
        </section>
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-medium text-ink-soft">Results trend (leads)</h2>
          <SeriesBarChart data={resultsTrend} dataKey="results" color="#3B82F6" />
        </section>
      </div>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-medium text-ink-soft">
          Spend by campaign ({active.reportingCurrency})
        </h2>
        <HBarChart data={spendByCampaign} color="#f59e0b" height={200} />
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-medium text-ink-soft">Campaigns</h2>
        <AdCampaignTable rows={rows} />
      </section>

      <AiPanel clientId={active.id} notifications={notifications} readOnly={readOnly} />
    </div>
  );
}
