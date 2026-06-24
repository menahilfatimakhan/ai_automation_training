import type { FxProvider } from "@/providers/ports/fx-provider";
import type {
  AdMetricRecord,
  CallRecord,
  SetterActivityRecord,
} from "@/domain/metrics";
import {
  avgDealSize,
  bookingRate,
  closeRate,
  costPerCall,
  noShowRate,
  proposalRate,
  replyRate,
  roas,
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
  const c: OutcomeCounts = { total: 0, closed: 0, rescheduled: 0, lost: 0, noShow: 0 };
  for (const call of calls) {
    c.total++;
    if (call.outcome === "closed") c.closed++;
    else if (call.outcome === "rescheduled") c.rescheduled++;
    else if (call.outcome === "lost") c.lost++;
    else if (call.outcome === "no_show") c.noShow++;
  }
  return c;
}

export interface SalesKpis {
  currency: string;
  revenue: number;
  cashCollected: number;
  totalCalls: number;
  closedDeals: number;
  closeRate: number;
  avgDealSize: number;
  noShows: number;
  noShowRate: number;
}

export async function computeSalesKpis(
  calls: CallRecord[],
  targetCurrency: string,
  fx: FxProvider,
): Promise<SalesKpis> {
  const counts = tallyOutcomes(calls);
  const closed = calls.filter((c) => c.outcome === "closed");

  const revenue = await sumInCurrency(
    closed.map((c) => ({ amount: c.revenue, currency: c.currency })),
    targetCurrency,
    fx,
  );
  const cashCollected = await sumInCurrency(
    calls.map((c) => ({ amount: c.cashCollected, currency: c.currency })),
    targetCurrency,
    fx,
  );

  return {
    currency: targetCurrency,
    revenue,
    cashCollected,
    totalCalls: counts.total,
    closedDeals: counts.closed,
    closeRate: closeRate(counts),
    avgDealSize: avgDealSize(revenue, counts.closed),
    noShows: counts.noShow,
    noShowRate: noShowRate(counts),
  };
}

export interface AdKpis {
  currency: string;
  adSpend: number;
  results: number;
  roas: number;
  costPerCall: number;
}

/**
 * Ad KPIs. `attributedRevenue` and `callsBooked` are supplied by the caller
 * (from sales/setter data already in the target currency / counts), keeping the
 * ad layer decoupled from how revenue is attributed.
 */
export async function computeAdKpis(
  rows: AdMetricRecord[],
  targetCurrency: string,
  fx: FxProvider,
  opts: { attributedRevenue: number; callsBooked: number },
): Promise<AdKpis> {
  const adSpend = await sumInCurrency(
    rows.map((r) => ({ amount: r.spend, currency: r.currency })),
    targetCurrency,
    fx,
  );
  const results = rows.reduce((sum, r) => sum + r.results, 0);

  return {
    currency: targetCurrency,
    adSpend,
    results,
    roas: roas(opts.attributedRevenue, adSpend),
    costPerCall: costPerCall(adSpend, opts.callsBooked),
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
    bookingRate: bookingRate(totals),
  };
}
