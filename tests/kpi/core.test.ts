import { describe, expect, it } from "vitest";
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
  pacing,
  pifPct,
  proposalRate,
  replyRate,
  revenuePerCall,
  roasCash,
  roasRev,
  safeDivide,
  showUpRate,
  type OutcomeCounts,
  type SetterTotals,
} from "@/lib/kpi/core";

describe("kpi core math", () => {
  it("safeDivide returns 0 on zero denominator (never NaN/Infinity)", () => {
    expect(safeDivide(5, 0)).toBe(0);
    expect(safeDivide(0, 0)).toBe(0);
    expect(safeDivide(10, 4)).toBe(2.5);
  });

  // Julie Bundgaard's April 2026 call log, from Metrics/KPI_Calculations.md —
  // 12 calls taken, 9 shown (4 closed + 5 showed-but-didn't-close), 3 no-shows.
  const julie: OutcomeCounts = {
    ...emptyOutcomeCounts(),
    total: 12,
    closed: 4,
    showedNotClosed: 5,
    noShow: 3,
    rescheduled: 0,
    paidInFull: 2,
    splitPay: 2,
    depositOnly: 0,
  };

  it("callsTaken excludes rescheduled", () => {
    expect(callsTaken(julie)).toBe(12);
    expect(callsTaken({ ...julie, total: 14, rescheduled: 2 })).toBe(12);
  });

  it("callsShown = closed + showed-but-didn't-close", () => {
    expect(callsShown(julie)).toBe(9);
  });

  it("closeRate = Won / Calls Shown (excludes no-shows AND rescheduled)", () => {
    expect(closeRate(julie)).toBeCloseTo(0.444, 3);
  });

  it("showUpRate = Calls Shown / (Calls Shown + No-shows)", () => {
    expect(showUpRate(julie)).toBeCloseTo(0.75, 6);
  });

  it("noShowRate is the complement of showUpRate", () => {
    expect(noShowRate(julie)).toBeCloseTo(0.25, 6);
  });

  it("pifPct = Paid in Full / total closed deals", () => {
    expect(pifPct(julie)).toBeCloseTo(0.5, 6);
  });

  it("depositsValue = avg deal size * deposit count", () => {
    expect(depositsValue(10950, 0)).toBe(0);
    expect(depositsValue(1000, 3)).toBe(3000);
  });

  it("avgDealSize = revenue / closed deals (Julie: 43,800 / 4 = 10,950)", () => {
    expect(avgDealSize(43800, 4)).toBe(10950);
    expect(avgDealSize(9000, 0)).toBe(0);
  });

  it("avgCash = cash / closed deals (Julie: 23,400 / 4 = 5,850)", () => {
    expect(avgCash(23400, 4)).toBe(5850);
  });

  it("revenuePerCall = revenue / Calls Shown (Julie: 43,800 / 9 = 4,866.67)", () => {
    expect(revenuePerCall(43800, 9)).toBeCloseTo(4866.67, 2);
  });

  it("cashPerCall = cash / Calls Shown (Julie: 23,400 / 9 = 2,600)", () => {
    expect(cashPerCall(23400, 9)).toBeCloseTo(2600, 6);
  });

  it("cashUpfrontPct = cash / revenue (Julie: 23,400 / 43,800 = 53.4%)", () => {
    expect(cashUpfrontPct(23400, 43800)).toBeCloseTo(0.534, 3);
  });

  it("roasCash / roasRev are distinct ratios", () => {
    expect(roasCash(5164.9, 11062.99)).toBeCloseTo(0.47, 2);
    expect(roasRev(9859.94, 11062.99)).toBeCloseTo(0.89, 2);
  });

  it("costPerCall = spend / Calls Taken (not calls booked)", () => {
    expect(costPerCall(11062.99, 13)).toBeCloseTo(851.0, 1);
  });

  it("costPerConversation = spend / new conversations", () => {
    expect(costPerConversation(11062.99, 1486)).toBeCloseTo(7.44, 2);
  });

  it("costPerCustomer = spend / deals closed", () => {
    expect(costPerCustomer(11062.99, 5)).toBeCloseTo(2212.6, 1);
  });

  it("costPerFollower = spend / followers gained; 0 gained -> 0 (never NaN)", () => {
    expect(costPerFollower(1000, 0)).toBe(0);
    expect(costPerFollower(1000, 200)).toBe(5);
  });

  it("pacing projects month-end from the current daily rate", () => {
    // Apr 21: revenue-to-date $6,429.97, 21 days elapsed, 30 days in April.
    expect(pacing(6429.97, 21, 30)).toBeCloseTo(9185.67, 1);
    expect(pacing(100, 0, 30)).toBe(0);
  });

  it("impressionWeightedAverage weights by each row's impressions", () => {
    const rows = [
      { value: 0.01, impressions: 100000 },
      { value: 0.05, impressions: 10000 },
    ];
    // (0.01*100000 + 0.05*10000) / 110000 = 1500/110000
    expect(impressionWeightedAverage(rows)).toBeCloseTo(1500 / 110000, 6);
    expect(impressionWeightedAverage([])).toBe(0);
  });

  const setter: SetterTotals = {
    conversations: 479,
    replies: 198,
    proposals: 58,
    callsBooked: 21,
    followUps: 359,
  };

  it("setter conversion rates match Julie's setter (Karoline) worked example", () => {
    expect(replyRate(setter)).toBeCloseTo(0.413, 3); // Lead/Response %
    expect(proposalRate(setter)).toBeCloseTo(0.293, 3); // Proposal/Response %
    expect(callProposalRate(setter)).toBeCloseTo(0.362, 3); // Call/Proposal %
    expect(bookingRate(setter)).toBeCloseTo(0.044, 3); // Call/Lead %
  });
});
