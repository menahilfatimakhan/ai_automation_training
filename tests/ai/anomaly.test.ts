import { describe, expect, it } from "vitest";
import { avgHistory, checkSeries } from "@/lib/ai/anomaly-core";

describe("anomaly detection comparator", () => {
  it("avgHistory averages every value except the last, skipping nulls", () => {
    expect(avgHistory([10, 10, 10, 5])).toBeCloseTo(10, 6); // last (5) excluded
    expect(avgHistory([null, 10, null, 5])).toBeCloseTo(10, 6);
    expect(avgHistory([5])).toBe(0); // no history at all
  });

  it("flags nothing when today is within 20% of the 28-day average", () => {
    const series = [...Array(28).fill(100), 85]; // 15% drop
    expect(checkSeries("revenue", "Revenue", series)).toBeNull();
  });

  it("flags a warning between 20% and 35% below average", () => {
    const series = [...Array(28).fill(100), 75]; // 25% drop
    const result = checkSeries("revenue", "Revenue", series);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("warning");
    expect(result!.dropPct).toBeCloseTo(0.25, 2);
  });

  it("flags critical beyond 35% below average", () => {
    const series = [...Array(28).fill(100), 60]; // 40% drop
    const result = checkSeries("revenue", "Revenue", series);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("critical");
  });

  it("never flags when there's no meaningful 28-day baseline (avg <= 0)", () => {
    const series = [...Array(28).fill(0), 0];
    expect(checkSeries("revenue", "Revenue", series)).toBeNull();
  });

  it("returns null when today's value itself is missing", () => {
    const series = [...Array(28).fill(100), null];
    expect(checkSeries("close_rate", "Close Rate", series)).toBeNull();
  });
});
