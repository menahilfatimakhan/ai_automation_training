/**
 * Internal domain shapes for ad data — OUR vocabulary, not any provider's.
 *
 * The normalization layer (providers/ad/normalize.ts) converts provider DTOs
 * into these shapes. Everything downstream (syncAdData, the DB, the KPI engine,
 * dashboards) speaks ONLY these types. A provider's field names must never
 * appear past normalize.ts.
 */

export type CampaignStatus = "active" | "paused" | "archived" | "deleted";

export interface NormalizedCampaign {
  clientId: string;
  /** Provider-stable campaign id, persisted as our `campaign_id`. */
  campaignId: string;
  name: string;
  status: CampaignStatus;
  /** Free-form provider objective/category, e.g. "OUTCOME_LEADS". */
  category: string | null;
  currency: string;
}

export interface NormalizedMetricRow {
  clientId: string;
  campaignId: string;
  /** ISO date `YYYY-MM-DD`. */
  date: string;
  spend: number;
  impressions: number;
  reach: number;
  /** Conversions / leads / purchases — the campaign's primary result count. */
  results: number;
  /** Click-through rate as a fraction (0.012 = 1.2%). */
  ctr: number;
  status: CampaignStatus;
  category: string | null;
  currency: string;
  /** Provider-agnostic flags, e.g. { learning: true, rejected: false }. */
  flags: Record<string, boolean>;
}
