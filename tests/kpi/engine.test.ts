import { describe, expect, it } from "vitest";
import { MockFxProvider } from "@/providers/fx/mock-fx-provider";
import {
  computeAdKpis,
  computeSalesKpis,
  computeSetterKpis,
} from "@/lib/kpi/engine";
import type { AdMetricRecord, CallRecord, SetterActivityRecord } from "@/domain/metrics";

const fx = new MockFxProvider();

const calls: CallRecord[] = [
  { outcome: "closed", revenue: 5000, cashCollected: 5000, currency: "USD", date: "2026-06-01" },
  { outcome: "closed", revenue: 3000, cashCollected: 1500, currency: "USD", date: "2026-06-02" },
  { outcome: "lost", revenue: 0, cashCollected: 0, currency: "USD", date: "2026-06-03" },
  { outcome: "no_show", revenue: 0, cashCollected: 0, currency: "USD", date: "2026-06-04" },
  { outcome: "rescheduled", revenue: 0, cashCollected: 0, currency: "USD", date: "2026-06-05" },
];

describe("computeSalesKpis", () => {
  it("aggregates revenue, cash, and outcome-based rates", async () => {
    const k = await computeSalesKpis(calls, "USD", fx);
    expect(k.revenue).toBe(8000);
    expect(k.cashCollected).toBe(6500);
    expect(k.totalCalls).toBe(5);
    expect(k.closedDeals).toBe(2);
    // 2 closed / (5 - 1 no_show) = 0.5
    expect(k.closeRate).toBeCloseTo(0.5, 6);
    expect(k.avgDealSize).toBe(4000);
    expect(k.noShows).toBe(1);
    expect(k.noShowRate).toBeCloseTo(0.2, 6);
  });

  it("converts mixed-currency revenue into the target currency", async () => {
    const mixed: CallRecord[] = [
      { outcome: "closed", revenue: 1000, cashCollected: 1000, currency: "USD", date: "2026-06-01" },
      { outcome: "closed", revenue: 1000, cashCollected: 1000, currency: "EUR", date: "2026-06-02" },
    ];
    const k = await computeSalesKpis(mixed, "USD", fx);
    // 1000 USD + 1000 EUR (EUR→USD rate 1.08/1) = 1000 + 1080 = 2080
    expect(k.revenue).toBeCloseTo(2080, 6);
  });
});

describe("computeAdKpis", () => {
  it("sums spend in target currency and derives ROAS / cost-per-call", async () => {
    const rows: AdMetricRecord[] = [
      { spend: 1000, results: 10, currency: "USD", date: "2026-06-01" },
      { spend: 1000, results: 5, currency: "USD", date: "2026-06-02" },
    ];
    const k = await computeAdKpis(rows, "USD", fx, {
      attributedRevenue: 8000,
      callsBooked: 20,
    });
    expect(k.adSpend).toBe(2000);
    expect(k.results).toBe(15);
    expect(k.roas).toBe(4); // 8000 / 2000
    expect(k.costPerCall).toBe(100); // 2000 / 20
  });
});

describe("computeSetterKpis", () => {
  it("sums activity and computes conversion rates", () => {
    const rows: SetterActivityRecord[] = [
      { conversations: 50, replies: 20, proposals: 5, callsBooked: 4, followUps: 10 },
      { conversations: 50, replies: 20, proposals: 5, callsBooked: 4, followUps: 15 },
    ];
    const k = computeSetterKpis(rows);
    expect(k.conversations).toBe(100);
    expect(k.replyRate).toBeCloseTo(0.4, 6);
    expect(k.proposalRate).toBeCloseTo(0.25, 6);
    expect(k.bookingRate).toBeCloseTo(0.08, 6);
  });
});
