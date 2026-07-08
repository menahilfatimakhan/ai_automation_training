import { and, eq, gte, lte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AdMetricRecord, CallRecord, SetterActivityRecord } from "@/domain/metrics";

/**
 * Service-level (RLS-bypassing) data loaders for trusted background-job
 * contexts — the scheduler (Step 8) and the AI usecases it drives (anomaly
 * scan, scheduled reports) have no logged-in user/cookie session, so the
 * normal request-scoped Supabase client (src/lib/data/dashboards.ts) can't be
 * used there. Same precedent as src/lib/ad-sync/drizzle-repository.ts:
 * access is via `getDb()` with EXPLICIT client_id scoping in code instead of
 * RLS. Callers of these functions must already be admin-gated one layer up
 * (the scheduler runs as a trusted process; manual triggers check
 * ctx.isAdmin before calling in).
 *
 * Output shapes match src/lib/data/dashboards.ts exactly, so the same
 * kpi/engine.ts compute functions (computeSalesKpis, computeAdKpis,
 * computeSetterKpis) work unchanged regardless of which loader fed them.
 */

export async function loadCallsService(
  clientId: string,
  fromIso: string,
  toIso: string,
): Promise<CallRecord[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.calls)
    .where(
      and(
        eq(schema.calls.clientId, clientId),
        gte(schema.calls.date, fromIso),
        lte(schema.calls.date, toIso),
      ),
    );
  return rows.map((r) => ({
    outcome: r.outcome,
    revenue: Number(r.revenue),
    cashCollected: Number(r.cashCollected),
    currency: r.currency,
    date: r.date,
    objectionType: r.objectionType,
  }));
}

export async function loadAdMetricsService(
  clientId: string,
  fromIso: string,
  toIso: string,
): Promise<AdMetricRecord[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.adDailyMetrics)
    .where(
      and(
        eq(schema.adDailyMetrics.clientId, clientId),
        gte(schema.adDailyMetrics.date, fromIso),
        lte(schema.adDailyMetrics.date, toIso),
      ),
    );
  return rows.map((r) => ({
    spend: Number(r.spend),
    results: r.results,
    impressions: r.impressions,
    ctr: Number(r.ctr),
    newFollowers: r.newFollowers,
    currency: r.currency,
    date: r.date,
    status: r.status,
  }));
}

export async function loadSetterActivityService(
  clientId: string,
  fromIso: string,
  toIso: string,
): Promise<SetterActivityRecord[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.setterDailyActivity)
    .where(
      and(
        eq(schema.setterDailyActivity.clientId, clientId),
        gte(schema.setterDailyActivity.date, fromIso),
        lte(schema.setterDailyActivity.date, toIso),
      ),
    );
  return rows.map((r) => ({
    conversations: r.conversations,
    replies: r.replies,
    proposals: r.proposals,
    callsBooked: r.callsBooked,
    followUps: r.followUps,
  }));
}

export interface ServiceClientRow {
  id: string;
  name: string;
  reportingCurrency: string;
}

export async function listAllClientsService(): Promise<ServiceClientRow[]> {
  const db = getDb();
  const rows = await db.select().from(schema.clients);
  return rows.map((c) => ({ id: c.id, name: c.name, reportingCurrency: c.reportingCurrency }));
}

export async function listClientsWithAdConnectionsService(): Promise<string[]> {
  const db = getDb();
  const rows = await db.select({ clientId: schema.adConnections.clientId }).from(schema.adConnections);
  return [...new Set(rows.map((r) => r.clientId))];
}

export async function loadClientSettingsService(clientId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.clientSettings)
    .where(eq(schema.clientSettings.clientId, clientId))
    .limit(1);
  return rows[0] ?? null;
}

export interface ServiceGoalRow {
  revenueGoal: number;
  callsGoal: number;
  currency: string;
}

export async function loadGoalForMonthService(
  clientId: string,
  monthIso: string,
): Promise<ServiceGoalRow | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.goals)
    .where(and(eq(schema.goals.clientId, clientId), eq(schema.goals.month, monthIso)))
    .limit(1);
  const g = rows[0];
  if (!g) return null;
  return { revenueGoal: Number(g.revenueGoal), callsGoal: g.callsGoal, currency: g.currency };
}
