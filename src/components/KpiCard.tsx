import { formatMetric as fm } from "@/components/format-value";
import { OverrideControl } from "@/components/OverrideControl";
import { acceptSuggestion, dismissSuggestion } from "@/app/dashboard/ai-actions";
import type { KpiCardVM } from "@/lib/data/master";

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
}: {
  card: KpiCardVM;
  clientId: string;
  periodStart: string;
  periodEnd: string;
  readOnly: boolean;
}) {
  const currency = card.currency ?? "USD";
  const progress = card.goal ? Math.min(100, Math.round(card.goal.progress * 100)) : 0;

  return (
    <div className="card group p-5 transition-colors hover:border-line-strong">
      <div className="flex items-start justify-between">
        <span className="text-[13px] font-medium text-ink-soft">{card.label}</span>
        {card.overridden && (
          <span className="badge bg-accent-amber/15 text-accent-amber">
            {card.source === "ai_suggestion" ? "AI" : "Manual"}
          </span>
        )}
      </div>

      <div className="mt-2 text-[26px] font-semibold leading-none tracking-tight">
        {fm(card.effective, card.format, currency)}
      </div>

      {card.overridden && (
        <div className="mt-1 text-xs text-ink-faint">
          computed {fm(card.computed, card.format, currency)}
        </div>
      )}

      {card.goal && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-ink-faint">
            <span>Goal {fm(card.goal.target, card.format, currency)}</span>
            <span className={progress >= 100 ? "text-brand" : "text-ink-soft"}>
              {progress}%
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full rounded-full bg-brand transition-[width]"
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
              <form action={acceptSuggestion}>
                <input type="hidden" name="id" value={card.suggestion.id} />
                <button className="font-medium text-brand hover:underline">
                  Accept → override
                </button>
              </form>
              <form action={dismissSuggestion}>
                <input type="hidden" name="id" value={card.suggestion.id} />
                <button className="text-ink-faint hover:text-ink">Dismiss</button>
              </form>
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
