"use client";

import { useState } from "react";
import { setCallTags } from "@/app/dashboard/call-logs/actions";

/** Inline tag editor for a call. Read-only chips until "edit"; saves via action. */
export function TagEditor({
  id,
  tags,
  editable = true,
}: {
  id: string;
  tags: string[];
  editable?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!editable) {
    return (
      <span className="text-ink-soft">{tags.length ? tags.join(", ") : "—"}</span>
    );
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        {tags.length === 0 && <span className="text-ink-faint">—</span>}
        {tags.map((t) => (
          <span
            key={t}
            className="rounded bg-surface-raised px-1.5 py-0.5 text-[11px] text-ink"
          >
            {t}
          </span>
        ))}
        <button
          onClick={() => setOpen(true)}
          className="text-[11px] text-ink-faint hover:text-ink"
        >
          edit
        </button>
      </div>
    );
  }

  return (
    <form
      action={setCallTags}
      onSubmit={() => setOpen(false)}
      className="flex items-center gap-1"
    >
      <input type="hidden" name="id" value={id} />
      <input
        name="tags"
        defaultValue={tags.join(", ")}
        autoFocus
        placeholder="hot, enterprise"
        className="w-40 rounded border border-line bg-surface-sunken px-1.5 py-0.5 text-[11px] outline-none focus:border-brand"
      />
      <button className="text-[11px] text-brand hover:underline">save</button>
    </form>
  );
}
