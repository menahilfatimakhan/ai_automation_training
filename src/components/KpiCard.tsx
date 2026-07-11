import { formatMetric as fm } from "@/components/format-value";
import { OverrideControl } from "@/components/OverrideControl";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { ActionForm } from "@/components/ActionForm";
import { Sparkline } from "@/components/charts";
import { acceptSuggestion, dismissSuggestion } from "@/app/dashboard/ai-actions";
import type { KpiCardVM, Tone } from "@/lib/data/master";

const TONE_DOT: Record<Tone, string> = {
  green: "bg-accent-green",
  violet: "bg-accent-violet",
  amber: "bg-accent-amber",
  sky: "bg-accent-sky",
  rose: "bg-accent-rose",
  blue: "bg-brand",
};
const TONE_HEX: Record<Tone, string> = {
  green: "#34D399",
  violet: "#A78BFA",
  amber: "#FBBF24",
  sky: "#38BDF8",
  rose: "#FB7185",
  blue: "#3B82F6",
};
const GOAL_TONE_BAR: Record<"green" | "amber" | "red", string> = {
  green: "bg-accent-green",
  amber: "bg-accent-amber",
  red: "bg-accent-rose",
};
const GOAL_TONE_TEXT: Record<"green" | "amber" | "red", string> = {
  green: "text-accent-green",
  amber: "text-accent-amber",
  red: "text-accent-rose",
};

/**
 * A KPI card showing: the effective value (override wins), the computed value
 * when overridden (full transparency), monthly goal progress, an inline manual-
 * override control, and the latest AI suggestion (advisory).
 */
export function KpiCard({
  card,
  clientId,
  periodStart,
  periodEnd,
  readOnly,
  index = 0,
}: {
  card: KpiCardVM;
  clientId: string;
  periodStart: string;
  periodEnd: string;
  readOnly: boolean;
  /** Position within its grid — drives the entrance stagger delay. */
  index?: number;
}) {
  const currency = card.currency ?? "USD";
  const progress = card.goal ? Math.min(100, Math.round(card.goal.progress * 100)) : 0;

  return (
    <div
      className="card enter group p-5 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-pop"
      style={{ "--stagger": index } as React.CSSProperties}
    >
      <div className="flex items-start justify-between">
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink-soft">
          <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[card.tone]} transition-transform duration-200 group-hover:scale-125`} />
          {card.label}
        </span>
        {card.overridden && (
          <span className="badge bg-accent-amber/15 text-accent-amber">
            {card.source === "ai_suggestion" ? "AI" : "Manual"}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-2 text-[26px] font-semibold leading-none tracking-tight">
        <AnimatedNumber value={card.effective} format={card.format} currency={currency} />
        {card.trend && card.trend.direction !== "flat" && (
          <span
            className={`text-xs font-medium ${
              card.trend.direction === "up" ? "text-accent-green" : "text-accent-rose"
            }`}
          >
            {card.trend.direction === "up" ? "↑" : "↓"} {card.trend.pct.toFixed(1)}%
          </span>
        )}
      </div>

      {card.spark && (
        <div className="mt-3 -mb-1">
          <Sparkline data={card.spark} color={TONE_HEX[card.tone]} />
        </div>
      )}

      {card.overridden && (
        <div className="mt-1 text-xs text-ink-faint">
          computed {fm(card.computed, card.format, currency)}
        </div>
      )}

      {card.goal && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-ink-faint">
            <span>Goal {fm(card.goal.target, card.format, currency)}</span>
            <span className={GOAL_TONE_TEXT[card.goal.tone]}>{progress}%</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
            <div
              className={`h-full rounded-full transition-[width] ${GOAL_TONE_BAR[card.goal.tone]}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {card.suggestion && (
        <div className="mt-4 rounded-lg border border-accent-sky/25 bg-accent-sky/5 p-2.5 text-xs text-sky-200">
          <span className="font-medium text-accent-sky">AI · </span>
          {card.suggestion.rationale}
          {card.suggestion.value !== null && (
            <span className="ml-1 text-ink-soft">
              (suggests {fm(card.suggestion.value, card.format, currency)})
            </span>
          )}
          {!readOnly && card.suggestion.value !== null && (
            <div className="mt-2 flex gap-3">
              <ActionForm action={acceptSuggestion} success="Override applied from AI">
                <input type="hidden" name="id" value={card.suggestion.id} />
                <button className="font-medium text-brand hover:underline">
                  Accept → override
                </button>
              </ActionForm>
              <ActionForm action={dismissSuggestion} success="Suggestion dismissed">
                <input type="hidden" name="id" value={card.suggestion.id} />
                <button className="text-ink-faint hover:text-ink">Dismiss</button>
              </ActionForm>
            </div>
          )}
        </div>
      )}

      {!readOnly && (
        <OverrideControl
          clientId={clientId}
          targetKey={card.key}
          periodStart={periodStart}
          periodEnd={periodEnd}
          currency={card.currency}
          computed={card.computed}
          overridden={card.overridden}
        />
      )}
    </div>
  );
}
