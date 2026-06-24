import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { NormalizedCampaign, NormalizedMetricRow } from "@/domain/ad";
import type { AdConnectionRow, SyncRepository } from "@/lib/ad-sync/types";

/**
 * Production SyncRepository over Drizzle (service connection, RLS-bypassing —
 * sync is a trusted server job). Upserts use the natural unique keys so
 * re-running sync replaces rows instead of duplicating them.
 */
export class DrizzleSyncRepository implements SyncRepository {
  private db = getDb();

  async getConnection(clientId: string): Promise<AdConnectionRow | null> {
    const rows = await this.db
      .select()
      .from(schema.adConnections)
      .where(eq(schema.adConnections.clientId, clientId))
      .limit(1);
    const c = rows[0];
    if (!c) return null;
    return {
      id: c.id,
      clientId: c.clientId,
      adAccountId: c.adAccountId,
      accessTokenRef: c.accessTokenRef,
      lastSyncedAt: c.lastSyncedAt,
    };
  }

  async upsertCampaigns(rows: NormalizedCampaign[]): Promise<void> {
    if (rows.length === 0) return;
    await this.db
      .insert(schema.adCampaigns)
      .values(
        rows.map((r) => ({
          clientId: r.clientId,
          campaignId: r.campaignId,
          name: r.name,
          status: r.status,
          category: r.category,
          currency: r.currency,
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [schema.adCampaigns.clientId, schema.adCampaigns.campaignId],
        set: {
          name: sqlExcluded("name"),
          status: sqlExcluded("status"),
          category: sqlExcluded("category"),
          currency: sqlExcluded("currency"),
          updatedAt: new Date(),
        },
      });
  }

  async upsertMetrics(rows: NormalizedMetricRow[]): Promise<void> {
    if (rows.length === 0) return;
    // Chunk to keep parameter counts well within limits.
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      await this.db
        .insert(schema.adDailyMetrics)
        .values(
          slice.map((r) => ({
            clientId: r.clientId,
            campaignId: r.campaignId,
            date: r.date,
            spend: String(r.spend),
            impressions: r.impressions,
            reach: r.reach,
            results: r.results,
            ctr: String(r.ctr),
            status: r.status,
            category: r.category,
            currency: r.currency,
            flags: r.flags,
            updatedAt: new Date(),
          })),
        )
        .onConflictDoUpdate({
          target: [
            schema.adDailyMetrics.clientId,
            schema.adDailyMetrics.campaignId,
            schema.adDailyMetrics.date,
          ],
          set: {
            spend: sqlExcluded("spend"),
            impressions: sqlExcluded("impressions"),
            reach: sqlExcluded("reach"),
            results: sqlExcluded("results"),
            ctr: sqlExcluded("ctr"),
            status: sqlExcluded("status"),
            category: sqlExcluded("category"),
            currency: sqlExcluded("currency"),
            flags: sqlExcluded("flags"),
            updatedAt: new Date(),
          },
        });
    }
  }

  async touchLastSynced(connectionId: string, at: Date): Promise<void> {
    await this.db
      .update(schema.adConnections)
      .set({ lastSyncedAt: at })
      .where(eq(schema.adConnections.id, connectionId));
  }
}

/** Reference the conflicting INSERT's value (Postgres `excluded`) in a SET. */
function sqlExcluded(column: string) {
  return sql.raw(`excluded.${column}`);
}
