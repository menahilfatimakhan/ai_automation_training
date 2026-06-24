"use client";

import { useState } from "react";
import { setLeadTags, reassignLead } from "@/app/dashboard/leads/actions";
import type { ClientMember, LeadRow as Lead } from "@/lib/data/leads";

export function LeadRow({
  lead,
  members,
  isAdmin,
}: {
  lead: Lead;
  members: ClientMember[];
  isAdmin: boolean;
}) {
  const [editingTags, setEditingTags] = useState(false);
  const ownerName =
    members.find((m) => m.userId === lead.ownerUserId)?.name ?? "Unassigned";

  return (
    <tr className="border-t border-neutral-800">
      <td className="py-1.5">{lead.name}</td>
      <td className="py-1.5 text-neutral-400">{lead.contact ?? "—"}</td>
      <td className="py-1.5 text-neutral-400">{lead.source ?? "—"}</td>
      <td className="py-1.5">{lead.status}</td>
      <td className="py-1.5">
        {editingTags ? (
          <form action={setLeadTags} onSubmit={() => setEditingTags(false)} className="flex items-center gap-1">
            <input type="hidden" name="id" value={lead.id} />
            <input
              name="tags"
              defaultValue={lead.tags.join(", ")}
              autoFocus
              className="w-40 rounded border border-neutral-700 bg-neutral-950 px-1.5 py-0.5 text-[11px] outline-none focus:border-brand"
            />
            <button className="text-[11px] text-brand hover:underline">save</button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-1">
            {lead.tags.length === 0 && <span className="text-neutral-500">—</span>}
            {lead.tags.map((t) => (
              <span key={t} className="rounded bg-neutral-800 px-1.5 py-0.5 text-[11px]">
                {t}
              </span>
            ))}
            <button onClick={() => setEditingTags(true)} className="text-[11px] text-neutral-500 hover:text-white">
              edit
            </button>
          </div>
        )}
      </td>
      <td className="py-1.5">
        {isAdmin ? (
          <form action={reassignLead}>
            <input type="hidden" name="id" value={lead.id} />
            <select
              name="ownerUserId"
              defaultValue={lead.ownerUserId ?? ""}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className="rounded border border-neutral-700 bg-neutral-950 px-1.5 py-0.5 text-[11px] outline-none focus:border-brand"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name} ({m.role})
                </option>
              ))}
            </select>
          </form>
        ) : (
          <span className="text-neutral-400">{ownerName}</span>
        )}
      </td>
    </tr>
  );
}
