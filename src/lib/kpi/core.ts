/**
 * Pure, synchronous KPI math. No I/O, no currency conversion, no provider
 * access — just arithmetic on numbers already in a single currency. These are
 * the functions the unit tests pin; the currency-aware layer (engine.ts) feeds
 * them converted amounts.
 *
 * Convention: rates are returned as fractions (0.25 = 25%). Division by zero
 * yields 0 (a count/ratio over no activity is reported as zero, never NaN).
 */

export function safeDivide(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return numerator / denominator;
}

export interface OutcomeCounts {
  total: number;
  closed: number;
  rescheduled: number;
  lost: number;
  noShow: number;
}

/**
 * Close rate = closed deals / calls actually taken. No-shows are excluded from
 * the denominator (you can't close a call that never happened).
 */
export function closeRate(c: OutcomeCounts): number {
  return safeDivide(c.closed, c.total - c.noShow);
}

/** Average deal size = total revenue / number of closed deals. */
export function avgDealSize(totalRevenue: number, closedDeals: number): number {
  return safeDivide(totalRevenue, closedDeals);
}

/** No-show rate = no-shows / total calls. */
export function noShowRate(c: OutcomeCounts): number {
  return safeDivide(c.noShow, c.total);
}

/** ROAS = revenue attributed / ad spend (same currency). */
export function roas(revenue: number, adSpend: number): number {
  return safeDivide(revenue, adSpend);
}

/** Cost per booked call = ad spend / calls booked. */
export function costPerCall(adSpend: number, callsBooked: number): number {
  return safeDivide(adSpend, callsBooked);
}

// ─── Setter conversion rates ─────────────────────────────────────────────────
export interface SetterTotals {
  conversations: number;
  replies: number;
  proposals: number;
  callsBooked: number;
  followUps: number;
}

/** Replies per conversation. */
export function replyRate(t: SetterTotals): number {
  return safeDivide(t.replies, t.conversations);
}

/** Proposals per reply. */
export function proposalRate(t: SetterTotals): number {
  return safeDivide(t.proposals, t.replies);
}

/** Booked calls per conversation (overall outreach → booking conversion). */
export function bookingRate(t: SetterTotals): number {
  return safeDivide(t.callsBooked, t.conversations);
}
