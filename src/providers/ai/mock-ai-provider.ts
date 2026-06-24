import type {
  AiAdvice,
  AiContext,
  AiProvider,
} from "@/providers/ports/ai-provider";

/**
 * MockAiProvider — deterministic, offline advisory text derived from the
 * pre-computed metrics it is given. No network, no API key. Used in tests and
 * as the default when no Anthropic key is configured.
 *
 * It only echoes/explains the numbers passed in — it never invents metric
 * values — which mirrors the real provider's advisory-only contract.
 */
export class MockAiProvider implements AiProvider {
  readonly name = "mock";

  async advise(ctx: AiContext): Promise<AiAdvice> {
    const m = ctx.metrics;
    switch (ctx.task) {
      case "dashboard_insights":
        return {
          headline: `${ctx.clientName}: ${m["revenue"] ?? "—"} ${ctx.currency} revenue, close rate ${m["close_rate"] ?? "—"}`,
          details:
            "Revenue and close rate are the levers to watch. Consider tightening qualification to lift close rate, and reallocating spend toward the lowest cost-per-call campaigns.",
          suggestions: [],
        };
      case "next_best_action":
        return {
          headline: "Next best action",
          details:
            "Prioritise following up the highest-intent open leads today and re-book recent no-shows; they convert better than cold outreach.",
          suggestions: [],
        };
      case "loss_debrief":
        return {
          headline: "Loss debrief",
          details: `Lost call noted${ctx.notes ? ` (${ctx.notes})` : ""}. Common objection patterns suggest reinforcing value framing earlier and confirming budget authority before the close.`,
          suggestions: [],
        };
    }
  }
}
