/**
 * Read-time resolution of the computed/override/suggestion triad (invariant #2).
 *
 * The computed value is always recalculated and never mutated. A manual
 * override, stored as a separate record, wins at read time. This module picks
 * the effective value WITHOUT touching raw data — pure and unit-testable.
 */

export interface OverrideRecord {
  value: number;
  active: boolean;
  createdAt: string; // ISO
  source: "manual" | "ai_suggestion";
}

export interface ResolvedValue {
  /** The value to display/use. */
  effective: number;
  /** The untouched computed value (always available for transparency). */
  computed: number;
  /** True when an override is in effect. */
  overridden: boolean;
  source: "computed" | "manual" | "ai_suggestion";
}

/** The newest active override for a target, or null. */
export function pickActiveOverride(
  overrides: OverrideRecord[],
): OverrideRecord | null {
  const active = overrides.filter((o) => o.active);
  if (active.length === 0) return null;
  return active.reduce((latest, o) =>
    o.createdAt > latest.createdAt ? o : latest,
  );
}

/** Resolve the effective value: override wins, else computed. */
export function resolveValue(
  computed: number,
  overrides: OverrideRecord[] = [],
): ResolvedValue {
  const override = pickActiveOverride(overrides);
  if (!override) {
    return { effective: computed, computed, overridden: false, source: "computed" };
  }
  return {
    effective: override.value,
    computed,
    overridden: true,
    source: override.source,
  };
}
