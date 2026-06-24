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
    <div className="mt-3 border-t border-neutral-800 pt-2 text-xs">
      {!open ? (
        <div className="flex gap-3">
          <button
            onClick={() => setOpen(true)}
            className="text-neutral-400 hover:text-white"
          >
            Override
          </button>
          {overridden && (
            <form action={clearManualOverride}>
              <input type="hidden" name="clientId" value={clientId} />
              <input type="hidden" name="targetKey" value={targetKey} />
              <input type="hidden" name="periodStart" value={periodStart} />
              <input type="hidden" name="periodEnd" value={periodEnd} />
              <button className="text-amber-400 hover:text-amber-300">
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
            className="w-24 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 outline-none focus:border-brand"
            aria-label="Override value"
          />
          <button className="rounded bg-brand px-2 py-1 font-medium text-black hover:bg-brand-dark">
            Save
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-neutral-400 hover:text-white"
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}
