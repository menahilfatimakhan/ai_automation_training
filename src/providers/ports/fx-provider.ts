/**
 * FxProvider PORT.
 *
 * Currency conversion. The KPI engine is currency-aware and converts money to
 * a client's reporting currency through this interface. The mock uses static
 * rates; a real rates feed slots in behind the same signatures later.
 */

/** ISO-4217 code, e.g. "USD", "EUR", "GBP". */
export type CurrencyCode = string;

export interface FxProvider {
  readonly name: string;

  /**
   * Convert `amount` from one currency to another. Implementations must return
   * `amount` unchanged when `from === to`.
   */
  convert(
    amount: number,
    from: CurrencyCode,
    to: CurrencyCode,
  ): Promise<number>;

  /** The conversion rate such that `amount_in_to = amount_in_from * rate`. */
  getRate(from: CurrencyCode, to: CurrencyCode): Promise<number>;
}
