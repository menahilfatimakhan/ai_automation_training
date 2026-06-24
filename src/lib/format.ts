/** Display formatting helpers (presentation only; never used in KPI math). */

export function formatMoney(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString()}`;
  }
}

export function formatPercent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatMultiple(n: number, digits = 2): string {
  return `${n.toFixed(digits)}×`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** First day of the current month, ISO. */
export function monthStartIso(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

/** ISO date `days` ago (UTC). */
export function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Last day of the current month, ISO. */
export function monthEndIso(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
}
