/**
 * Pure, synchronous KPI math. No I/O, no currency conversion, no provider
 * access — just arithmetic on numbers already in a single currency. These are
 * the functions the unit tests pin; the currency-aware layer (engine.ts) feeds
 * them converted amounts.
 *
 * Every formula here traces back to a documented section in
 * Metrics/KPI_Calculations.md — see docs/KPI_DISCREPANCIES.md for the mapping
 * from the old (incorrect) formulas to these.
 *
 * Convention: rates are returned as fractions (0.25 = 25%). Division by zero
 * yields 0 (a count/ratio over no activity is reported as zero, never NaN).
 */

export function safeDivide(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return numerator / denominator;
}

/**
 * Bucket + subtype counts for a period's calls. `total` includes Rescheduled;
 * every rate below is built from the narrower fields per the client's bucket
 * table (Rescheduled is excluded from every percentage).
 */
export interface OutcomeCounts {
  total: number;
  /** Paid in Full + Split Pay. */
  closed: number;
  /** Offer Declined + Not a Fit + Deposit Only. */
  showedNotClosed: number;
  /** No-Show + Cancelled. */
  noShow: number;
  rescheduled: number;
  // Subtypes needed for PIF % and Deposits.
  paidInFull: number;
  splitPay: number;
  depositOnly: number;
}

export function emptyOutcomeCounts(): OutcomeCounts {
  return {
    total: 0,
    closed: 0,
    showedNotClosed: 0,
    noShow: 0,
    rescheduled: 0,
    paidInFull: 0,
    splitPay: 0,
    depositOnly: 0,
  };
}

/** Calls Taken = every call except Rescheduled. */
export function callsTaken(c: OutcomeCounts): number {
  return c.total - c.rescheduled;
}

/** Calls Shown = Closed + Showed-but-didn't-close (the prospect attended). */
export function callsShown(c: OutcomeCounts): number {
  return c.closed + c.showedNotClosed;
}

/** Close Rate = Won / Calls Shown. Excludes No-show AND Rescheduled. */
export function closeRate(c: OutcomeCounts): number {
  return safeDivide(c.closed, callsShown(c));
}

/** Show-Up Rate = Calls Shown / (Calls Shown + No-shows). */
export function showUpRate(c: OutcomeCounts): number {
  return safeDivide(callsShown(c), callsShown(c) + c.noShow);
}

/** No-show rate, same denominator family as Show-Up Rate (its complement). */
export function noShowRate(c: OutcomeCounts): number {
  return safeDivide(c.noShow, callsShown(c) + c.noShow);
}

/** PIF % = Paid in Full deals / total closed deals. */
export function pifPct(c: OutcomeCounts): number {
  return safeDivide(c.paidInFull, c.closed);
}

/** Deposits estimated value = average deal size * deposit count. */
export function depositsValue(avgDeal: number, depositCount: number): number {
  return avgDeal * depositCount;
}

/** Average deal size = total revenue / number of closed deals. */
export function avgDealSize(totalRevenue: number, closedDeals: number): number {
  return safeDivide(totalRevenue, closedDeals);
}

/** Average cash = total cash collected / number of closed deals. */
export function avgCash(totalCash: number, closedDeals: number): number {
  return safeDivide(totalCash, closedDeals);
}

/** Revenue per Call = total revenue / Calls Shown. */
export function revenuePerCall(totalRevenue: number, shown: number): number {
  return safeDivide(totalRevenue, shown);
}

/** Cash per Call = total cash collected / Calls Shown. */
export function cashPerCall(totalCash: number, shown: number): number {
  return safeDivide(totalCash, shown);
}

/** Cash Upfront % = cash collected / revenue booked. */
export function cashUpfrontPct(cash: number, revenue: number): number {
  return safeDivide(cash, revenue);
}

/** ROAS Cash = cash collected / ad spend. */
export function roasCash(cash: number, adSpend: number): number {
  return safeDivide(cash, adSpend);
}

/** ROAS Rev = revenue booked / ad spend. */
export function roasRev(revenue: number, adSpend: number): number {
  return safeDivide(revenue, adSpend);
}

/** Cost per Call = ad spend / Calls Taken (outcome != Rescheduled). */
export function costPerCall(adSpend: number, taken: number): number {
  return safeDivide(adSpend, taken);
}

/** Cost per Conversation = ad spend / new conversations (setter logs). */
export function costPerConversation(adSpend: number, newConversations: number): number {
  return safeDivide(adSpend, newConversations);
}

/** Cost per Customer = ad spend / deals closed. */
export function costPerCustomer(adSpend: number, closedDeals: number): number {
  return safeDivide(adSpend, closedDeals);
}

/** Cost per Follower = ad spend / net new followers over the period. */
export function costPerFollower(adSpend: number, followersGained: number): number {
  return safeDivide(adSpend, followersGained);
}

/**
 * Pacing = (value-to-date / days elapsed) * days in month — a projected
 * end-of-month figure from the current daily rate. Not a measurement.
 */
export function pacing(valueToDate: number, daysElapsed: number, daysInMonth: number): number {
  if (daysElapsed <= 0) return 0;
  return (valueToDate / daysElapsed) * daysInMonth;
}

/** Impression-weighted average of a per-day metric (used for CTR/CPM/CPC rollups). */
export function impressionWeightedAverage(rows: { value: number; impressions: number }[]): number {
  const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);
  if (!totalImpressions) return 0;
  const weighted = rows.reduce((s, r) => s + r.value * r.impressions, 0);
  return weighted / totalImpressions;
}

// ─── Setter conversion rates ─────────────────────────────────────────────────
export interface SetterTotals {
  conversations: number;
  replies: number;
  proposals: number;
  callsBooked: number;
  followUps: number;
}

/** Lead/Response % = responses / new conversations. */
export function replyRate(t: SetterTotals): number {
  return safeDivide(t.replies, t.conversations);
}

/** Proposal/Response % = proposals / responses. */
export function proposalRate(t: SetterTotals): number {
  return safeDivide(t.proposals, t.replies);
}

/** Call/Proposal % = calls booked / proposals. */
export function callProposalRate(t: SetterTotals): number {
  return safeDivide(t.callsBooked, t.proposals);
}

/** Call/Lead % = calls booked / new conversations (end-to-end funnel efficiency). */
export function bookingRate(t: SetterTotals): number {
  return safeDivide(t.callsBooked, t.conversations);
}
