import type {
  ProviderCampaign,
  ProviderMetricRow,
} from "@/providers/ports/ad-provider";
import type {
  CampaignStatus,
  NormalizedCampaign,
  NormalizedMetricRow,
} from "@/domain/ad";

/**
 * NORMALIZATION LAYER — the ONLY place provider-specific field names appear.
 *
 * Design: the provider "wire shape" is modeled on Meta's Graph API (snake_case
 * fields like `effective_status`, `account_currency`, `date_start`, `actions`).
 * The MockAdProvider emits fixtures in this same shape, so a single mapper
 * serves both mock and (future) real Meta. When MetaAdProvider is implemented
 * it returns the real Graph payload, which these functions already understand —
 * Meta's format stops here and never leaks downstream.
 *
 * If a second provider with a genuinely different shape is added later, branch
 * on a discriminator here; do NOT spread provider field access elsewhere.
 */

function mapStatus(raw: unknown): CampaignStatus {
  switch (String(raw ?? "").toUpperCase()) {
    case "ACTIVE":
      return "active";
    case "PAUSED":
    case "CAMPAIGN_PAUSED":
    case "ADSET_PAUSED":
      return "paused";
    case "ARCHIVED":
      return "archived";
    case "DELETED":
      return "deleted";
    default:
      return "paused";
  }
}

/** Sum result-style actions (leads, purchases, etc.) from a Graph actions[]. */
function sumResults(raw: ProviderMetricRow): number {
  const actions = raw["actions"];
  if (!Array.isArray(actions)) {
    // Fixtures may carry a precomputed `results` for convenience.
    return Number(raw["results"] ?? 0);
  }
  const counted = new Set([
    "lead",
    "purchase",
    "offsite_conversion.fb_pixel_lead",
    "offsite_conversion.fb_pixel_purchase",
  ]);
  return actions.reduce((sum: number, a: unknown) => {
    if (a && typeof a === "object") {
      const action = a as Record<string, unknown>;
      if (counted.has(String(action["action_type"]))) {
        return sum + Number(action["value"] ?? 0);
      }
    }
    return sum;
  }, 0);
}

export function mapProviderCampaign(
  clientId: string,
  raw: ProviderCampaign,
): NormalizedCampaign {
  return {
    clientId,
    campaignId: String(raw["id"] ?? raw["campaign_id"]),
    name: String(raw["name"] ?? "Untitled campaign"),
    status: mapStatus(raw["effective_status"] ?? raw["status"]),
    category: (raw["objective"] as string | undefined) ?? null,
    currency: String(raw["account_currency"] ?? raw["currency"] ?? "USD"),
  };
}

export function mapProviderMetricRow(
  clientId: string,
  raw: ProviderMetricRow,
  campaign?: Pick<NormalizedCampaign, "status" | "category" | "currency">,
): NormalizedMetricRow {
  const ctrRaw = Number(raw["ctr"] ?? 0);
  return {
    clientId,
    campaignId: String(raw["campaign_id"] ?? raw["id"]),
    date: String(raw["date_start"] ?? raw["date"]),
    spend: Number(raw["spend"] ?? 0),
    impressions: Number(raw["impressions"] ?? 0),
    reach: Number(raw["reach"] ?? 0),
    results: sumResults(raw),
    // Graph returns CTR as a percentage (1.2 == 1.2%); store as a fraction.
    ctr: ctrRaw > 1 ? ctrRaw / 100 : ctrRaw,
    status: campaign?.status ?? mapStatus(raw["effective_status"]),
    category: campaign?.category ?? (raw["objective"] as string) ?? null,
    currency: campaign?.currency ?? String(raw["account_currency"] ?? "USD"),
    flags: {
      learning: String(raw["effective_status"]).toUpperCase().includes("LEARN"),
      rejected: Boolean(raw["is_rejected"] ?? false),
    },
  };
}
