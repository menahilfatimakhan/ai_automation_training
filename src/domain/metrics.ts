/**
 * Inputs and identifiers for the KPI engine. The engine reads ONLY normalized
 * domain rows (never a provider), and every money amount carries its currency.
 */

export interface CallRecord {
  outcome: "closed" | "rescheduled" | "lost" | "no_show";
  revenue: number;
  cashCollected: number;
  currency: string;
  date: string;
}

export interface SetterActivityRecord {
  conversations: number;
  replies: number;
  proposals: number;
  callsBooked: number;
  followUps: number;
}

export interface AdMetricRecord {
  spend: number;
  results: number;
  currency: string;
  date: string;
}

/** Stable metric_key values used when persisting computed KPIs / overrides. */
export const METRIC_KEYS = {
  revenue: "revenue",
  cashCollected: "cash_collected",
  totalCalls: "total_calls",
  closeRate: "close_rate",
  avgDealSize: "avg_deal_size",
  noShowRate: "no_show_rate",
  adSpend: "ad_spend",
  roas: "roas",
  costPerCall: "cost_per_call",
  callsBooked: "calls_booked",
  setterReplyRate: "setter_reply_rate",
  setterProposalRate: "setter_proposal_rate",
  setterBookingRate: "setter_booking_rate",
} as const;

export type MetricKey = (typeof METRIC_KEYS)[keyof typeof METRIC_KEYS];

/** Money metrics carry a currency; ratios/counts do not. */
export const MONEY_METRICS: ReadonlySet<MetricKey> = new Set([
  METRIC_KEYS.revenue,
  METRIC_KEYS.cashCollected,
  METRIC_KEYS.avgDealSize,
  METRIC_KEYS.adSpend,
  METRIC_KEYS.costPerCall,
]);
