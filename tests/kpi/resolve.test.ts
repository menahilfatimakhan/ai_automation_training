import { describe, expect, it } from "vitest";
import {
  pickActiveOverride,
  resolveValue,
  type OverrideRecord,
} from "@/lib/kpi/resolve";

describe("override resolution (invariant #2)", () => {
  it("returns the computed value when there is no override", () => {
    const r = resolveValue(1000, []);
    expect(r.effective).toBe(1000);
    expect(r.computed).toBe(1000);
    expect(r.overridden).toBe(false);
    expect(r.source).toBe("computed");
  });

  it("an active override wins at read time but preserves the computed value", () => {
    const overrides: OverrideRecord[] = [
      { value: 1200, active: true, createdAt: "2026-06-10T00:00:00Z", source: "manual" },
    ];
    const r = resolveValue(1000, overrides);
    expect(r.effective).toBe(1200);
    expect(r.computed).toBe(1000); // raw/computed untouched
    expect(r.overridden).toBe(true);
    expect(r.source).toBe("manual");
  });

  it("the newest active override applies; inactive ones are ignored", () => {
    const overrides: OverrideRecord[] = [
      { value: 1100, active: true, createdAt: "2026-06-01T00:00:00Z", source: "manual" },
      { value: 1300, active: false, createdAt: "2026-06-20T00:00:00Z", source: "ai_suggestion" },
      { value: 1250, active: true, createdAt: "2026-06-15T00:00:00Z", source: "ai_suggestion" },
    ];
    expect(pickActiveOverride(overrides)?.value).toBe(1250);
    expect(resolveValue(1000, overrides).effective).toBe(1250);
    expect(resolveValue(1000, overrides).source).toBe("ai_suggestion");
  });
});
