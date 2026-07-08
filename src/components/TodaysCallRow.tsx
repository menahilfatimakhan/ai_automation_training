"use client";

import { useState } from "react";
import { OutcomeBadge, Money } from "@/components/badges";
import { TagEditor } from "@/components/TagEditor";
import { OBJECTION_LABELS } from "@/domain/metrics";
import { formatMoney } from "@/lib/format";
import type { CallRow } from "@/lib/data/dashboards";

/**
 * A row in the Sales dashboard's "Today's calls" table. Click to expand full
 * notes, objection detail, and contact info (captured on log but otherwise
 * hidden from the compact table).
 */
export function TodaysCallRow({ call, closerName }: { call: CallRow; closerName: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="cursor-pointer border-t border-line hover:bg-surface-sunken/40"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="py-1.5"><OutcomeBadge outcome={call.outcome} /></td>
        <td className="py-1.5 text-ink-soft">{closerName}</td>
        <td className="py-1.5">
          <Money amount={call.revenue} formatted={formatMoney(call.revenue, call.currency)} />
        </td>
        <td className="py-1.5">
          <Money amount={call.cashCollected} formatted={formatMoney(call.cashCollected, call.currency)} />
        </td>
        <td className="py-1.5 text-ink-soft">{call.leadSource ?? "—"}</td>
        <td className="py-1.5" onClick={(e) => e.stopPropagation()}>
          <TagEditor id={call.id} tags={call.tags} />
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-line bg-surface-sunken/30">
          <td colSpan={6} className="p-3 text-xs text-ink-soft">
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
