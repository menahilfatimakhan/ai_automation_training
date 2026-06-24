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
      <span className="text-neutral-400">{tags.length ? tags.join(", ") : "—"}</span>
    );
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        {tags.length === 0 && <span className="text-neutral-500">—</span>}
        {tags.map((t) => (
          <span
            key={t}
            className="rounded bg-neutral-800 px-1.5 py-0.5 text-[11px] text-neutral-200"
          >
            {t}
          </span>
        ))}
        <button
          onClick={() => setOpen(true)}
          className="text-[11px] text-neutral-500 hover:text-white"
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
        className="w-40 rounded border border-neutral-700 bg-neutral-950 px-1.5 py-0.5 text-[11px] outline-none focus:border-brand"
      />
      <button className="text-[11px] text-brand hover:underline">save</button>
    </form>
  );
}
