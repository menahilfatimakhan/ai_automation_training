"use client";

import { useState } from "react";
import { logCall } from "@/app/dashboard/sales/actions";
import { todayIso } from "@/lib/format";

const inputCls =
  "mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm outline-none focus:border-brand";

export function LogCallForm({
  clientId,
  currency,
}: {
  clientId: string;
  currency: string;
}) {
  const [outcome, setOutcome] = useState("closed");

  return (
    <form action={logCall} className="grid grid-cols-2 gap-3">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="currency" value={currency} />

      <label className="text-xs text-neutral-400">
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

      <label className="text-xs text-neutral-400">
        Date
        <input type="date" name="date" defaultValue={todayIso()} className={inputCls} />
      </label>

      <label className="text-xs text-neutral-400">
        Revenue ({currency})
        <input type="number" step="any" name="revenue" defaultValue={0} className={inputCls} />
      </label>

      <label className="text-xs text-neutral-400">
        Cash collected ({currency})
        <input type="number" step="any" name="cashCollected" defaultValue={0} className={inputCls} />
      </label>

      <label className="text-xs text-neutral-400">
        Lead source
        <input name="leadSource" placeholder="paid_ads, referral…" className={inputCls} />
      </label>

      {outcome === "lost" && (
        <label className="text-xs text-neutral-400">
          Objection
          <input name="objectionReason" placeholder="price, timing…" className={inputCls} />
        </label>
      )}

      <label className="col-span-2 text-xs text-neutral-400">
        Tags (comma-separated)
        <input name="tags" placeholder="hot, enterprise" className={inputCls} />
      </label>

      <label className="col-span-2 text-xs text-neutral-400">
        Notes
        <textarea name="notes" rows={2} className={inputCls} />
      </label>

      <button className="col-span-2 rounded bg-brand px-3 py-2 text-sm font-medium text-black hover:bg-brand-dark">
        Log call
      </button>
    </form>
  );
}
