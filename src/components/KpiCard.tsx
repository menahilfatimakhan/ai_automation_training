import { formatMetric as fm } from "@/components/format-value";
import { OverrideControl } from "@/components/OverrideControl";
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
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-start justify-between">
        <span className="text-sm text-neutral-400">{card.label}</span>
        {card.overridden && (
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-400">
            {card.source === "ai_suggestion" ? "AI override" : "Override"}
          </span>
        )}
      </div>

      <div className="mt-1 text-2xl font-semibold">
        {fm(card.effective, card.format, currency)}
      </div>

      {card.overridden && (
        <div className="mt-0.5 text-xs text-neutral-500">
          computed {fm(card.computed, card.format, currency)}
        </div>
      )}

      {card.goal && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-neutral-400">
            <span>Goal</span>
            <span>
              {fm(card.goal.target, card.format, currency)} (
              {Math.round(card.goal.progress * 100)}%)
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-neutral-800">
            <div
              className="h-full bg-brand"
              style={{ width: `${Math.min(100, Math.round(card.goal.progress * 100))}%` }}
            />
          </div>
        </div>
      )}

      {card.suggestion && (
        <div className="mt-3 rounded border border-sky-500/30 bg-sky-500/10 p-2 text-xs text-sky-200">
          <span className="font-medium">AI: </span>
          {card.suggestion.rationale}
          {card.suggestion.value !== null && (
            <span className="ml-1 text-sky-300">
              (suggests {fm(card.suggestion.value, card.format, currency)})
            </span>
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
