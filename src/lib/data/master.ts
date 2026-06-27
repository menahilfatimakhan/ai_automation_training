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
export type Tone = "green" | "violet" | "amber" | "sky" | "rose" | "blue";

export interface KpiCardVM {
  key: MetricKey;
  label: string;
  format: MetricFormat;
  tone: Tone;
  currency?: string;
  computed: number;
  effective: number;
  overridden: boolean;
  source: "computed" | "manual" | "ai_suggestion";
  goal?: { target: number; progress: number };
  suggestion?: { id: string; value: number | null; rationale: string };
  /** Daily trend for an inline sparkline (hero cards only). */
  spark?: number[];
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

const CARD_DEFS: { key: MetricKey; label: string; format: MetricFormat; tone: Tone }[] = [
  { key: METRIC_KEYS.revenue, label: "Revenue (MTD)", format: "money", tone: "green" },
  { key: METRIC_KEYS.closeRate, label: "Close Rate", format: "percent", tone: "green" },
  { key: METRIC_KEYS.cashCollected, label: "Cash Collected", format: "money", tone: "violet" },
  { key: METRIC_KEYS.totalCalls, label: "Calls Booked", format: "number", tone: "amber" },
  { key: METRIC_KEYS.avgDealSize, label: "Avg Deal Size", format: "money", tone: "sky" },
  { key: METRIC_KEYS.noShowRate, label: "No-Shows", format: "percent", tone: "rose" },
  { key: METRIC_KEYS.roas, label: "ROAS", format: "multiple", tone: "green" },
  { key: METRIC_KEYS.adSpend, label: "Ad Spend", format: "money", tone: "amber" },
  { key: METRIC_KEYS.costPerCall, label: "Cost / Call", format: "money", tone: "rose" },
];

/** Metrics that get an inline sparkline (the hero cards). */
const SPARK_KEYS = new Set<MetricKey>([
  METRIC_KEYS.revenue,
  METRIC_KEYS.closeRate,
  METRIC_KEYS.cashCollected,
]);

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

  // Daily series (oldest → newest) for trends + KPI sparklines.
  const revByDate = new Map<string, number>();
  const cashByDate = new Map<string, number>();
  const dayCounts = new Map<string, { closed: number; total: number; noShow: number }>();
  for (const c of callRows) {
    if (c.outcome === "closed") revByDate.set(c.date, (revByDate.get(c.date) ?? 0) + c.revenue);
    if (c.cashCollected) cashByDate.set(c.date, (cashByDate.get(c.date) ?? 0) + c.cashCollected);
    const dc = dayCounts.get(c.date) ?? { closed: 0, total: 0, noShow: 0 };
    dc.total += 1;
    if (c.outcome === "closed") dc.closed += 1;
    if (c.outcome === "no_show") dc.noShow += 1;
    dayCounts.set(c.date, dc);
  }
  const dates = [...new Set([...revByDate.keys(), ...cashByDate.keys(), ...dayCounts.keys()])].sort();
  const sparkByKey: Partial<Record<MetricKey, number[]>> = {
    [METRIC_KEYS.revenue]: dates.map((d) => Math.round(revByDate.get(d) ?? 0)),
    [METRIC_KEYS.cashCollected]: dates.map((d) => Math.round(cashByDate.get(d) ?? 0)),
    [METRIC_KEYS.closeRate]: dates.map((d) => {
      const dc = dayCounts.get(d);
      const taken = dc ? dc.total - dc.noShow : 0;
      return taken > 0 ? Math.round(((dc!.closed / taken) * 100)) : 0;
    }),
  };

  const cards: KpiCardVM[] = CARD_DEFS.map((def) => {
    const computed = computedByKey[def.key];
    const resolved = resolveValue(computed, overrides.get(def.key));
    const card: KpiCardVM = {
      key: def.key,
      label: def.label,
      format: def.format,
      tone: def.tone,
      currency: def.format === "money" ? currency : undefined,
      computed,
      effective: resolved.effective,
      overridden: resolved.overridden,
      source: resolved.source,
      spark: SPARK_KEYS.has(def.key) ? sparkByKey[def.key] : undefined,
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

  const revenueTrend = dates.map((date) => ({ date, revenue: Math.round(revByDate.get(date) ?? 0) }));
  const moneyTrend = dates.map((date) => ({
    date,
    revenue: Math.round(revByDate.get(date) ?? 0),
    cash: Math.round(cashByDate.get(date) ?? 0),
  }));

  return { currency, periodStart, periodEnd, cards, revenueTrend, moneyTrend };
}
