import { describe, expect, it } from "vitest";
import { MockAiProvider } from "@/providers/ai/mock-ai-provider";
import type { AiContext } from "@/providers/ports/ai-provider";

/**
 * Invariant #3: the AI is advisory and is fed pre-computed metrics; it never
 * produces the authoritative numbers. We assert the provider only echoes the
 * metrics it was handed and emits no numeric suggestions of its own here.
 */
describe("MockAiProvider (advisory only)", () => {
  const ctx: AiContext = {
    task: "dashboard_insights",
    clientName: "Acme",
    currency: "USD",
    metrics: { revenue: 12345, close_rate: 0.42 },
  };

  it("references the provided metrics rather than inventing them", async () => {
    const advice = await new MockAiProvider().advise(ctx);
    expect(advice.headline).toContain("12345");
    expect(advice.details.length).toBeGreaterThan(0);
  });

  it("does not emit numeric suggestions unless explicitly modeled", async () => {
    const advice = await new MockAiProvider().advise(ctx);
    // Any suggestion that carries a value must be treated as advisory (pending),
    // never written directly as a metric. The mock emits none.
    expect(advice.suggestions.every((s) => s.suggestedValue === null)).toBe(true);
  });

  it("produces a loss debrief that reflects the supplied context", async () => {
    const advice = await new MockAiProvider().advise({
      ...ctx,
      task: "loss_debrief",
      notes: "objection: price",
    });
    expect(advice.headline.toLowerCase()).toContain("loss");
    expect(advice.details).toContain("price");
  });
});
