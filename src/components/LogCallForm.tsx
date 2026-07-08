"use client";

import { useState } from "react";
import { logCall } from "@/app/dashboard/sales/actions";
import { ActionForm } from "@/components/ActionForm";
import { todayIso } from "@/lib/format";
import {
  CALL_OUTCOMES,
  OBJECTION_TYPES,
  OUTCOME_LABELS,
  OBJECTION_LABELS,
  bucketOf,
  type CallOutcome,
} from "@/domain/metrics";

const inputCls =
  "mt-1 w-full rounded border border-line bg-surface-sunken px-2 py-1.5 text-sm outline-none focus:border-brand";

const OUTCOME_GROUPS: { label: string; outcomes: CallOutcome[] }[] = [
  { label: "Closed", outcomes: ["paid_in_full", "split_pay"] },
  { label: "Showed, didn't close", outcomes: ["offer_declined", "not_a_fit", "deposit_only"] },
  { label: "No-show", outcomes: ["no_show", "cancelled"] },
  { label: "Rescheduled", outcomes: ["rescheduled"] },
];

export function LogCallForm({
  clientId,
  currency,
}: {
  clientId: string;
  currency: string;
}) {
  const [outcome, setOutcome] = useState<CallOutcome>(CALL_OUTCOMES[0]);
  const showObjection = bucketOf(outcome) === "showed_not_closed";

  return (
    <ActionForm action={logCall} success="Call logged" className="grid grid-cols-2 gap-3">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="currency" value={currency} />

      <label className="text-xs text-ink-soft">
        Outcome
        <select
          name="outcome"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as CallOutcome)}
          className={inputCls}
        >
          {OUTCOME_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.outcomes.map((o) => (
                <option key={o} value={o}>{OUTCOME_LABELS[o]}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <label className="text-xs text-ink-soft">
        Date
        <input type="date" name="date" defaultValue={todayIso()} className={inputCls} />
      </label>

      <label className="text-xs text-ink-soft">
        Revenue ({currency})
        <input type="number" step="any" name="revenue" defaultValue={0} className={inputCls} />
      </label>

      <label className="text-xs text-ink-soft">
        Cash collected ({currency})
        <input type="number" step="any" name="cashCollected" defaultValue={0} className={inputCls} />
      </label>

      <label className="text-xs text-ink-soft">
        Lead source
        <input name="leadSource" placeholder="paid_ads, referral…" className={inputCls} />
      </label>

      {showObjection && (
        <label className="text-xs text-ink-soft">
          Objection
          <select name="objectionType" defaultValue="" className={inputCls}>
            <option value="">Untagged</option>
            {OBJECTION_TYPES.map((o) => (
              <option key={o} value={o}>{OBJECTION_LABELS[o]}</option>
            ))}
          </select>
        </label>
      )}

      {showObjection && (
        <label className="text-xs text-ink-soft">
          Objection notes
          <input name="objectionNotes" placeholder="price, timing…" className={inputCls} />
        </label>
      )}

      <label className="text-xs text-ink-soft">
        Contact name
        <input name="contactName" className={inputCls} />
      </label>

      <label className="text-xs text-ink-soft">
        Contact phone
        <input name="contactPhone" className={inputCls} />
      </label>

      <label className="col-span-2 text-xs text-ink-soft">
        Contact email
        <input name="contactEmail" type="email" className={inputCls} />
      </label>

      <label className="col-span-2 text-xs text-ink-soft">
        Tags (comma-separated)
        <input name="tags" placeholder="hot, enterprise" className={inputCls} />
      </label>

      <label className="col-span-2 text-xs text-ink-soft">
        Notes
        <textarea name="notes" rows={2} className={inputCls} />
      </label>

      <button className="col-span-2 rounded bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark">
        Log call
      </button>
    </ActionForm>
  );
}
