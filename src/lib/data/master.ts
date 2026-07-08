import { getProviders } from "@/providers/registry";
import { computeAdKpis, computeSalesKpis } from "@/lib/kpi/engine";
import { resolveValue } from "@/lib/kpi/resolve";
import { pacing } from "@/lib/kpi/core";
import { bucketOf, METRIC_KEYS, type MetricKey } from "@/domain/metrics";
import {
  loadAdMetrics,
  loadCalls,
  loadGoalForMonth,
  loadMembersByRole,
  loadOverrides,
  loadSetterActivity,
  loadSuggestions,
  toCallRecords,
} from "@/lib/data/dashboards";
import { monthEndIso, monthStartIso, todayIso, daysAgoIso } from "@/lib/format";

export type MetricFormat = "money" | "percent" | "number" | "multiple";
export type Tone = "green" | "violet" | "amber" | "sky" | "rose" | "blue";
export type GoalTone = "green" | "amber" | "red";

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
  goal?: { target: number; progress: number; tone: GoalTone };
  suggestion?: { id: string; value: number | null; rationale: string };
  /** Daily trend for an inline sparkline (hero cards only). */
  spark?: number[];
  /** Today vs. yesterday, for additive counts/money where a daily delta is meaningful. */
  trend?: { direction: "up" | "down" | "flat"; pct: number };
}

export interface LeaderboardRow {
  userId: string;
  name: string;
  callsTaken: number;
  dealsWon: number;
  closeRate: number;
  showUpRate: number;
  revenue: number;
}

export interface SetterSummaryRow {
  userId: string;
  name: string;
  conversations: number;
  replies: number;
  proposals: number;
  callsBooked: number;
  followUps: number;
}

export interface MasterView {
  currency: string;
  periodStart: string;
  periodEnd: string;
  cards: KpiCardVM[];
  revenueTrend: { date: string; revenue: number }[];
  moneyTrend: { date: string; revenue: number; cash: number }[];
  /** Closers ranked by revenue this period (Top Performers Leaderboard). */
  leaderboard: LeaderboardRow[];
  /** Per-setter activity totals this period (admin-only summary). */
  setterSummary: SetterSummaryRow[];
}

/**
 * The 12 Master KPI cards, matching the scope PDF's "12 key performance
 * numbers" and the Master KPIs screenshot (Metrics/Master KPIs.jpeg).
 */
const CARD_DEFS: { key: MetricKey; label: string; format: MetricFormat; tone: Tone }[] = [
  { key: METRIC_KEYS.revenue, label: "Total Revenue", format: "money", tone: "green" },
  { key: METRIC_KEYS.dealsWon, label: "Total Deals Won", format: "number", tone: "green" },
  { key: METRIC_KEYS.bookedCalls, label: "Booked Calls", format: "number", tone: "sky" },
  { key: METRIC_KEYS.revenuePacing, label: "Pacing", format: "money", tone: "blue" },
  { key: METRIC_KEYS.cashCollected, label: "Total Cash Collected", format: "money", tone: "violet" },
  { key: METRIC_KEYS.adSpend, label: "Ad Spend", format: "money", tone: "amber" },
  { key: METRIC_KEYS.callsTaken, label: "Calls Taken", format: "number", tone: "sky" },
  { key: METRIC_KEYS.roasRev, label: "ROAS", format: "multiple", tone: "green" },
  { key: METRIC_KEYS.closeRate, label: "Close Rate", format: "percent", tone: "green" },
  { key: METRIC_KEYS.avgDealSize, label: "Avg Deal Size", format: "money", tone: "sky" },
  { key: METRIC_KEYS.noShowRate, label: "No-Shows", format: "percent", tone: "rose" },
  { key: METRIC_KEYS.costPerFollower, label: "Cost / Follower", format: "money", tone: "rose" },
];

/** Metrics that get an inline sparkline (the hero cards). */
const SPARK_KEYS = new Set<MetricKey>([
  METRIC_KEYS.revenue,
  METRIC_KEYS.closeRate,
  METRIC_KEYS.cashCollected,
]);

/**
 * Cards where a same-metric day-over-day arrow is meaningful: additive counts
 * and money totals. Ratio/derived cards (Close Rate, Avg Deal Size, No-Shows,
 * ROAS, Cost/Follower, Pacing) are too noisy on a single day's volume to show
 * a reliable daily arrow, so they're intentionally excluded here.
 */
const TREND_KEYS = new Set<MetricKey>([
  METRIC_KEYS.revenue,
  METRIC_KEYS.cashCollected,
  METRIC_KEYS.dealsWon,
  METRIC_KEYS.callsTaken,
  METRIC_KEYS.bookedCalls,
  METRIC_KEYS.adSpend,
]);

/** Goal progress → color state. Thresholds are a reasonable default (not client-specified). */
function goalToneFor(progress: number): GoalTone {
  if (progress >= 0.9) return "green";
  if (progress >= 0.6) return "amber";
  return "red";
}

function trendFor(today: number, yesterday: number): { direction: "up" | "down" | "flat"; pct: number } {
  if (yesterday === 0) {
    if (today === 0) return { direction: "flat", pct: 0 };
    return { direction: "up", pct: 100 };
  }
  const pct = ((today - yesterday) / Math.abs(yesterday)) * 100;
  if (Math.abs(pct) < 0.5) return { direction: "flat", pct: 0 };
  return { direction: pct > 0 ? "up" : "down", pct: Math.abs(pct) };
}

/**
 * Assembles the master dashboard view: computed KPIs (always recalculated),
 * the effective value after any manual/AI override (resolved at read time),
 * monthly goal progress, the latest AI suggestion per metric, the closer
 * leaderboard, and the admin-only setter activity summary.
 */
export async function computeMasterView(
  clientId: string,
  currency: string,
): Promise<MasterView> {
  const periodStart = monthStartIso();
  const periodEnd = monthEndIso();
  const today = todayIso();
  const yesterday = daysAgoIso(1);
  const fx = getProviders().fx;

  const [callRows, adRows, setterRows, goal, overrides, suggestions, closers, setters] =
    await Promise.all([
      loadCalls(clientId, periodStart, today),
      loadAdMetrics(clientId, periodStart, today),
      loadSetterActivity(clientId, periodStart, today),
      loadGoalForMonth(clientId, periodStart),
      loadOverrides(clientId, periodStart, periodEnd),
      loadSuggestions(clientId, periodStart, periodEnd),
      loadMembersByRole(clientId, "closer"),
      loadMembersByRole(clientId, "setter"),
    ]);

  const callRecords = toCallRecords(callRows);
  const sales = await computeSalesKpis(callRecords, currency, fx);
  const bookedCalls = setterRows.reduce((s, r) => s + r.callsBooked, 0);
  const newConversations = setterRows.reduce((s, r) => s + r.conversations, 0);
  const ads = await computeAdKpis(adRows, currency, fx, {
    revenue: sales.revenue,
    cashCollected: sales.cashCollected,
    callsTaken: sales.callsTaken,
    closedDeals: sales.closedDeals,
    newConversations,
  });

  const daysElapsed = new Date(`${today}T00:00:00Z`).getUTCDate();
  const daysInMonth = new Date(`${periodEnd}T00:00:00Z`).getUTCDate();
  const revenuePacing = pacing(sales.revenue, daysElapsed, daysInMonth);

  const computedByKey: Partial<Record<MetricKey, number>> = {
    [METRIC_KEYS.revenue]: sales.revenue,
    [METRIC_KEYS.dealsWon]: sales.closedDeals,
    [METRIC_KEYS.bookedCalls]: bookedCalls,
    [METRIC_KEYS.revenuePacing]: revenuePacing,
    [METRIC_KEYS.cashCollected]: sales.cashCollected,
    [METRIC_KEYS.adSpend]: ads.adSpend,
    [METRIC_KEYS.callsTaken]: sales.callsTaken,
    [METRIC_KEYS.roasRev]: ads.roasRev,
    [METRIC_KEYS.closeRate]: sales.closeRate,
    [METRIC_KEYS.avgDealSize]: sales.avgDealSize,
    [METRIC_KEYS.noShowRate]: sales.noShowRate,
    [METRIC_KEYS.costPerFollower]: ads.costPerFollower,
  };

  const latestSuggestionByKey = new Map<string, (typeof suggestions)[number]>();
  for (const s of suggestions) {
    if (s.status === "pending" && !latestSuggestionByKey.has(s.targetKey)) {
      latestSuggestionByKey.set(s.targetKey, s);
    }
  }

  // Daily series (oldest → newest) for trends + KPI sparklines. Money is
  // FX-converted per row so mixed-currency clients roll up correctly.
  const revByDate = new Map<string, number>();
  const cashByDate = new Map<string, number>();
  const spendByDate = new Map<string, number>();
  const bookedByDate = new Map<string, number>();
  const dayCounts = new Map<string, { closed: number; shown: number; taken: number; noShow: number }>();

  for (const c of callRecords) {
    const bucket = bucketOf(c.outcome);
    if (bucket === "closed") {
      const rev = await fx.convert(c.revenue, c.currency, currency);
      const cash = await fx.convert(c.cashCollected, c.currency, currency);
      revByDate.set(c.date, (revByDate.get(c.date) ?? 0) + rev);
      cashByDate.set(c.date, (cashByDate.get(c.date) ?? 0) + cash);
    }
    const dc = dayCounts.get(c.date) ?? { closed: 0, shown: 0, taken: 0, noShow: 0 };
    if (bucket !== "rescheduled") dc.taken += 1;
    if (bucket === "closed") dc.closed += 1;
    if (bucket === "closed" || bucket === "showed_not_closed") dc.shown += 1;
    if (bucket === "no_show") dc.noShow += 1;
    dayCounts.set(c.date, dc);
  }
  const activeAdRows = adRows.filter((r) => r.status !== "archived" && r.status !== "deleted");
  for (const r of activeAdRows) {
    const spend = await fx.convert(r.spend, r.currency, currency);
    spendByDate.set(r.date, (spendByDate.get(r.date) ?? 0) + spend);
  }
  for (const r of setterRows) {
    bookedByDate.set(r.date, (bookedByDate.get(r.date) ?? 0) + r.callsBooked);
  }

  const dates = [...new Set([...revByDate.keys(), ...cashByDate.keys(), ...dayCounts.keys()])].sort();
  const sparkByKey: Partial<Record<MetricKey, number[]>> = {
    [METRIC_KEYS.revenue]: dates.map((d) => Math.round(revByDate.get(d) ?? 0)),
    [METRIC_KEYS.cashCollected]: dates.map((d) => Math.round(cashByDate.get(d) ?? 0)),
    [METRIC_KEYS.closeRate]: dates.map((d) => {
      const dc = dayCounts.get(d);
      return dc && dc.shown > 0 ? Math.round((dc.closed / dc.shown) * 100) : 0;
    }),
  };

  function trendValue(key: MetricKey, date: string): number {
    switch (key) {
      case METRIC_KEYS.revenue:
        return revByDate.get(date) ?? 0;
      case METRIC_KEYS.cashCollected:
        return cashByDate.get(date) ?? 0;
      case METRIC_KEYS.dealsWon:
        return dayCounts.get(date)?.closed ?? 0;
      case METRIC_KEYS.callsTaken:
        return dayCounts.get(date)?.taken ?? 0;
      case METRIC_KEYS.bookedCalls:
        return bookedByDate.get(date) ?? 0;
      case METRIC_KEYS.adSpend:
        return spendByDate.get(date) ?? 0;
      default:
        return 0;
    }
  }

  const cards: KpiCardVM[] = CARD_DEFS.map((def) => {
    const computed = computedByKey[def.key] ?? 0;
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
      trend: TREND_KEYS.has(def.key)
        ? trendFor(trendValue(def.key, today), trendValue(def.key, yesterday))
        : undefined,
    };

    if (goal && def.key === METRIC_KEYS.revenue) {
      const progress = goal.revenueGoal ? resolved.effective / goal.revenueGoal : 0;
      card.goal = { target: goal.revenueGoal, progress, tone: goalToneFor(progress) };
    }
    if (goal && def.key === METRIC_KEYS.bookedCalls) {
      const progress = goal.callsGoal ? resolved.effective / goal.callsGoal : 0;
      card.goal = { target: goal.callsGoal, progress, tone: goalToneFor(progress) };
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

  // Top Performers Leaderboard: closers ranked by revenue this period.
  const closerNameById = new Map(closers.map((c) => [c.id, c.fullName ?? "Unknown"]));
  const callsByCloser = new Map<string, typeof callRows>();
  for (const c of callRows) {
    if (!c.closerUserId) continue;
    const list = callsByCloser.get(c.closerUserId) ?? [];
    list.push(c);
    callsByCloser.set(c.closerUserId, list);
  }
  const leaderboard: LeaderboardRow[] = [];
  for (const [userId, rows] of callsByCloser) {
    const k = await computeSalesKpis(toCallRecords(rows), currency, fx);
    leaderboard.push({
      userId,
      name: closerNameById.get(userId) ?? "Unknown",
      callsTaken: k.callsTaken,
      dealsWon: k.closedDeals,
      closeRate: k.closeRate,
      showUpRate: k.showUpRate,
      revenue: k.revenue,
    });
  }
  leaderboard.sort((a, b) => b.revenue - a.revenue);

  // Setter activity summary (admin-only view on Master).
  const setterNameById = new Map(setters.map((s) => [s.id, s.fullName ?? "Unknown"]));
  const bySetterUser = new Map<string, typeof setterRows>();
  for (const r of setterRows) {
    const list = bySetterUser.get(r.setterUserId) ?? [];
    list.push(r);
    bySetterUser.set(r.setterUserId, list);
  }
  const setterSummary: SetterSummaryRow[] = [...bySetterUser.entries()]
    .map(([userId, rows]) => ({
      userId,
      name: setterNameById.get(userId) ?? "Unknown",
      conversations: rows.reduce((s, r) => s + r.conversations, 0),
      replies: rows.reduce((s, r) => s + r.replies, 0),
      proposals: rows.reduce((s, r) => s + r.proposals, 0),
      callsBooked: rows.reduce((s, r) => s + r.callsBooked, 0),
      followUps: rows.reduce((s, r) => s + r.followUps, 0),
    }))
    .sort((a, b) => b.callsBooked - a.callsBooked);

  return {
    currency,
    periodStart,
    periodEnd,
    cards,
    revenueTrend,
    moneyTrend,
    leaderboard,
    setterSummary,
  };
}
