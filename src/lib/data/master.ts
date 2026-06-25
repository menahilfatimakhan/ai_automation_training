import { getProviders } from "@/providers/registry";
import { computeAdKpis, computeSalesKpis } from "@/lib/kpi/engine";
import { resolveValue } from "@/lib/kpi/resolve";
import { METRIC_KEYS, type MetricKey } from "@/domain/metrics";
import {
  loadAdMetrics,
  loadCalls,
  loadGoalForMonth,
  loadOverrides,
  loadSetterActivity,
  loadSuggestions,
  toCallRecords,
} from "@/lib/data/dashboards";
import { monthEndIso, monthStartIso, todayIso } from "@/lib/format";

export type MetricFormat = "money" | "percent" | "number" | "multiple";

export interface KpiCardVM {
  key: MetricKey;
  label: string;
  format: MetricFormat;
  currency?: string;
  computed: number;
  effective: number;
  overridden: boolean;
  source: "computed" | "manual" | "ai_suggestion";
  goal?: { target: number; progress: number };
  suggestion?: { id: string; value: number | null; rationale: string };
}

export interface MasterView {
  currency: string;
  periodStart: string;
  periodEnd: string;
  cards: KpiCardVM[];
  revenueTrend: { date: string; revenue: number }[];
  /** Combined daily revenue (closed) + cash collected, for a dual-series chart. */
  moneyTrend: { date: string; revenue: number; cash: number }[];
}

const CARD_DEFS: { key: MetricKey; label: string; format: MetricFormat }[] = [
  { key: METRIC_KEYS.revenue, label: "Revenue (MTD)", format: "money" },
  { key: METRIC_KEYS.cashCollected, label: "Cash Collected", format: "money" },
  { key: METRIC_KEYS.totalCalls, label: "Calls", format: "number" },
  { key: METRIC_KEYS.closeRate, label: "Close Rate", format: "percent" },
  { key: METRIC_KEYS.avgDealSize, label: "Avg Deal Size", format: "money" },
  { key: METRIC_KEYS.noShowRate, label: "No-Show Rate", format: "percent" },
  { key: METRIC_KEYS.adSpend, label: "Ad Spend", format: "money" },
  { key: METRIC_KEYS.roas, label: "ROAS", format: "multiple" },
  { key: METRIC_KEYS.costPerCall, label: "Cost / Call", format: "money" },
];

/**
 * Assembles the master dashboard view: computed KPIs (always recalculated),
 * the effective value after any manual/AI override (resolved at read time),
 * monthly goal progress, and the latest AI suggestion per metric.
 */
export async function computeMasterView(
  clientId: string,
  currency: string,
): Promise<MasterView> {
  const periodStart = monthStartIso();
  const periodEnd = monthEndIso();
  const today = todayIso();
  const fx = getProviders().fx;

  const [callRows, adRows, setterRows, goal, overrides, suggestions] =
    await Promise.all([
      loadCalls(clientId, periodStart, today),
      loadAdMetrics(clientId, periodStart, today),
      loadSetterActivity(clientId, periodStart, today),
      loadGoalForMonth(clientId, periodStart),
      loadOverrides(clientId, periodStart, periodEnd),
      loadSuggestions(clientId, periodStart, periodEnd),
    ]);

  const sales = await computeSalesKpis(toCallRecords(callRows), currency, fx);
  const callsBooked = setterRows.reduce((s, r) => s + r.callsBooked, 0);
  const ads = await computeAdKpis(adRows, currency, fx, {
    attributedRevenue: sales.revenue,
    callsBooked: callsBooked || sales.totalCalls,
  });

  const computedByKey: Record<MetricKey, number> = {
    [METRIC_KEYS.revenue]: sales.revenue,
    [METRIC_KEYS.cashCollected]: sales.cashCollected,
    [METRIC_KEYS.totalCalls]: sales.totalCalls,
    [METRIC_KEYS.closeRate]: sales.closeRate,
    [METRIC_KEYS.avgDealSize]: sales.avgDealSize,
    [METRIC_KEYS.noShowRate]: sales.noShowRate,
    [METRIC_KEYS.adSpend]: ads.adSpend,
    [METRIC_KEYS.roas]: ads.roas,
    [METRIC_KEYS.costPerCall]: ads.costPerCall,
    [METRIC_KEYS.callsBooked]: callsBooked,
    [METRIC_KEYS.setterReplyRate]: 0,
    [METRIC_KEYS.setterProposalRate]: 0,
    [METRIC_KEYS.setterBookingRate]: 0,
  };

  const latestSuggestionByKey = new Map<string, (typeof suggestions)[number]>();
  for (const s of suggestions) {
    if (s.status === "pending" && !latestSuggestionByKey.has(s.targetKey)) {
      latestSuggestionByKey.set(s.targetKey, s);
    }
  }

  const cards: KpiCardVM[] = CARD_DEFS.map((def) => {
    const computed = computedByKey[def.key];
    const resolved = resolveValue(computed, overrides.get(def.key));
    const card: KpiCardVM = {
      key: def.key,
      label: def.label,
      format: def.format,
      currency: def.format === "money" ? currency : undefined,
      computed,
      effective: resolved.effective,
      overridden: resolved.overridden,
      source: resolved.source,
    };

    if (goal && def.key === METRIC_KEYS.revenue) {
      card.goal = {
        target: goal.revenueGoal,
        progress: goal.revenueGoal ? resolved.effective / goal.revenueGoal : 0,
      };
    }
    if (goal && def.key === METRIC_KEYS.totalCalls) {
      card.goal = {
        target: goal.callsGoal,
        progress: goal.callsGoal ? resolved.effective / goal.callsGoal : 0,
      };
    }

    const sug = latestSuggestionByKey.get(def.key);
    if (sug) {
      card.suggestion = {
        id: sug.id,
        value: sug.suggestedValue,
        rationale: sug.rationale,
      };
    }
    return card;
  });

  // Daily revenue (closed) + cash-collected (all calls), oldest → newest.
  const revByDate = new Map<string, number>();
  const cashByDate = new Map<string, number>();
  for (const c of callRows) {
    if (c.outcome === "closed") {
      revByDate.set(c.date, (revByDate.get(c.date) ?? 0) + c.revenue);
    }
    if (c.cashCollected) {
      cashByDate.set(c.date, (cashByDate.get(c.date) ?? 0) + c.cashCollected);
    }
  }
  const dates = [...new Set([...revByDate.keys(), ...cashByDate.keys()])].sort();
  const revenueTrend = dates.map((date) => ({ date, revenue: Math.round(revByDate.get(date) ?? 0) }));
  const moneyTrend = dates.map((date) => ({
    date,
    revenue: Math.round(revByDate.get(date) ?? 0),
    cash: Math.round(cashByDate.get(date) ?? 0),
  }));

  return { currency, periodStart, periodEnd, cards, revenueTrend, moneyTrend };
}
