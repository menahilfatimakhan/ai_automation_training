"use client";

import { useState } from "react";
import { createManualOverride, clearManualOverride } from "@/app/dashboard/actions";

/**
 * Inline manual-override control for a KPI card. Submits to server actions that
 * write a separate override record (never mutating raw/computed values).
 */
export function OverrideControl({
  clientId,
  targetKey,
  periodStart,
  periodEnd,
  currency,
  computed,
  overridden,
}: {
  clientId: string;
  targetKey: string;
  periodStart: string;
  periodEnd: string;
  currency?: string;
  computed: number;
  overridden: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4 border-t border-line pt-3 text-xs">
      {!open ? (
        <div className="flex gap-4">
          <button
            onClick={() => setOpen(true)}
            className="text-ink-faint hover:text-ink"
          >
            Override
          </button>
          {overridden && (
            <form action={clearManualOverride}>
              <input type="hidden" name="clientId" value={clientId} />
              <input type="hidden" name="targetKey" value={targetKey} />
              <input type="hidden" name="periodStart" value={periodStart} />
              <input type="hidden" name="periodEnd" value={periodEnd} />
              <button className="text-accent-amber hover:opacity-80">
                Clear override
              </button>
            </form>
          )}
        </div>
      ) : (
        <form action={createManualOverride} className="flex items-center gap-2">
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="targetKey" value={targetKey} />
          <input type="hidden" name="periodStart" value={periodStart} />
          <input type="hidden" name="periodEnd" value={periodEnd} />
          <input type="hidden" name="priorValue" value={computed} />
          {currency && <input type="hidden" name="currency" value={currency} />}
          <input
            name="value"
            type="number"
            step="any"
            defaultValue={computed}
            className="input w-24 px-2 py-1"
            aria-label="Override value"
          />
          <button className="btn-primary px-3 py-1">Save</button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="btn-subtle"
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}
