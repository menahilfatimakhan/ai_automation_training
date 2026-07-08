import type { FxProvider } from "@/providers/ports/fx-provider";
import type {
  AdMetricRecord,
  CallRecord,
  ObjectionType,
  SetterActivityRecord,
} from "@/domain/metrics";
import { bucketOf, OBJECTION_TYPES } from "@/domain/metrics";
import {
  avgCash,
  avgDealSize,
  bookingRate,
  callProposalRate,
  callsShown,
  callsTaken,
  cashPerCall,
  cashUpfrontPct,
  closeRate,
  costPerCall,
  costPerConversation,
  costPerCustomer,
  costPerFollower,
  depositsValue,
  emptyOutcomeCounts,
  impressionWeightedAverage,
  noShowRate,
  pifPct,
  proposalRate,
  replyRate,
  revenuePerCall,
  roasCash,
  roasRev,
  showUpRate,
  type OutcomeCounts,
  type SetterTotals,
} from "@/lib/kpi/core";

/**
 * Currency-aware KPI orchestration. Converts every money amount to the target
 * (client reporting) currency via the injected FxProvider, then delegates the
 * arithmetic to the pure core. The engine reads normalized domain rows only.
 */

/** Sum amounts that may be in mixed currencies into a single target currency. */
async function sumInCurrency(
  items: { amount: number; currency: string }[],
  target: string,
  fx: FxProvider,
): Promise<number> {
  let total = 0;
  for (const item of items) {
    total += await fx.convert(item.amount, item.currency, target);
  }
  return total;
}

function tallyOutcomes(calls: CallRecord[]): OutcomeCounts {
  const c = emptyOutcomeCounts();
  for (const call of calls) {
    c.total++;
    const bucket = bucketOf(call.outcome);
    if (bucket === "closed") c.closed++;
    else if (bucket === "showed_not_closed") c.showedNotClosed++;
    else if (bucket === "no_show") c.noShow++;
    else c.rescheduled++;

    if (call.outcome === "paid_in_full") c.paidInFull++;
    else if (call.outcome === "split_pay") c.splitPay++;
    else if (call.outcome === "deposit_only") c.depositOnly++;
  }
  return c;
}

/**
 * Objection counters: per the client's spec, these only ever count Offer
 * Declined + Not a Fit — Deposit Only is a partial commitment, not a decline,
 * so it's excluded even though it shares the "showed but didn't close" bucket.
 */
function tallyObjections(calls: CallRecord[]): Record<ObjectionType, number> {
  const counts = Object.fromEntries(OBJECTION_TYPES.map((t) => [t, 0])) as Record<
    ObjectionType,
    number
  >;
  for (const call of calls) {
    const isDeclineOutcome = call.outcome === "offer_declined" || call.outcome === "not_a_fit";
    if (isDeclineOutcome && call.objectionType) {
      counts[call.objectionType]++;
    }
  }
  return counts;
}

export interface SalesKpis {
  currency: string;
  revenue: number;
  cashCollected: number;
  callsTaken: number;
  callsShown: number;
  closedDeals: number;
  dealsLost: number;
  closeRate: number;
  showUpRate: number;
  noShowRate: number;
  deposits: number;
  depositsValue: number;
  pifPct: number;
  cashUpfrontPct: number;
  avgDealSize: number;
  avgCash: number;
  revenuePerCall: number;
  cashPerCall: number;
  objections: Record<ObjectionType, number>;
  noShows: number;
}

export async function computeSalesKpis(
  calls: CallRecord[],
  targetCurrency: string,
  fx: FxProvider,
): Promise<SalesKpis> {
  const counts = tallyOutcomes(calls);
  // Revenue / Cash Collected only ever count Closed deals (Paid in Full + Split Pay).
  const closed = calls.filter((c) => bucketOf(c.outcome) === "closed");

  const revenue = await sumInCurrency(
    closed.map((c) => ({ amount: c.revenue, currency: c.currency })),
    targetCurrency,
    fx,
  );
  const cashCollected = await sumInCurrency(
    closed.map((c) => ({ amount: c.cashCollected, currency: c.currency })),
    targetCurrency,
    fx,
  );

  const shown = callsShown(counts);
  const avgDeal = avgDealSize(revenue, counts.closed);

  return {
    currency: targetCurrency,
    revenue,
    cashCollected,
    callsTaken: callsTaken(counts),
    callsShown: shown,
    closedDeals: counts.closed,
    dealsLost: counts.showedNotClosed,
    closeRate: closeRate(counts),
    showUpRate: showUpRate(counts),
    noShowRate: noShowRate(counts),
    deposits: counts.depositOnly,
    depositsValue: depositsValue(avgDeal, counts.depositOnly),
    pifPct: pifPct(counts),
    cashUpfrontPct: cashUpfrontPct(cashCollected, revenue),
    avgDealSize: avgDeal,
    avgCash: avgCash(cashCollected, counts.closed),
    revenuePerCall: revenuePerCall(revenue, shown),
    cashPerCall: cashPerCall(cashCollected, shown),
    objections: tallyObjections(calls),
    noShows: counts.noShow,
  };
}

export interface AdKpis {
  currency: string;
  adSpend: number;
  /**
   * Sum of daily `results`. The client's fallback (recover a lead count from
   * spend / cost-per-result when Meta returns a zero result count) needs a raw
   * `cost_per_result` field from Meta's Insights API that our provider/
   * normalization layer doesn't capture yet — see docs/KPI_DISCREPANCIES.md.
   * This is a straight sum until that field is added upstream.
   */
  totalLeads: number;
  /** Net new followers gained over the period (sum of daily `newFollowers`). */
  followersGained: number;
  roasCash: number;
  roasRev: number;
  costPerCall: number;
  costPerConversation: number;
  costPerCustomer: number;
  costPerFollower: number;
  ctr: number;
  cpm: number;
  cpc: number;
}

/**
 * Ad KPIs. Revenue/cash/calls-taken/deals-closed/new-conversations are
 * supplied by the caller (from sales/setter data already in the target
 * currency / counts), keeping the ad layer decoupled from how those are
 * attributed. Archived and deleted campaigns are excluded from every metric
 * here, per "Ads Total Spend... excluding archived" in the client's spec.
 */
export async function computeAdKpis(
  rows: AdMetricRecord[],
  targetCurrency: string,
  fx: FxProvider,
  opts: {
    revenue: number;
    cashCollected: number;
    callsTaken: number;
    closedDeals: number;
    newConversations: number;
  },
): Promise<AdKpis> {
  const active = rows.filter((r) => r.status !== "archived" && r.status !== "deleted");

  const adSpend = await sumInCurrency(
    active.map((r) => ({ amount: r.spend, currency: r.currency })),
    targetCurrency,
    fx,
  );
  const totalLeads = active.reduce((sum, r) => sum + r.results, 0);
  const followersGained = active.reduce((sum, r) => sum + (r.newFollowers ?? 0), 0);
  const totalImpressions = active.reduce((sum, r) => sum + r.impressions, 0);
  const ctr = impressionWeightedAverage(
    active.map((r) => ({ value: r.ctr, impressions: r.impressions })),
  );
  // Clicks aren't stored directly; derive from CTR × impressions per day.
  const derivedClicks = active.reduce((sum, r) => sum + r.ctr * r.impressions, 0);
  const cpm = totalImpressions ? (adSpend / totalImpressions) * 1000 : 0;
  const cpc = derivedClicks ? adSpend / derivedClicks : 0;

  return {
    currency: targetCurrency,
    adSpend,
    totalLeads,
    followersGained,
    roasCash: roasCash(opts.cashCollected, adSpend),
    roasRev: roasRev(opts.revenue, adSpend),
    costPerCall: costPerCall(adSpend, opts.callsTaken),
    costPerConversation: costPerConversation(adSpend, opts.newConversations),
    costPerCustomer: costPerCustomer(adSpend, opts.closedDeals),
    costPerFollower: costPerFollower(adSpend, followersGained),
    ctr,
    cpm,
    cpc,
  };
}

export interface SetterKpis {
  conversations: number;
  replies: number;
  proposals: number;
  callsBooked: number;
  followUps: number;
  replyRate: number;
  proposalRate: number;
  callProposalRate: number;
  bookingRate: number;
}

/** Setter KPIs are currency-free counts/ratios; aggregated synchronously. */
export function computeSetterKpis(rows: SetterActivityRecord[]): SetterKpis {
  const totals: SetterTotals = rows.reduce(
    (acc, r) => ({
      conversations: acc.conversations + r.conversations,
      replies: acc.replies + r.replies,
      proposals: acc.proposals + r.proposals,
      callsBooked: acc.callsBooked + r.callsBooked,
      followUps: acc.followUps + r.followUps,
    }),
    { conversations: 0, replies: 0, proposals: 0, callsBooked: 0, followUps: 0 },
  );

  return {
    ...totals,
    replyRate: replyRate(totals),
    proposalRate: proposalRate(totals),
    callProposalRate: callProposalRate(totals),
    bookingRate: bookingRate(totals),
  };
}
