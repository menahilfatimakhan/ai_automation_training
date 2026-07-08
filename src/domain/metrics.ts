/**
 * Inputs and identifiers for the KPI engine. The engine reads ONLY normalized
 * domain rows (never a provider), and every money amount carries its currency.
 */

/**
 * The 8 literal call outcomes from the client's KPI spec
 * (Metrics/KPI_Calculations.md, "The four call-outcome buckets").
 */
export type CallOutcome =
  | "paid_in_full"
  | "split_pay"
  | "offer_declined"
  | "not_a_fit"
  | "deposit_only"
  | "no_show"
  | "cancelled"
  | "rescheduled";

export const CALL_OUTCOMES: readonly CallOutcome[] = [
  "paid_in_full",
  "split_pay",
  "offer_declined",
  "not_a_fit",
  "deposit_only",
  "no_show",
  "cancelled",
  "rescheduled",
];

/** Shared display labels — used by every outcome dropdown/badge in the app. */
export const OUTCOME_LABELS: Record<CallOutcome, string> = {
  paid_in_full: "Paid in Full",
  split_pay: "Split Pay",
  offer_declined: "Offer Declined",
  not_a_fit: "Not a Fit",
  deposit_only: "Deposit Only",
  no_show: "No-Show",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
};

export const OBJECTION_LABELS: Record<ObjectionType, string> = {
  think_about_it: "Think About It",
  money: "Money",
  time: "Time",
  partner: "Partner",
  fear: "Fear",
  value: "Value",
};

/** The 4 buckets every percentage/rate formula groups outcomes into. */
export type OutcomeBucket = "closed" | "showed_not_closed" | "no_show" | "rescheduled";

/** Canonical outcome → bucket mapping. The single source of truth for bucketing. */
export function bucketOf(outcome: CallOutcome): OutcomeBucket {
  switch (outcome) {
    case "paid_in_full":
    case "split_pay":
      return "closed";
    case "offer_declined":
    case "not_a_fit":
    case "deposit_only":
      return "showed_not_closed";
    case "no_show":
    case "cancelled":
      return "no_show";
    case "rescheduled":
      return "rescheduled";
  }
}

/** The 6 controlled-vocabulary objection categories (Sales & Closing screenshot). */
export type ObjectionType = "think_about_it" | "money" | "time" | "partner" | "fear" | "value";

export const OBJECTION_TYPES: readonly ObjectionType[] = [
  "think_about_it",
  "money",
  "time",
  "partner",
  "fear",
  "value",
];

export interface CallRecord {
  outcome: CallOutcome;
  revenue: number;
  cashCollected: number;
  currency: string;
  date: string;
  /** Set when outcome bucket is "showed_not_closed" (Offer Declined / Not a Fit). */
  objectionType?: ObjectionType | null;
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
  impressions: number;
  ctr: number;
  /** New followers gained this day, when the ads tracker/provider reports it. */
  newFollowers: number | null;
  currency: string;
  date: string;
  status: "active" | "paused" | "archived" | "deleted";
}

/** Stable metric_key values used when persisting computed KPIs / overrides. */
export const METRIC_KEYS = {
  // Master / Sales
  revenue: "revenue",
  cashCollected: "cash_collected",
  dealsWon: "deals_won",
  dealsLost: "deals_lost",
  callsTaken: "calls_taken",
  bookedCalls: "booked_calls",
  closeRate: "close_rate",
  showUpRate: "show_up_rate",
  deposits: "deposits",
  depositsValue: "deposits_value",
  revenuePerCall: "revenue_per_call",
  cashPerCall: "cash_per_call",
  cashUpfrontPct: "cash_upfront_pct",
  pifPct: "pif_pct",
  avgDealSize: "avg_deal_size",
  avgCash: "avg_cash",
  noShowRate: "no_show_rate",
  revenuePacing: "revenue_pacing",
  bookedCallsPacing: "booked_calls_pacing",
  objectionThinkAboutIt: "objection_think_about_it",
  objectionMoney: "objection_money",
  objectionTime: "objection_time",
  objectionPartner: "objection_partner",
  objectionFear: "objection_fear",
  objectionValue: "objection_value",

  // Ads
  adSpend: "ad_spend",
  totalLeads: "total_leads",
  totalFollowers: "total_followers",
  costPerFollower: "cost_per_follower",
  costPerConversation: "cost_per_conversation",
  costPerCustomer: "cost_per_customer",
  roasCash: "roas_cash",
  roasRev: "roas_rev",
  costPerCall: "cost_per_call",
  ctr: "ctr",
  cpm: "cpm",
  cpc: "cpc",

  // Setter
  setterConversations: "setter_conversations",
  setterReplies: "setter_replies",
  setterProposals: "setter_proposals",
  setterFollowUps: "setter_follow_ups",
  setterReplyRate: "setter_reply_rate",
  setterProposalRate: "setter_proposal_rate",
  setterCallProposalRate: "setter_call_proposal_rate",
  setterBookingRate: "setter_booking_rate",
} as const;

export type MetricKey = (typeof METRIC_KEYS)[keyof typeof METRIC_KEYS];

/** Money metrics carry a currency; ratios/counts do not. */
export const MONEY_METRICS: ReadonlySet<MetricKey> = new Set([
  METRIC_KEYS.revenue,
  METRIC_KEYS.cashCollected,
  METRIC_KEYS.depositsValue,
  METRIC_KEYS.revenuePerCall,
  METRIC_KEYS.cashPerCall,
  METRIC_KEYS.avgDealSize,
  METRIC_KEYS.avgCash,
  METRIC_KEYS.revenuePacing,
  METRIC_KEYS.adSpend,
  METRIC_KEYS.costPerFollower,
  METRIC_KEYS.costPerConversation,
  METRIC_KEYS.costPerCustomer,
  METRIC_KEYS.costPerCall,
  METRIC_KEYS.cpm,
  METRIC_KEYS.cpc,
]);
