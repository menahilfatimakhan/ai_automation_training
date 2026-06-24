/**
 * AiProvider PORT.
 *
 * The model is ADVISORY ONLY (invariant #3). All authoritative numbers are
 * computed in TypeScript and passed in via `metrics`; the provider explains and
 * suggests but never computes the figures the app treats as truth. A suggested
 * value, when present, is a recommendation that a human must accept (which then
 * creates a manual override) — it is never written as a KPI directly.
 */

export interface AiContext {
  /** What the model is being asked to do. */
  task: "dashboard_insights" | "next_best_action" | "loss_debrief";
  clientName: string;
  currency: string;
  /** Pre-computed, authoritative metrics. The model must not recompute these. */
  metrics: Record<string, number | string>;
  /** Optional extra context (e.g. the lost call, recent objections). */
  notes?: string;
}

export interface AiSuggestionDraft {
  /** Metric this advises on (a MetricKey) or a label like "loss_debrief". */
  targetKey: string;
  /** Optional recommended numeric value (advisory; requires human acceptance). */
  suggestedValue: number | null;
  rationale: string;
}

export interface AiAdvice {
  headline: string;
  details: string;
  suggestions: AiSuggestionDraft[];
}

export interface AiProvider {
  readonly name: string;
  advise(context: AiContext): Promise<AiAdvice>;
}
