import type {
  AdConnectionContext,
  AdProvider,
  DateRange,
  ProviderCampaign,
  ProviderMetricRow,
} from "@/providers/ports/ad-provider";
import { getFixtureCampaigns, getFixtureInsights } from "@/providers/ad/fixtures";

/**
 * MockAdProvider — serves committed fixtures in Graph-like shape. No network.
 * Selected when AD_PROVIDER=mock. Runs the exact same syncAdData pipeline as
 * the real provider; only the data source differs.
 */
export class MockAdProvider implements AdProvider {
  readonly name = "mock";

  async listCampaigns(conn: AdConnectionContext): Promise<ProviderCampaign[]> {
    return getFixtureCampaigns(conn.adAccountId);
  }

  async getDailyMetrics(
    conn: AdConnectionContext,
    range: DateRange,
  ): Promise<ProviderMetricRow[]> {
    return getFixtureInsights(conn.adAccountId, range);
  }
}
