"use client";

import { useState } from "react";
import { updateCall, deleteCall } from "@/app/dashboard/call-logs/actions";
import { TagEditor } from "@/components/TagEditor";
import { OutcomeBadge, Money } from "@/components/badges";
import { formatMoney } from "@/lib/format";
import type { CallRow } from "@/lib/data/dashboards";

const OUTCOME_LABEL: Record<string, string> = {
  closed: "Closed",
  rescheduled: "Rescheduled",
  lost: "Lost",
  no_show: "No-show",
};
const inputCls =
  "w-full rounded border border-line bg-surface-sunken px-2 py-1 text-xs outline-none focus:border-brand";

export function CallLogRow({ call, canEdit }: { call: CallRow; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <tr className="border-t border-line bg-surface-sunken/60">
        <td colSpan={7} className="p-3">
          <form action={updateCall} onSubmit={() => setEditing(false)} className="grid grid-cols-3 gap-2">
            <input type="hidden" name="id" value={call.id} />
            <label className="text-[11px] text-ink-soft">
              Outcome
              <select name="outcome" defaultValue={call.outcome} className={inputCls}>
                {Object.entries(OUTCOME_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>
            <label className="text-[11px] text-ink-soft">
              Revenue
              <input name="revenue" type="number" step="any" defaultValue={call.revenue} className={inputCls} />
            </label>
            <label className="text-[11px] text-ink-soft">
              Cash collected
              <input name="cashCollected" type="number" step="any" defaultValue={call.cashCollected} className={inputCls} />
            </label>
            <label className="text-[11px] text-ink-soft">
              Lead source
              <input name="leadSource" defaultValue={call.leadSource ?? ""} className={inputCls} />
            </label>
            <label className="text-[11px] text-ink-soft">
              Objection
              <input name="objectionReason" defaultValue={call.objectionReason ?? ""} className={inputCls} />
            </label>
            <label className="text-[11px] text-ink-soft">
              Notes
              <input name="notes" defaultValue={call.notes ?? ""} className={inputCls} />
            </label>
            <div className="col-span-3 flex gap-2">
              <button className="rounded bg-brand px-3 py-1 text-xs font-medium text-white hover:bg-brand-dark">
                Save
              </button>
              <button type="button" onClick={() => setEditing(false)} className="text-xs text-ink-soft hover:text-ink">
                Cancel
              </button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-line">
      <td className="py-1.5">{call.date}</td>
      <td className="py-1.5"><OutcomeBadge outcome={call.outcome} /></td>
      <td className="py-1.5 tabular-nums">
        <Money amount={call.revenue} formatted={formatMoney(call.revenue, call.currency)} />
      </td>
      <td className="py-1.5 tabular-nums">
        <Money amount={call.cashCollected} formatted={formatMoney(call.cashCollected, call.currency)} />
      </td>
      <td className="py-1.5 text-ink-soft">{call.leadSource ?? "—"}</td>
      <td className="py-1.5">
        <TagEditor id={call.id} tags={call.tags} editable={canEdit} />
      </td>
      <td className="py-1.5 text-right">
        {canEdit && (
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(true)} className="text-xs text-ink-soft hover:text-ink">
              Edit
            </button>
            <form action={deleteCall}>
              <input type="hidden" name="id" value={call.id} />
              <button className="text-xs text-accent-rose hover:text-accent-rose">Delete</button>
            </form>
          </div>
        )}
      </td>
    </tr>
  );
}
