"use client";

import { useState } from "react";
import { logCall } from "@/app/dashboard/sales/actions";
import { ActionForm } from "@/components/ActionForm";
import { todayIso } from "@/lib/format";

const inputCls =
  "mt-1 w-full rounded border border-line bg-surface-sunken px-2 py-1.5 text-sm outline-none focus:border-brand";

export function LogCallForm({
  clientId,
  currency,
}: {
  clientId: string;
  currency: string;
}) {
  const [outcome, setOutcome] = useState("closed");

  return (
    <ActionForm action={logCall} success="Call logged" className="grid grid-cols-2 gap-3">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="currency" value={currency} />

      <label className="text-xs text-ink-soft">
        Outcome
        <select
          name="outcome"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          className={inputCls}
        >
          <option value="closed">Closed</option>
          <option value="rescheduled">Rescheduled</option>
          <option value="lost">Lost</option>
          <option value="no_show">No-show</option>
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

      {outcome === "lost" && (
        <label className="text-xs text-ink-soft">
          Objection
          <input name="objectionReason" placeholder="price, timing…" className={inputCls} />
        </label>
      )}

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
