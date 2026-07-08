import { getProviders } from "@/providers/registry";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { computeMasterView } from "@/lib/data/master";
import { reportMetricsForClient } from "@/lib/ai/report-metrics";
import type { AiAdvice, AiContext } from "@/providers/ports/ai-provider";

/**
 * AI use-cases. Every one computes the authoritative metrics in TypeScript
 * FIRST and passes them to the model as context (invariant #3). The model's
 * output is advisory: numeric suggestions land in ai_suggestions as `pending`
 * (a human accepts them to create an override); narrative advice is delivered
 * via the Notifier to the in-app panel.
 */

interface ClientInfo {
  id: string;
  name: string;
  currency: string;
}

type DashboardKey = "master" | "sales" | "ads" | "setter";

async function metricsForClient(client: ClientInfo) {
  const view = await computeMasterView(client.id, client.currency);
  const metrics: Record<string, number | string> = {};
  for (const card of view.cards) {
    metrics[card.key] = Number(card.effective.toFixed(2));
  }
  return { view, metrics };
}

/** The admin-configured coaching tone for a client's dashboard, if set (Settings). */
async function personaFor(clientId: string, dashboard: DashboardKey): Promise<string | undefined> {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase
    .from("ai_personas")
    .select("persona")
    .eq("client_id", clientId)
    .eq("dashboard", dashboard)
    .maybeSingle();
  return data?.persona || undefined;
}

/** Authoritative, pre-computed metric map for a client (used to ground the chat). */
export async function clientMetricsMap(
  client: ClientInfo,
): Promise<Record<string, number | string>> {
  const { metrics } = await metricsForClient(client);
  return metrics;
}

/** Generate dashboard insights, persist numeric suggestions, notify the panel. */
export async function generateDashboardInsights(
  client: ClientInfo,
  scope: AiContext["task"] = "dashboard_insights",
  dashboard: DashboardKey = "master",
): Promise<AiAdvice> {
  const { ai, notifier } = getProviders();
  const { view, metrics } = await metricsForClient(client);
  const persona = await personaFor(client.id, dashboard);

  const advice = await ai.advise({
    task: scope,
    clientName: client.name,
    currency: client.currency,
    metrics,
    persona,
  });

  const supabase = createSupabaseServiceClient();

  // Persist numeric suggestions as pending (advisory until accepted).
  const numeric = advice.suggestions.filter((s) => s.suggestedValue !== null);
  if (numeric.length > 0) {
    // Clear prior pending suggestions for these targets to avoid pile-up.
    await supabase
      .from("ai_suggestions")
      .delete()
      .eq("client_id", client.id)
      .eq("status", "pending")
      .eq("period_start", view.periodStart)
      .eq("period_end", view.periodEnd)
      .in(
        "target_key",
        numeric.map((s) => s.targetKey),
      );

    await supabase.from("ai_suggestions").insert(
      numeric.map((s) => ({
        client_id: client.id,
        target_type: "kpi",
        target_key: s.targetKey,
        period_start: view.periodStart,
        period_end: view.periodEnd,
        suggested_value: String(s.suggestedValue),
        rationale: s.rationale,
        prompt_context: metrics,
        status: "pending",
      })),
    );
  }

  // Deliver the narrative to the in-app panel via the Notifier.
  await notifier.notify({
    clientId: client.id,
    kind: "ai_insight",
    title: advice.headline,
    body: advice.details,
    meta: { scope, metrics },
  });

  return advice;
}

/** Next best action — advisory, delivered to the panel. */
export async function generateNextBestAction(
  client: ClientInfo,
  dashboard: DashboardKey = "master",
): Promise<AiAdvice> {
  return generateDashboardInsights(client, "next_best_action", dashboard);
}

/**
 * Loss debrief — triggered when a call is logged as lost. Computes recent loss
 * context, asks the model for coaching, and delivers it to the in-app panel via
 * the Notifier (Slack/email later behind the same port).
 */
export async function generateLossDebrief(
  client: ClientInfo,
  context: { objection?: string | null; notes?: string | null; userId?: string },
): Promise<void> {
  const { ai, notifier } = getProviders();
  const { metrics } = await metricsForClient(client);
  const persona = await personaFor(client.id, "sales");

  const advice = await ai.advise({
    task: "loss_debrief",
    clientName: client.name,
    currency: client.currency,
    metrics,
    persona,
    notes: [
      context.objection ? `objection: ${context.objection}` : "",
      context.notes ? `notes: ${context.notes}` : "",
    ]
      .filter(Boolean)
      .join("; "),
  });

  await notifier.notify({
    clientId: client.id,
    userId: context.userId,
    kind: "loss_debrief",
    title: advice.headline,
    body: advice.details,
    meta: { objection: context.objection ?? null },
  });
}

/**
 * Campaign narrative — a short AI-written performance summary generated after
 * each ad sync, delivered to the Ads dashboard's panel via the Notifier.
 */
export async function generateCampaignNarrative(
  client: ClientInfo,
  sync: { campaigns: number; metricRows: number; syncedAt: string },
): Promise<void> {
  const { ai, notifier } = getProviders();
  const { metrics } = await metricsForClient(client);
  const persona = await personaFor(client.id, "ads");

  const advice = await ai.advise({
    task: "dashboard_insights",
    clientName: client.name,
    currency: client.currency,
    metrics,
    persona,
    notes: `A Meta ad sync just completed: ${sync.campaigns} campaigns, ${sync.metricRows} metric rows updated at ${sync.syncedAt}. Write a 1-2 sentence summary of campaign performance for the Ads dashboard.`,
  });

  await notifier.notify({
    clientId: client.id,
    kind: "campaign_narrative",
    title: advice.headline,
    body: advice.details,
    meta: { sync },
  });
}

/**
 * AI narrative for a scheduled/on-demand report (Step 8). Returns the advice
 * alongside the exact metrics snapshot used, so the caller can persist both
 * for the report's provenance (same pattern as ai_suggestions.prompt_context).
 */
export async function generateReportNarrative(
  client: ClientInfo,
  period: { label: string; periodStart: string; periodEnd: string },
): Promise<{ advice: AiAdvice; metrics: Record<string, number | string> }> {
  const { ai } = getProviders();
  // Service-level metrics (not the cookie-based metricsForClient) — reports
  // must generate identically whether triggered by an admin click (has a
  // session) or the scheduler (no session at all).
  const metrics = await reportMetricsForClient(client, period.periodStart, period.periodEnd);
  const persona = await personaFor(client.id, "master");

  const advice = await ai.advise({
    task: "report_narrative",
    clientName: client.name,
    currency: client.currency,
    metrics,
    persona,
    notes: `Write a ${period.label} performance report narrative (3-5 sentences) for the period ${period.periodStart} to ${period.periodEnd}. Cover revenue/cash progress, close rate, and ad performance; call out anything that needs attention.`,
  });

  return { advice, metrics };
}
