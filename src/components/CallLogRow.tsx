"use client";

import { useState } from "react";
import { updateCall, deleteCall } from "@/app/dashboard/call-logs/actions";
import { TagEditor } from "@/components/TagEditor";
import { OutcomeBadge, Money } from "@/components/badges";
import { formatMoney } from "@/lib/format";
import { CALL_OUTCOMES, OBJECTION_TYPES, OUTCOME_LABELS, OBJECTION_LABELS, bucketOf } from "@/domain/metrics";
import type { CallRow } from "@/lib/data/dashboards";

const inputCls =
  "w-full rounded border border-line bg-surface-sunken px-2 py-1 text-xs outline-none focus:border-brand";

export function CallLogRow({ call, canEdit }: { call: CallRow; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [outcome, setOutcome] = useState(call.outcome);

  if (editing) {
    return (
      <tr className="border-t border-line bg-surface-sunken/60">
        <td colSpan={7} className="p-3">
          <form action={updateCall} onSubmit={() => setEditing(false)} className="grid grid-cols-3 gap-2">
            <input type="hidden" name="id" value={call.id} />
            <label className="text-[11px] text-ink-soft">
              Outcome
              <select
                name="outcome"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as CallRow["outcome"])}
                className={inputCls}
              >
                {CALL_OUTCOMES.map((v) => (
                  <option key={v} value={v}>{OUTCOME_LABELS[v]}</option>
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
            {bucketOf(outcome) === "showed_not_closed" && (
              <label className="text-[11px] text-ink-soft">
                Objection
                <select name="objectionType" defaultValue={call.objectionType ?? ""} className={inputCls}>
                  <option value="">Untagged</option>
                  {OBJECTION_TYPES.map((v) => (
                    <option key={v} value={v}>{OBJECTION_LABELS[v]}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="text-[11px] text-ink-soft">
              Objection notes
              <input name="objectionNotes" defaultValue={call.objectionNotes ?? ""} className={inputCls} />
            </label>
            <label className="text-[11px] text-ink-soft">
              Contact name
              <input name="contactName" defaultValue={call.contactName ?? ""} className={inputCls} />
            </label>
            <label className="text-[11px] text-ink-soft">
              Contact phone
              <input name="contactPhone" defaultValue={call.contactPhone ?? ""} className={inputCls} />
            </label>
            <label className="text-[11px] text-ink-soft">
              Contact email
              <input name="contactEmail" defaultValue={call.contactEmail ?? ""} className={inputCls} />
            </label>
            <label className="col-span-3 text-[11px] text-ink-soft">
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
    <>
      <tr
        className="cursor-pointer border-t border-line hover:bg-surface-sunken/40"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="py-1.5">{call.date}</td>
        <td className="py-1.5"><OutcomeBadge outcome={call.outcome} /></td>
        <td className="py-1.5 tabular-nums">
          <Money amount={call.revenue} formatted={formatMoney(call.revenue, call.currency)} />
        </td>
        <td className="py-1.5 tabular-nums">
          <Money amount={call.cashCollected} formatted={formatMoney(call.cashCollected, call.currency)} />
        </td>
        <td className="py-1.5 text-ink-soft">{call.leadSource ?? "—"}</td>
        <td className="py-1.5" onClick={(e) => e.stopPropagation()}>
          <TagEditor id={call.id} tags={call.tags} editable={canEdit} />
        </td>
        <td className="py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
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
      {expanded && (
        <tr className="border-t border-line bg-surface-sunken/30">
          <td colSpan={7} className="p-3 text-xs text-ink-soft">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-ink-faint">Contact</div>
                <div>{call.contactName ?? "—"}</div>
                <div>{call.contactPhone ?? "—"}</div>
                <div>{call.contactEmail ?? "—"}</div>
              </div>
              <div>
                <div className="text-ink-faint">Objection</div>
                <div>{call.objectionType ? OBJECTION_LABELS[call.objectionType] : "—"}</div>
                <div>{call.objectionNotes ?? "—"}</div>
              </div>
              <div>
                <div className="text-ink-faint">Notes</div>
                <div>{call.notes ?? "—"}</div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
