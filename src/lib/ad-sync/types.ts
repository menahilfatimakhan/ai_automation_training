import type { NormalizedCampaign, NormalizedMetricRow } from "@/domain/ad";

/**
 * Contracts for the ad-sync use-case. The use-case (sync.ts) depends only on
 * these interfaces, never on Drizzle or a provider directly — so it runs
 * identically against the real DB or an in-memory fake, and against the mock or
 * (future) real Meta provider. Swapping either changes only the injection.
 */

export interface AdConnectionRow {
  id: string;
  clientId: string;
  adAccountId: string;
  accessTokenRef: string | null;
  lastSyncedAt: Date | null;
}

export interface SyncRepository {
  getConnection(clientId: string): Promise<AdConnectionRow | null>;
  /** Idempotent upsert keyed on (client_id, campaign_id). */
  upsertCampaigns(rows: NormalizedCampaign[]): Promise<void>;
  /** Idempotent upsert keyed on (client_id, campaign_id, date). */
  upsertMetrics(rows: NormalizedMetricRow[]): Promise<void>;
  touchLastSynced(connectionId: string, at: Date): Promise<void>;
}

export interface SyncSummary {
  clientId: string;
  adAccountId: string;
  campaigns: number;
  metricRows: number;
  syncedAt: string;
}

/** Manual-sync cooldown: re-syncing is blocked within this window. */
export const SYNC_COOLDOWN_MS = 15 * 60 * 1000;

export class SyncCooldownError extends Error {
  constructor(public readonly remainingMs: number) {
    super(
      `Sync is on cooldown. Try again in ${Math.ceil(remainingMs / 1000)}s.`,
    );
    this.name = "SyncCooldownError";
  }
}

export class NoConnectionError extends Error {
  constructor(clientId: string) {
    super(`No ad connection configured for client ${clientId}.`);
    this.name = "NoConnectionError";
  }
}

/** Milliseconds remaining on the cooldown (0 if elapsed / never synced). */
export function cooldownRemainingMs(
  lastSyncedAt: Date | null,
  now: Date,
): number {
  if (!lastSyncedAt) return 0;
  const elapsed = now.getTime() - lastSyncedAt.getTime();
  return Math.max(0, SYNC_COOLDOWN_MS - elapsed);
}
