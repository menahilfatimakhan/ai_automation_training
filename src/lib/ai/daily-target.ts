import { getDb, schema } from "@/db";
import { and, eq, gte } from "drizzle-orm";
import { getProviders } from "@/providers/registry";
import { computeSalesKpis } from "@/lib/kpi/engine";
import { pacing } from "@/lib/kpi/core";
import { loadCallsService, loadGoalForMonthService } from "@/lib/data/service-loaders";
import { monthEndIso, monthStartIso, todayIso } from "@/lib/format";

interface ClientInfo {
  id: string;
  name: string;
  currency: string;
}

/** True if a daily_target notification has already gone out today for this client. */
async function alreadySentToday(clientId: string): Promise<boolean> {
  const db = getDb();
  const startOfDay = new Date(`${todayIso()}T00:00:00.000Z`);
  const rows = await db
    .select({ id: schema.notifications.id })
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.clientId, clientId),
        eq(schema.notifications.kind, "daily_target"),
        gte(schema.notifications.createdAt, startOfDay),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Sends a client-wide "here's today's pace" DM: month-to-date revenue vs.
 * goal, projected month-end (pacing), and whether that's on track. Scoped to
 * the client rather than an individual closer/setter — goals in this schema
 * are set per client, not allocated per rep, so a truly personalized daily
 * target would need that allocation modeled first.
 */
export async function sendDailyTarget(client: ClientInfo): Promise<boolean> {
  if (await alreadySentToday(client.id)) return false;

  const periodStart = monthStartIso();
  const today = todayIso();
  const goal = await loadGoalForMonthService(client.id, periodStart);
  if (!goal || !goal.revenueGoal) return false; // nothing to pace against

  const calls = await loadCallsService(client.id, periodStart, today);
  const fx = getProviders().fx;
  const sales = await computeSalesKpis(calls, client.currency, fx);

  const daysElapsed = new Date(`${today}T00:00:00Z`).getUTCDate();
  const daysInMonth = new Date(`${monthEndIso()}T00:00:00Z`).getUTCDate();
  const projected = pacing(sales.revenue, daysElapsed, daysInMonth);
  const onTrack = projected >= goal.revenueGoal;
  const pctOfGoal = Math.round((sales.revenue / goal.revenueGoal) * 100);

  const { notifier } = getProviders();
  await notifier.notify({
    clientId: client.id,
    kind: "daily_target",
    title: `${onTrack ? "On track" : "Behind pace"} — ${pctOfGoal}% of monthly revenue goal`,
    body: `Revenue so far this month: ${sales.revenue.toFixed(2)} ${client.currency} of ${goal.revenueGoal.toFixed(2)} goal. Projected month-end at the current pace: ${projected.toFixed(2)} ${client.currency}.`,
    meta: { revenue: sales.revenue, goal: goal.revenueGoal, projected, onTrack },
  });
  return true;
}
