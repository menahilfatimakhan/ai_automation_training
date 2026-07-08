/**
 * Pure anomaly-comparator math — no I/O, no provider access. Mirrors the
 * kpi/core.ts vs kpi/engine.ts split so this stays independently testable.
 */

export interface AnomalyResult {
  metricKey: string;
  label: string;
  today: number;
  avg28d: number;
  dropPct: number; // 0-1, how far below the 28-day average
  severity: "warning" | "critical";
}

export const WARN_THRESHOLD = 0.2;
export const CRITICAL_THRESHOLD = 0.35;

/** Average of every value except the last (today), skipping nulls. */
export function avgHistory(series: (number | null)[]): number {
  const history = series.slice(0, -1).filter((v): v is number => v !== null);
  if (history.length === 0) return 0;
  return history.reduce((s, v) => s + v, 0) / history.length;
}

/**
 * Compares the last value in `series` (today) against the average of every
 * value before it (the 28-day history). Flags a warning/critical result when
 * today is more than 20%/35% below that average; null when there's nothing
 * to flag (including when there's no meaningful baseline yet).
 */
export function checkSeries(
  metricKey: string,
  label: string,
  series: (number | null)[],
): AnomalyResult | null {
  const today = series.at(-1);
  if (today === null || today === undefined) return null;
  const avg = avgHistory(series);
  if (avg <= 0) return null;

  const dropPct = (avg - today) / avg;
  if (dropPct <= WARN_THRESHOLD) return null;

  return {
    metricKey,
    label,
    today,
    avg28d: avg,
    dropPct,
    severity: dropPct > CRITICAL_THRESHOLD ? "critical" : "warning",
  };
}
