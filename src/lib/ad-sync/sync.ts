import type { AdProvider, DateRange } from "@/providers/ports/ad-provider";
import type { SecretStore } from "@/providers/ports/secret-store";
import type { NormalizedCampaign, NormalizedMetricRow } from "@/domain/ad";
import {
  mapProviderCampaign,
  mapProviderMetricRow,
} from "@/providers/ad/normalize";
import {
  cooldownRemainingMs,
  NoConnectionError,
  SyncCooldownError,
  type SyncRepository,
  type SyncSummary,
} from "@/lib/ad-sync/types";

/**
 * syncAdData — the ONE sync pipeline shared by every provider.
 *
 *   pull (injected provider) -> normalize (single mapping site) -> idempotent
 *   upsert (unique keys) -> touch last_synced_at -> return summary
 *
 * Mock and real Meta run this exact code; only `deps.provider` differs. All I/O
 * is injected, so idempotency and cooldown are unit-tested without a live DB.
 */

export interface SyncDeps {
  repo: SyncRepository;
  provider: AdProvider;
  secrets: SecretStore;
  /** Injectable clock for deterministic cooldown tests. */
  now?: () => Date;
  /** Date range to pull; defaults to the trailing 60 days. */
  range?: DateRange;
  /** Bypass the cooldown (e.g. server-side scheduled sync, never user UI). */
  ignoreCooldown?: boolean;
}

function trailingRange(now: Date, days: number): DateRange {
  const to = now.toISOString().slice(0, 10);
  const fromDate = new Date(now);
  fromDate.setUTCDate(fromDate.getUTCDate() - (days - 1));
  return { from: fromDate.toISOString().slice(0, 10), to };
}

export async function syncAdData(
  clientId: string,
  deps: SyncDeps,
): Promise<SyncSummary> {
  const now = deps.now ? deps.now() : new Date();

  const connection = await deps.repo.getConnection(clientId);
  if (!connection) throw new NoConnectionError(clientId);

  // 15-minute manual-sync cooldown.
  if (!deps.ignoreCooldown) {
    const remaining = cooldownRemainingMs(connection.lastSyncedAt, now);
    if (remaining > 0) throw new SyncCooldownError(remaining);
  }

  // Resolve the access token from its secret reference (never plaintext in DB).
  const accessToken = connection.accessTokenRef
    ? await deps.secrets.resolve(connection.accessTokenRef)
    : "";
  const conn = {
    clientId,
    adAccountId: connection.adAccountId,
    accessToken,
  };

  const range = deps.range ?? trailingRange(now, 60);

  // 1) Pull + normalize campaigns.
  const rawCampaigns = await deps.provider.listCampaigns(conn);
  const campaigns: NormalizedCampaign[] = rawCampaigns.map((c) =>
    mapProviderCampaign(clientId, c),
  );
  const campaignMeta = new Map(
    campaigns.map((c) => [
      c.campaignId,
      { status: c.status, category: c.category, currency: c.currency },
    ]),
  );

  // 2) Pull + normalize daily metrics, joining campaign metadata.
  const rawMetrics = await deps.provider.getDailyMetrics(conn, range);
  const metrics: NormalizedMetricRow[] = rawMetrics.map((m) => {
    const campaignId = String(m["campaign_id"] ?? m["id"]);
    return mapProviderMetricRow(clientId, m, campaignMeta.get(campaignId));
  });

  // 3) Idempotent upserts (unique keys make re-runs replace, never duplicate).
  await deps.repo.upsertCampaigns(campaigns);
  await deps.repo.upsertMetrics(metrics);

  // 4) Record the sync time (starts the cooldown).
  await deps.repo.touchLastSynced(connection.id, now);

  return {
    clientId,
    adAccountId: connection.adAccountId,
    campaigns: campaigns.length,
    metricRows: metrics.length,
    syncedAt: now.toISOString(),
  };
}
