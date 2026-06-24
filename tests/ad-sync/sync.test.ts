import { describe, expect, it } from "vitest";
import { MockAdProvider } from "@/providers/ad/mock-ad-provider";
import { MetaAdProvider } from "@/providers/ad/meta-ad-provider";
import { EnvSecretStore } from "@/providers/secret-store/env-secret-store";
import type { AdProvider } from "@/providers/ports/ad-provider";
import type { SecretStore } from "@/providers/ports/secret-store";
import type { NormalizedCampaign, NormalizedMetricRow } from "@/domain/ad";
import { syncAdData } from "@/lib/ad-sync/sync";
import {
  SyncCooldownError,
  type AdConnectionRow,
  type SyncRepository,
} from "@/lib/ad-sync/types";

/**
 * In-memory repository that mimics the DB unique keys: campaigns keyed on
 * (client_id, campaign_id) and metrics on (client_id, campaign_id, date).
 * Upserts replace by key, so re-running sync cannot duplicate rows — exactly
 * the property the production unique constraints guarantee.
 */
class InMemoryRepo implements SyncRepository {
  campaigns = new Map<string, NormalizedCampaign>();
  metrics = new Map<string, NormalizedMetricRow>();
  connection: AdConnectionRow;
  touched: Date | null = null;

  constructor(conn: AdConnectionRow) {
    this.connection = conn;
  }
  async getConnection(): Promise<AdConnectionRow | null> {
    return this.connection;
  }
  async upsertCampaigns(rows: NormalizedCampaign[]) {
    for (const r of rows) this.campaigns.set(`${r.clientId}:${r.campaignId}`, r);
  }
  async upsertMetrics(rows: NormalizedMetricRow[]) {
    for (const r of rows)
      this.metrics.set(`${r.clientId}:${r.campaignId}:${r.date}`, r);
  }
  async touchLastSynced(_id: string, at: Date) {
    this.touched = at;
    this.connection = { ...this.connection, lastSyncedAt: at };
  }
}

// A SecretStore that returns a fixed token without needing env vars.
const fakeSecrets: SecretStore = {
  name: "fake",
  async resolve() {
    return "fake-token";
  },
  async store() {
    return "ref";
  },
};

function newConn(lastSyncedAt: Date | null = null): AdConnectionRow {
  return {
    id: "conn-1",
    clientId: "client-acme",
    adAccountId: "act_1001",
    accessTokenRef: "env:IGNORED",
    lastSyncedAt,
  };
}

const RANGE = { from: "2026-06-01", to: "2026-06-07" };

describe("syncAdData idempotency", () => {
  it("running sync twice does not duplicate rows", async () => {
    const repo = new InMemoryRepo(newConn());
    const deps = {
      repo,
      provider: new MockAdProvider(),
      secrets: fakeSecrets,
      range: RANGE,
      ignoreCooldown: true,
    };

    const first = await syncAdData("client-acme", deps);
    const campaignsAfter1 = repo.campaigns.size;
    const metricsAfter1 = repo.metrics.size;
    expect(first.metricRows).toBeGreaterThan(0);

    const second = await syncAdData("client-acme", deps);
    // Same keys → map size unchanged; counts reported identically.
    expect(repo.campaigns.size).toBe(campaignsAfter1);
    expect(repo.metrics.size).toBe(metricsAfter1);
    expect(second.metricRows).toBe(first.metricRows);
    expect(second.campaigns).toBe(first.campaigns);
  });
});

describe("syncAdData cooldown (15 min)", () => {
  it("blocks a re-sync within the cooldown window", async () => {
    const base = new Date("2026-06-25T12:00:00Z");
    const repo = new InMemoryRepo(newConn());
    const deps = {
      repo,
      provider: new MockAdProvider(),
      secrets: fakeSecrets,
      range: RANGE,
    };

    await syncAdData("client-acme", { ...deps, now: () => base });

    // 5 minutes later → still on cooldown.
    const fiveMinLater = new Date(base.getTime() + 5 * 60 * 1000);
    await expect(
      syncAdData("client-acme", { ...deps, now: () => fiveMinLater }),
    ).rejects.toBeInstanceOf(SyncCooldownError);
  });

  it("allows a re-sync after the cooldown elapses", async () => {
    const base = new Date("2026-06-25T12:00:00Z");
    const repo = new InMemoryRepo(newConn());
    const deps = {
      repo,
      provider: new MockAdProvider(),
      secrets: fakeSecrets,
      range: RANGE,
    };

    await syncAdData("client-acme", { ...deps, now: () => base });
    const sixteenMinLater = new Date(base.getTime() + 16 * 60 * 1000);
    const result = await syncAdData("client-acme", {
      ...deps,
      now: () => sixteenMinLater,
    });
    expect(result.metricRows).toBeGreaterThan(0);
  });
});

describe("provider swap = injection only", () => {
  it("the same pipeline runs for any AdProvider; only the injected impl differs", async () => {
    // A hand-rolled fake provider returning Graph-shaped rows.
    const fakeProvider: AdProvider = {
      name: "fake",
      async listCampaigns() {
        return [
          { id: "cmp_x", name: "X", effective_status: "ACTIVE", objective: "OUTCOME_LEADS", account_currency: "USD" },
        ];
      },
      async getDailyMetrics() {
        return [
          { campaign_id: "cmp_x", date_start: "2026-06-01", spend: 100, impressions: 1000, reach: 800, ctr: 1.5, actions: [{ action_type: "lead", value: 3 }] },
        ];
      },
    };

    const repo = new InMemoryRepo(newConn());
    const summary = await syncAdData("client-acme", {
      repo,
      provider: fakeProvider,
      secrets: fakeSecrets,
      range: RANGE,
      ignoreCooldown: true,
    });

    expect(summary.campaigns).toBe(1);
    expect(summary.metricRows).toBe(1);
    // Normalization produced our domain shape, not the provider's field names.
    const metric = [...repo.metrics.values()][0];
    expect(metric.campaignId).toBe("cmp_x");
    expect(metric.ctr).toBeCloseTo(0.015, 6); // 1.5% → fraction
    expect(metric.results).toBe(3);
    expect(metric).not.toHaveProperty("date_start");
  });

  it("MetaAdProvider is a skeleton that throws until implemented", async () => {
    const meta = new MetaAdProvider();
    await expect(
      meta.listCampaigns({ clientId: "c", adAccountId: "act", accessToken: "t" }),
    ).rejects.toThrow(/not implemented/);
  });

  it("EnvSecretStore resolves a ref from the environment", async () => {
    process.env.TEST_TOKEN_REF = "secret-value";
    const store = new EnvSecretStore();
    await expect(store.resolve("env:TEST_TOKEN_REF")).resolves.toBe("secret-value");
    delete process.env.TEST_TOKEN_REF;
  });
});
