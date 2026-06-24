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
  return (
    <li className="flex items-center justify-between border-t border-neutral-800 py-2 text-sm">
      <div>
        <span className={done ? "text-neutral-500 line-through" : ""}>
          {leadName ?? "Lead"} {dueDate && <span className="text-neutral-500">· due {dueDate}</span>}
        </span>
        {notes && <div className="text-xs text-neutral-500">{notes}</div>}
        {ownerLabel && <div className="text-[11px] text-neutral-600">{ownerLabel}</div>}
      </div>
      <form action={toggleFollowUp}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value={status} />
        <button className={`text-xs ${done ? "text-neutral-400 hover:text-white" : "text-brand hover:underline"}`}>
          {done ? "Reopen" : "Mark done"}
        </button>
      </form>
    </li>
  );
}
