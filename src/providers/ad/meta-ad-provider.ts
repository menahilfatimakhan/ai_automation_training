import type {
  AdConnectionContext,
  AdProvider,
  DateRange,
  ProviderCampaign,
  ProviderMetricRow,
} from "@/providers/ports/ad-provider";

/**
 * MetaAdProvider — live Meta (Facebook) Marketing API integration.
 *
 * Selected when AD_PROVIDER=meta. Returns raw Graph-shaped payloads; the
 * normalization layer (providers/ad/normalize.ts) is the only place that maps
 * those fields into our domain shape, so syncAdData, the DB, and the UI are
 * unchanged. The MockAdProvider emits the same shape, which is why the rest of
 * the pipeline never needs to know which provider ran.
 *
 * Requirements (see docs/INTEGRATIONS.md):
 *  - conn.adAccountId in `act_<id>` form
 *  - conn.accessToken with `ads_read` (resolved from a secret ref by syncAdData)
 *  - META_GRAPH_API_VERSION env (defaults to a recent version)
 */
export class MetaAdProvider implements AdProvider {
  readonly name = "meta";

  private readonly apiVersion = process.env.META_GRAPH_API_VERSION ?? "v21.0";
  private readonly graphBase = "https://graph.facebook.com";

  private url(path: string, params: Record<string, string>): string {
    const qs = new URLSearchParams(params).toString();
    return `${this.graphBase}/${this.apiVersion}/${path}?${qs}`;
  }

  /** GET a paginated Graph edge, following `paging.next` until exhausted. */
  private async fetchAll(initialUrl: string): Promise<Record<string, unknown>[]> {
    const out: Record<string, unknown>[] = [];
    let next: string | undefined = initialUrl;
    let guard = 0;

    while (next && guard++ < 200) {
      const res: Response = await fetch(next);
      const json = (await res.json()) as {
        data?: Record<string, unknown>[];
        paging?: { next?: string };
        error?: { message?: string; code?: number };
      };
      if (!res.ok || json.error) {
        throw new Error(
          `Meta Graph API error: ${json.error?.message ?? res.statusText} (HTTP ${res.status})`,
        );
      }
      if (Array.isArray(json.data)) out.push(...json.data);
      next = json.paging?.next;
    }
    return out;
  }

  /** The ad account's currency, attached to each campaign for normalization. */
  private async accountCurrency(conn: AdConnectionContext): Promise<string> {
    const res = await fetch(
      this.url(conn.adAccountId, {
        fields: "currency",
        access_token: conn.accessToken,
      }),
    );
    const json = (await res.json()) as { currency?: string; error?: { message?: string } };
    if (!res.ok || json.error) {
      throw new Error(`Meta Graph API error: ${json.error?.message ?? res.statusText}`);
    }
    return json.currency ?? "USD";
  }

  async listCampaigns(conn: AdConnectionContext): Promise<ProviderCampaign[]> {
    const currency = await this.accountCurrency(conn);
    const campaigns = await this.fetchAll(
      this.url(`${conn.adAccountId}/campaigns`, {
        fields: "id,name,effective_status,objective",
        limit: "200",
        access_token: conn.accessToken,
      }),
    );
    // Attach account currency so normalize.mapProviderCampaign can read it.
    return campaigns.map((c) => ({ ...c, account_currency: currency }));
  }

  async getDailyMetrics(
    conn: AdConnectionContext,
    range: DateRange,
  ): Promise<ProviderMetricRow[]> {
    return this.fetchAll(
      this.url(`${conn.adAccountId}/insights`, {
        level: "campaign",
        time_increment: "1",
        fields: "campaign_id,spend,impressions,reach,ctr,actions",
        time_range: JSON.stringify({ since: range.from, until: range.to }),
        limit: "500",
        access_token: conn.accessToken,
      }),
    );
  }
}
