import { getProviders } from "@/providers/registry";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { computeMasterView } from "@/lib/data/master";
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

async function metricsForClient(client: ClientInfo) {
  const view = await computeMasterView(client.id, client.currency);
  const metrics: Record<string, number | string> = {};
  for (const card of view.cards) {
    metrics[card.key] = Number(card.effective.toFixed(2));
  }
  return { view, metrics };
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
): Promise<AiAdvice> {
  const { ai, notifier } = getProviders();
  const { view, metrics } = await metricsForClient(client);

  const advice = await ai.advise({
    task: scope,
    clientName: client.name,
    currency: client.currency,
    metrics,
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
): Promise<AiAdvice> {
  return generateDashboardInsights(client, "next_best_action");
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

  const advice = await ai.advise({
    task: "loss_debrief",
    clientName: client.name,
    currency: client.currency,
    metrics,
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
