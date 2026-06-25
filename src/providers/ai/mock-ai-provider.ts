import type {
  AiAdvice,
  AiContext,
  AiProvider,
  ChatMessage,
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

  /**
   * Deterministic, offline chat. It grounds answers in the supplied metrics and
   * the user's question — it never fabricates figures, mirroring the real
   * provider's advisory-only contract.
   */
  async chat(
    context: { clientName: string; currency: string; metrics: Record<string, number | string> },
    messages: ChatMessage[],
  ): Promise<string> {
    const last = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const m = context.metrics;
    const q = last.toLowerCase();

    const pick = (...keys: string[]) =>
      keys
        .filter((k) => m[k] !== undefined)
        .map((k) => `${k.replace(/_/g, " ")}: ${m[k]}`)
        .join(" · ");

    let focus: string;
    if (/close|conversion|win/.test(q)) {
      focus = pick("close_rate", "avg_deal_size", "no_show_rate");
    } else if (/ad|spend|roas|campaign|cost/.test(q)) {
      focus = pick("ad_spend", "roas", "cost_per_call");
    } else if (/cash|revenue|money|goal/.test(q)) {
      focus = pick("revenue", "cash_collected");
    } else {
      focus = pick("revenue", "close_rate", "roas");
    }

    return [
      `For ${context.clientName}, here's what the current numbers say — ${focus || "no metrics available yet"}.`,
      "Based on that, two things I'd prioritise: (1) tighten qualification on booked calls to lift close rate, and (2) shift budget toward the lowest cost-per-call campaigns.",
      "Want me to break any of these down further?",
    ].join(" ");
  }
}
