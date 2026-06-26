"use client";

import { toggleFollowUp } from "@/app/dashboard/leads/actions";

export function FollowUpItem({
  id,
  leadName,
  dueDate,
  status,
  notes,
  ownerLabel,
}: {
  id: string;
  leadName: string | null;
  dueDate: string | null;
  status: string;
  notes: string | null;
  ownerLabel?: string;
}) {
  const done = status === "done";
  const overdue =
    !done && dueDate !== null && dueDate < new Date().toISOString().slice(0, 10);
  return (
    <li className="flex items-center justify-between border-t border-line py-2 text-sm">
      <div>
        <span className={done ? "text-ink-faint line-through" : ""}>
          {leadName ?? "Lead"}{" "}
          {dueDate && (
            <span className={overdue ? "font-medium text-accent-rose" : "text-ink-faint"}>
              · due {dueDate}
              {overdue ? " (overdue)" : ""}
            </span>
          )}
        </span>
        {notes && <div className="text-xs text-ink-faint">{notes}</div>}
        {ownerLabel && <div className="text-[11px] text-ink-faint">{ownerLabel}</div>}
      </div>
      <form action={toggleFollowUp}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value={status} />
        <button className={`text-xs ${done ? "text-ink-soft hover:text-ink" : "text-brand hover:underline"}`}>
          {done ? "Reopen" : "Mark done"}
        </button>
      </form>
    </li>
  );
}
