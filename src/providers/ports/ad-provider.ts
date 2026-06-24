/**
 * AdProvider PORT.
 *
 * Provider-agnostic interface for pulling ad data from an external network
 * (Meta, Google, etc.). The rest of the app depends ONLY on this interface —
 * never on a concrete network's SDK or response shape.
 *
 * DTOs below (`Provider*`) are the raw, provider-shaped payloads. They are
 * allowed to be loosely typed because the normalization layer
 * (providers/ad/normalize.ts) is the single place that reads their fields and
 * converts them into our internal domain shape. Nothing else should touch a
 * `Provider*` value.
 */

export interface DateRange {
  /** inclusive, ISO date `YYYY-MM-DD` */
  from: string;
  /** inclusive, ISO date `YYYY-MM-DD` */
  to: string;
}

/**
 * Everything a provider needs to authenticate and scope a pull for one tenant.
 * `accessToken` is resolved from a secret reference via the SecretStore port
 * BEFORE it reaches the provider — providers never see the raw ref.
 */
export interface AdConnectionContext {
  clientId: string;
  adAccountId: string;
  accessToken: string;
}

/** Raw, provider-shaped campaign payload. Read ONLY in normalize.ts. */
export interface ProviderCampaign {
  [key: string]: unknown;
}

/** Raw, provider-shaped daily metric row. Read ONLY in normalize.ts. */
export interface ProviderMetricRow {
  [key: string]: unknown;
}

export interface AdProvider {
  /** Stable identifier for the active implementation, e.g. "mock" | "meta". */
  readonly name: string;

  listCampaigns(conn: AdConnectionContext): Promise<ProviderCampaign[]>;

  getDailyMetrics(
    conn: AdConnectionContext,
    range: DateRange,
  ): Promise<ProviderMetricRow[]>;
}
