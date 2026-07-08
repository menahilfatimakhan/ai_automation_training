import { describe, expect, it } from "vitest";
import { MockFxProvider } from "@/providers/fx/mock-fx-provider";
import {
  computeAdKpis,
  computeSalesKpis,
  computeSetterKpis,
} from "@/lib/kpi/engine";
import type { AdMetricRecord, CallRecord, SetterActivityRecord } from "@/domain/metrics";

const fx = new MockFxProvider();

/**
 * Julie Bundgaard's full April 2026 call log, verbatim from
 * Metrics/KPI_Calculations.md. Every assertion below is pinned to a number
 * the client's own doc states explicitly — this is the closest thing to a
 * ground-truth regression fixture available before real seed data lands.
 */
const julieCalls: CallRecord[] = [
  { outcome: "split_pay", revenue: 11700, cashCollected: 1500, currency: "DKK", date: "2026-04-15" },
  { outcome: "paid_in_full", revenue: 10200, cashCollected: 10200, currency: "DKK", date: "2026-04-21" },
  { outcome: "offer_declined", revenue: 0, cashCollected: 0, currency: "DKK", date: "2026-04-24", objectionType: "money" },
  { outcome: "cancelled", revenue: 0, cashCollected: 0, currency: "DKK", date: "2026-04-24" },
  { outcome: "no_show", revenue: 0, cashCollected: 0, currency: "DKK", date: "2026-04-27" },
  { outcome: "offer_declined", revenue: 0, cashCollected: 0, currency: "DKK", date: "2026-04-27", objectionType: "money" },
  { outcome: "split_pay", revenue: 11700, cashCollected: 1500, currency: "DKK", date: "2026-04-27" },
  { outcome: "no_show", revenue: 0, cashCollected: 0, currency: "DKK", date: "2026-04-28" },
  { outcome: "not_a_fit", revenue: 0, cashCollected: 0, currency: "DKK", date: "2026-04-28" },
  { outcome: "paid_in_full", revenue: 10200, cashCollected: 10200, currency: "DKK", date: "2026-04-29" },
  { outcome: "offer_declined", revenue: 0, cashCollected: 0, currency: "DKK", date: "2026-04-29", objectionType: "think_about_it" },
  { outcome: "offer_declined", revenue: 0, cashCollected: 0, currency: "DKK", date: "2026-04-30" },
];

describe("computeSalesKpis — Julie Bundgaard April 2026 (KPI_Calculations.md)", () => {
  it("matches every headline number in the client's worked example", async () => {
    const k = await computeSalesKpis(julieCalls, "DKK", fx);

    expect(k.callsTaken).toBe(12);
    expect(k.callsShown).toBe(9);
    expect(k.closedDeals).toBe(4);
    expect(k.dealsLost).toBe(5);
    expect(k.noShows).toBe(3);
    expect(k.revenue).toBeCloseTo(43800, 6);
    expect(k.cashCollected).toBeCloseTo(23400, 6);
    expect(k.closeRate).toBeCloseTo(0.444, 3);
    expect(k.showUpRate).toBeCloseTo(0.75, 6);
    expect(k.pifPct).toBeCloseTo(0.5, 6);
    expect(k.cashUpfrontPct).toBeCloseTo(0.534, 3);
    expect(k.avgDealSize).toBeCloseTo(10950, 6);
    expect(k.avgCash).toBeCloseTo(5850, 6);
    expect(k.revenuePerCall).toBeCloseTo(4866.67, 2);
    expect(k.cashPerCall).toBeCloseTo(2600, 6);
    expect(k.deposits).toBe(0);
    expect(k.depositsValue).toBe(0);
  });

  it("objection counters only count Offer Declined + Not a Fit, tallied by type", async () => {
    const k = await computeSalesKpis(julieCalls, "DKK", fx);
    expect(k.objections.money).toBe(2);
    expect(k.objections.think_about_it).toBe(1);
    expect(k.objections.time).toBe(0);
    expect(k.objections.partner).toBe(0);
    expect(k.objections.fear).toBe(0);
    expect(k.objections.value).toBe(0);
  });

  it("converts mixed-currency revenue into the target currency", async () => {
    const mixed: CallRecord[] = [
      { outcome: "paid_in_full", revenue: 1000, cashCollected: 1000, currency: "USD", date: "2026-06-01" },
      { outcome: "paid_in_full", revenue: 1000, cashCollected: 1000, currency: "EUR", date: "2026-06-02" },
    ];
    const k = await computeSalesKpis(mixed, "USD", fx);
    // 1000 USD + 1000 EUR (EUR→USD rate 1.08/1) = 1000 + 1080 = 2080
    expect(k.revenue).toBeCloseTo(2080, 6);
  });

  it("rescheduled calls are excluded from every rate's denominator", async () => {
    const calls: CallRecord[] = [
      { outcome: "paid_in_full", revenue: 1000, cashCollected: 1000, currency: "USD", date: "2026-06-01" },
      { outcome: "rescheduled", revenue: 0, cashCollected: 0, currency: "USD", date: "2026-06-02" },
      { outcome: "rescheduled", revenue: 0, cashCollected: 0, currency: "USD", date: "2026-06-03" },
    ];
    const k = await computeSalesKpis(calls, "USD", fx);
    expect(k.callsTaken).toBe(1);
    expect(k.closeRate).toBe(1); // 1 closed / 1 shown, not diluted by the 2 reschedules
  });
});

describe("computeAdKpis", () => {
  const baseRow = {
    currency: "USD",
    ctr: 0.02,
    newFollowers: null as number | null,
    status: "active" as const,
  };
  const rows: AdMetricRecord[] = [
    { ...baseRow, spend: 1000, results: 10, impressions: 50000, date: "2026-06-01" },
    { ...baseRow, spend: 1000, results: 5, impressions: 50000, date: "2026-06-02" },
    // Archived spend must be excluded entirely.
    { ...baseRow, spend: 5000, results: 999, impressions: 999999, status: "archived", date: "2026-06-03" },
  ];

  it("excludes archived campaigns from spend, leads, and every derived ratio", async () => {
    const k = await computeAdKpis(rows, "USD", fx, {
      revenue: 8000,
      cashCollected: 4000,
      callsTaken: 20,
      closedDeals: 4,
      newConversations: 100,
    });
    expect(k.adSpend).toBe(2000);
    expect(k.totalLeads).toBe(15);
    expect(k.roasRev).toBe(4); // 8000 / 2000
    expect(k.roasCash).toBe(2); // 4000 / 2000
    expect(k.costPerCall).toBe(100); // 2000 / 20 calls TAKEN
    expect(k.costPerConversation).toBe(20); // 2000 / 100
    expect(k.costPerCustomer).toBe(500); // 2000 / 4
  });

  it("CTR is impression-weighted; CPM/CPC derive from spend and impressions", async () => {
    const k = await computeAdKpis(rows, "USD", fx, {
      revenue: 0,
      cashCollected: 0,
      callsTaken: 1,
      closedDeals: 1,
      newConversations: 1,
    });
    expect(k.ctr).toBeCloseTo(0.02, 6); // uniform 0.02 across both active rows
    expect(k.cpm).toBeCloseTo((2000 / 100000) * 1000, 6);
  });

  it("costPerFollower is 0 (not NaN) when no follower data is present", async () => {
    const k = await computeAdKpis(rows, "USD", fx, {
      revenue: 0,
      cashCollected: 0,
      callsTaken: 1,
      closedDeals: 1,
      newConversations: 1,
    });
    expect(k.followersGained).toBe(0);
    expect(k.costPerFollower).toBe(0);
  });
});

describe("computeSetterKpis", () => {
  it("sums activity and computes all four conversion rates", () => {
    const rows: SetterActivityRecord[] = [
      { conversations: 50, replies: 20, proposals: 5, callsBooked: 4, followUps: 10 },
      { conversations: 50, replies: 20, proposals: 5, callsBooked: 4, followUps: 15 },
    ];
    const k = computeSetterKpis(rows);
    expect(k.conversations).toBe(100);
    expect(k.followUps).toBe(25);
    expect(k.replyRate).toBeCloseTo(0.4, 6);
    expect(k.proposalRate).toBeCloseTo(0.25, 6);
    expect(k.callProposalRate).toBeCloseTo(0.8, 6); // 8/10
    expect(k.bookingRate).toBeCloseTo(0.08, 6);
  });
});
