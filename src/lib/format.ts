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

/**
 * Today's date in a specific IANA timezone (e.g. "Europe/Copenhagen"), not
 * UTC — used wherever "today" needs to match a specific closer/client's
 * actual calendar day (e.g. the Sales dashboard's first-call gate), since a
 * plain UTC "today" drifts from local "today" for hours around midnight UTC.
 * Falls back to UTC `todayIso()` for an invalid/unknown timezone.
 */
export function todayIsoInTz(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
    return todayIso();
  } catch {
    return todayIso();
  }
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
