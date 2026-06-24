import type {
  DateRange,
  ProviderCampaign,
  ProviderMetricRow,
} from "@/providers/ports/ad-provider";

/**
 * Committed sample data for the MockAdProvider.
 *
 * Shapes mimic Meta's Graph API (snake_case fields, `effective_status`,
 * `actions[]`) so the normalization layer maps mock and real Meta identically.
 *
 * Daily insight rows are produced by a deterministic seeded generator: the same
 * (account, campaign, date) always yields the same numbers, so seeds and
 * idempotency tests are reproducible across runs. This counts as committed
 * sample data — nothing here is random at runtime.
 */

interface FixtureCampaign extends ProviderCampaign {
  id: string;
  name: string;
  effective_status: string;
  objective: string;
  account_currency: string;
}

interface FixtureAccount {
  adAccountId: string;
  campaigns: FixtureCampaign[];
}

/**
 * Sample accounts keyed by ad_account_id. The seed script wires these account
 * ids into each client's `ad_connections` row.
 */
export const FIXTURE_ACCOUNTS: FixtureAccount[] = [
  {
    adAccountId: "act_1001",
    campaigns: [
      {
        id: "cmp_1001_lead",
        name: "Acme — Lead Gen Q2",
        effective_status: "ACTIVE",
        objective: "OUTCOME_LEADS",
        account_currency: "USD",
      },
      {
        id: "cmp_1001_retarget",
        name: "Acme — Retargeting",
        effective_status: "ACTIVE",
        objective: "OUTCOME_SALES",
        account_currency: "USD",
      },
      {
        id: "cmp_1001_brand",
        name: "Acme — Brand Awareness",
        effective_status: "PAUSED",
        objective: "OUTCOME_AWARENESS",
        account_currency: "USD",
      },
    ],
  },
  {
    adAccountId: "act_1002",
    campaigns: [
      {
        id: "cmp_1002_lead",
        name: "Globex — Lead Gen",
        effective_status: "ACTIVE",
        objective: "OUTCOME_LEADS",
        account_currency: "EUR",
      },
      {
        id: "cmp_1002_traffic",
        name: "Globex — Traffic",
        effective_status: "ACTIVE",
        objective: "OUTCOME_TRAFFIC",
        account_currency: "EUR",
      },
    ],
  },
  {
    adAccountId: "act_1003",
    campaigns: [
      {
        id: "cmp_1003_lead",
        name: "Initech — Lead Gen",
        effective_status: "ACTIVE",
        objective: "OUTCOME_LEADS",
        account_currency: "GBP",
      },
      {
        id: "cmp_1003_sales",
        name: "Initech — Sales Push",
        effective_status: "ACTIVE",
        objective: "OUTCOME_SALES",
        account_currency: "GBP",
      },
      {
        id: "cmp_1003_old",
        name: "Initech — Legacy 2024",
        effective_status: "ARCHIVED",
        objective: "OUTCOME_LEADS",
        account_currency: "GBP",
      },
    ],
  },
];

/** Deterministic PRNG (mulberry32) for reproducible fixture numbers. */
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function eachDateInclusive(range: DateRange): string[] {
  const out: string[] = [];
  const start = new Date(range.from + "T00:00:00Z");
  const end = new Date(range.to + "T00:00:00Z");
  for (let d = start; d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function getFixtureAccount(
  adAccountId: string,
): FixtureAccount | undefined {
  return FIXTURE_ACCOUNTS.find((a) => a.adAccountId === adAccountId);
}

export function getFixtureCampaigns(adAccountId: string): ProviderCampaign[] {
  return getFixtureAccount(adAccountId)?.campaigns ?? [];
}

/** Generate Graph-insights-shaped daily rows for a date range. */
export function getFixtureInsights(
  adAccountId: string,
  range: DateRange,
): ProviderMetricRow[] {
  const account = getFixtureAccount(adAccountId);
  if (!account) return [];

  const rows: ProviderMetricRow[] = [];
  const dates = eachDateInclusive(range);

  for (const campaign of account.campaigns) {
    // Archived/deleted campaigns produce no fresh spend.
    if (["ARCHIVED", "DELETED"].includes(campaign.effective_status)) continue;

    for (const date of dates) {
      const rand = mulberry32(hashString(`${campaign.id}:${date}`));
      const paused = campaign.effective_status === "PAUSED";
      const spend = paused ? 0 : Math.round((40 + rand() * 260) * 100) / 100;
      const impressions = paused ? 0 : Math.round(spend * (60 + rand() * 120));
      const reach = Math.round(impressions * (0.55 + rand() * 0.3));
      const clicks = Math.round(impressions * (0.008 + rand() * 0.02));
      const leads = paused ? 0 : Math.round(clicks * (0.05 + rand() * 0.15));
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

      rows.push({
        campaign_id: campaign.id,
        date_start: date,
        date_stop: date,
        spend,
        impressions,
        reach,
        ctr: Math.round(ctr * 1000) / 1000,
        effective_status: campaign.effective_status,
        objective: campaign.objective,
        account_currency: campaign.account_currency,
        actions: [{ action_type: "lead", value: leads }],
      });
    }
  }
  return rows;
}
