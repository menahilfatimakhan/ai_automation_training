import type {
  AdConnectionContext,
  AdProvider,
  DateRange,
  ProviderCampaign,
  ProviderMetricRow,
} from "@/providers/ports/ad-provider";

/**
 * MetaAdProvider — SKELETON. Not implemented. Selected when AD_PROVIDER=meta.
 *
 * The method bodies throw on purpose. When going live (see
 * docs/INTEGRATIONS.md), implement the two TODO blocks below and nothing else
 * downstream changes: syncAdData + normalize already understand the Graph
 * response shape these calls return.
 *
 * DO NOT call Meta from anywhere except inside these two methods.
 */
export class MetaAdProvider implements AdProvider {
  readonly name = "meta";

  // TODO(meta): pin the Graph API version here. Keep it in env so it can be
  // bumped without code changes: process.env.META_GRAPH_API_VERSION (e.g. "v21.0").
  private readonly apiVersion =
    process.env.META_GRAPH_API_VERSION ?? "v21.0";
  private readonly graphBase = "https://graph.facebook.com";

  async listCampaigns(conn: AdConnectionContext): Promise<ProviderCampaign[]> {
    throw new Error("MetaAdProvider.listCampaigns not implemented");
    // TODO(meta): GET {graphBase}/{apiVersion}/{conn.adAccountId}/campaigns
    //   ?fields=id,name,effective_status,objective,account_currency
    //   Authorization: Bearer {conn.accessToken}
    //   Page through `paging.next`; return the raw `data[]` array as-is.
    //   Do NOT remap fields here — normalize.ts is the only mapping site.
  }

  async getDailyMetrics(
    conn: AdConnectionContext,
    range: DateRange,
  ): Promise<ProviderMetricRow[]> {
    throw new Error("MetaAdProvider.getDailyMetrics not implemented");
    // TODO(meta): GET {graphBase}/{apiVersion}/{conn.adAccountId}/insights
    //   ?level=campaign&time_increment=1
    //   &fields=campaign_id,spend,impressions,reach,ctr,actions
    //   &time_range={"since":"{range.from}","until":"{range.to}"}
    //   Authorization: Bearer {conn.accessToken}
    //   Page through `paging.next`; return the raw `data[]` array as-is.
    //   `effective_status`/`account_currency` come from listCampaigns; syncAdData
    //   joins them, so they need not be on every insight row.
  }
}
