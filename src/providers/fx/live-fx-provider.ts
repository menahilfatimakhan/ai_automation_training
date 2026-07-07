import type { CurrencyCode, FxProvider } from "@/providers/ports/fx-provider";
import { MockFxProvider } from "@/providers/fx/mock-fx-provider";

/**
 * LiveFxProvider — real exchange rates from the free, no-key ECB/Frankfurter
 * API (https://frankfurter.app). Rates are cached in-memory (12h TTL) to avoid
 * hammering the API, and on any failure it falls back to static rates so the
 * currency-aware KPI engine never breaks. Selected via FX_PROVIDER=live.
 */
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

interface CacheEntry {
  rate: number;
  at: number;
}

export class LiveFxProvider implements FxProvider {
  readonly name = "live";
  private cache = new Map<string, CacheEntry>();
  private fallback = new MockFxProvider();
  private base = process.env.FX_API_BASE ?? "https://api.frankfurter.dev";

  async getRate(from: CurrencyCode, to: CurrencyCode): Promise<number> {
    const f = from.toUpperCase();
    const t = to.toUpperCase();
    if (f === t) return 1;

    const key = `${f}:${t}`;
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.rate;

    try {
      const res = await fetch(`${this.base}/latest?from=${f}&to=${t}`);
      const json = (await res.json()) as { rates?: Record<string, number> };
      const rate = json?.rates?.[t];
      if (!res.ok || typeof rate !== "number") {
        throw new Error("Unexpected FX API response");
      }
      this.cache.set(key, { rate, at: Date.now() });
      return rate;
    } catch {
      // Resilient: never let a rates outage break KPI math.
      return this.fallback.getRate(from, to);
    }
  }

  async convert(
    amount: number,
    from: CurrencyCode,
    to: CurrencyCode,
  ): Promise<number> {
    if (from.toUpperCase() === to.toUpperCase()) return amount;
    return amount * (await this.getRate(from, to));
  }
}
