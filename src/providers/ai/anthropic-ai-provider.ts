import Anthropic from "@anthropic-ai/sdk";
import type {
  AiAdvice,
  AiContext,
  AiProvider,
  ChatMessage,
} from "@/providers/ports/ai-provider";

/**
 * AnthropicAiProvider — real advisory AI. The authoritative metrics are passed
 * in the user message; a strict system prompt forbids inventing or recomputing
 * numbers and requires JSON output. Selected when AI_PROVIDER=anthropic.
 *
 * The system prompt is marked with cache_control so repeated calls reuse it
 * (prompt caching), reducing latency and cost.
 */
const SYSTEM = `You are an advisory sales/marketing analyst for a multi-tenant agency dashboard.
RULES (non-negotiable):
- You NEVER compute, invent, or alter numbers. The metrics provided are authoritative and already computed.
- You only explain what the numbers mean and suggest actions.
- If you include a numeric "suggestedValue", it is a recommendation a human must approve; never present it as the actual metric.
Respond ONLY with minified JSON matching:
{"headline": string, "details": string, "suggestions": [{"targetKey": string, "suggestedValue": number|null, "rationale": string}]}`;

export class AnthropicAiProvider implements AiProvider {
  readonly name = "anthropic";
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
    this.model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
  }

  async advise(ctx: AiContext): Promise<AiAdvice> {
    const userContent = [
      `Task: ${ctx.task}`,
      `Client: ${ctx.clientName} (reporting currency ${ctx.currency})`,
      `Authoritative metrics (do not recompute): ${JSON.stringify(ctx.metrics)}`,
      ctx.notes ? `Context: ${ctx.notes}` : "",
      "Return advisory JSON only.",
    ]
      .filter(Boolean)
      .join("\n");

    const resp = await this.client.messages.create({
      model: this.model,
      max_tokens: 700,
      // cache_control marks the system prompt for prompt caching. Cast keeps
      // compatibility across SDK versions whose types may predate the field.
      system: [
        {
          type: "text",
          text: SYSTEM,
          cache_control: { type: "ephemeral" },
        } as unknown as Anthropic.TextBlockParam,
      ],
      messages: [{ role: "user", content: userContent }],
    });

    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    return parseAdvice(text);
  }

  async chat(
    context: { clientName: string; currency: string; metrics: Record<string, number | string> },
    messages: ChatMessage[],
  ): Promise<string> {
    const system = `You are "Coach", an advisory sales/marketing analyst inside an agency dashboard for client "${context.clientName}" (reporting currency ${context.currency}).
RULES: The metrics below are authoritative and already computed — NEVER invent, recompute, or alter numbers; only explain them and recommend actions. Be concise, practical, and specific. Plain text only.
Authoritative metrics: ${JSON.stringify(context.metrics)}`;

    const resp = await this.client.messages.create({
      model: this.model,
      max_tokens: 600,
      system: [
        { type: "text", text: system, cache_control: { type: "ephemeral" } } as unknown as Anthropic.TextBlockParam,
      ],
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    return resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  }
}

/** Parse the model's JSON, tolerating stray prose around it. */
function parseAdvice(text: string): AiAdvice {
  const match = text.match(/\{[\s\S]*\}/);
  const fallback: AiAdvice = {
    headline: "AI insight",
    details: text.slice(0, 500),
    suggestions: [],
  };
  if (!match) return fallback;
  try {
    const parsed = JSON.parse(match[0]);
    return {
      headline: String(parsed.headline ?? "AI insight"),
      details: String(parsed.details ?? ""),
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.map((s: Record<string, unknown>) => ({
            targetKey: String(s.targetKey ?? "insight"),
            suggestedValue:
              s.suggestedValue === null || s.suggestedValue === undefined
                ? null
                : Number(s.suggestedValue),
            rationale: String(s.rationale ?? ""),
          }))
        : [],
    };
  } catch {
    return fallback;
  }
}
