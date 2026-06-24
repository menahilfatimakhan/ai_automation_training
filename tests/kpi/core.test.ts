import { describe, expect, it } from "vitest";
import {
  avgDealSize,
  bookingRate,
  closeRate,
  costPerCall,
  noShowRate,
  proposalRate,
  replyRate,
  roas,
  safeDivide,
  type OutcomeCounts,
  type SetterTotals,
} from "@/lib/kpi/core";

describe("kpi core math", () => {
  it("safeDivide returns 0 on zero denominator (never NaN/Infinity)", () => {
    expect(safeDivide(5, 0)).toBe(0);
    expect(safeDivide(0, 0)).toBe(0);
    expect(safeDivide(10, 4)).toBe(2.5);
  });

  const counts: OutcomeCounts = { total: 10, closed: 3, rescheduled: 2, lost: 3, noShow: 2 };

  it("closeRate excludes no-shows from the denominator", () => {
    // 3 closed / (10 total - 2 no-show) = 3/8
    expect(closeRate(counts)).toBeCloseTo(0.375, 6);
  });

  it("noShowRate is over total calls", () => {
    expect(noShowRate(counts)).toBeCloseTo(0.2, 6);
  });

  it("avgDealSize = revenue / closed deals", () => {
    expect(avgDealSize(9000, 3)).toBe(3000);
    expect(avgDealSize(9000, 0)).toBe(0);
  });

  it("roas = revenue / spend", () => {
    expect(roas(12000, 3000)).toBe(4);
    expect(roas(12000, 0)).toBe(0);
  });

  it("costPerCall = spend / calls booked", () => {
    expect(costPerCall(3000, 20)).toBe(150);
    expect(costPerCall(3000, 0)).toBe(0);
  });

  const setter: SetterTotals = {
    conversations: 100,
    replies: 40,
    proposals: 10,
    callsBooked: 8,
    followUps: 25,
  };

  it("setter conversion rates", () => {
    expect(replyRate(setter)).toBeCloseTo(0.4, 6);
    expect(proposalRate(setter)).toBeCloseTo(0.25, 6); // 10/40
    expect(bookingRate(setter)).toBeCloseTo(0.08, 6); // 8/100
  });
});
