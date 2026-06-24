import type { CurrencyCode, FxProvider } from "@/providers/ports/fx-provider";

/**
 * MockFxProvider — static rates relative to USD. Deterministic, no network.
 * Real rates feed slots in behind the FxProvider port later.
 */
const USD_RATES: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  CAD: 0.74,
  AUD: 0.66,
};

export class MockFxProvider implements FxProvider {
  readonly name = "mock";

  async getRate(from: CurrencyCode, to: CurrencyCode): Promise<number> {
    if (from === to) return 1;
    const fromUsd = USD_RATES[from.toUpperCase()];
    const toUsd = USD_RATES[to.toUpperCase()];
    if (fromUsd === undefined) throw new Error(`Unknown currency: ${from}`);
    if (toUsd === undefined) throw new Error(`Unknown currency: ${to}`);
    // amount_in_to = amount_in_from * (from->USD) / (to->USD)
    return fromUsd / toUsd;
  }

  async convert(
    amount: number,
    from: CurrencyCode,
    to: CurrencyCode,
  ): Promise<number> {
    if (from === to) return amount;
    const rate = await this.getRate(from, to);
    return amount * rate;
  }
}
