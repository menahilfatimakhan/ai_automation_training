import { getProviders } from "@/providers/registry";
import { computeAdKpis, computeSalesKpis } from "@/lib/kpi/engine";
import { METRIC_KEYS } from "@/domain/metrics";
import {
  loadAdMetricsService,
  loadCallsService,
  loadSetterActivityService,
} from "@/lib/data/service-loaders";

interface ClientInfo {
  id: string;
  currency: string;
}

/**
 * Metrics for a client over an explicit period, computed via the
 * service-level (RLS-bypassing) loaders so this works both from a
 * user-triggered "Generate Now" click and from the scheduler (no user
 * session). Uses the exact same kpi/engine.ts formulas as every dashboard —
 * a report's numbers are never a separate calculation from what's on-screen.
 */
export async function reportMetricsForClient(
  client: ClientInfo,
  periodStart: string,
  periodEnd: string,
): Promise<Record<string, number | string>> {
  const fx = getProviders().fx;

  const [callRecords, adRows, setterRows] = await Promise.all([
    loadCallsService(client.id, periodStart, periodEnd),
    loadAdMetricsService(client.id, periodStart, periodEnd),
    loadSetterActivityService(client.id, periodStart, periodEnd),
  ]);

  const sales = await computeSalesKpis(callRecords, client.currency, fx);
  const newConversations = setterRows.reduce((s, r) => s + r.conversations, 0);
  const ads = await computeAdKpis(adRows, client.currency, fx, {
    revenue: sales.revenue,
    cashCollected: sales.cashCollected,
    callsTaken: sales.callsTaken,
    closedDeals: sales.closedDeals,
    newConversations,
  });

  const round2 = (n: number) => Number(n.toFixed(2));
  return {
    [METRIC_KEYS.revenue]: round2(sales.revenue),
    [METRIC_KEYS.cashCollected]: round2(sales.cashCollected),
    [METRIC_KEYS.dealsWon]: sales.closedDeals,
    [METRIC_KEYS.callsTaken]: sales.callsTaken,
    [METRIC_KEYS.closeRate]: round2(sales.closeRate),
    [METRIC_KEYS.showUpRate]: round2(sales.showUpRate),
    [METRIC_KEYS.avgDealSize]: round2(sales.avgDealSize),
    [METRIC_KEYS.adSpend]: round2(ads.adSpend),
    [METRIC_KEYS.roasRev]: round2(ads.roasRev),
    [METRIC_KEYS.roasCash]: round2(ads.roasCash),
    [METRIC_KEYS.costPerCall]: round2(ads.costPerCall),
  };
}
