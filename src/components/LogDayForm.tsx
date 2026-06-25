"use client";

import { logSetterDay } from "@/app/dashboard/setter/actions";
import { todayIso } from "@/lib/format";

const inputCls =
  "mt-1 w-full rounded border border-line bg-surface-sunken px-2 py-1.5 text-sm outline-none focus:border-brand";

const FIELDS: { name: string; label: string }[] = [
  { name: "conversations", label: "Conversations" },
  { name: "replies", label: "Replies" },
  { name: "proposals", label: "Proposals" },
  { name: "callsBooked", label: "Calls booked" },
  { name: "followUps", label: "Follow-ups" },
];

export function LogDayForm({
  clientId,
  defaults,
}: {
  clientId: string;
  defaults?: Partial<Record<string, number>> & { date?: string };
}) {
  return (
    <form action={logSetterDay} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <input type="hidden" name="clientId" value={clientId} />
      <label className="text-xs text-ink-soft">
        Date
        <input
          type="date"
          name="date"
          defaultValue={defaults?.date ?? todayIso()}
          className={inputCls}
        />
      </label>
      {FIELDS.map((f) => (
        <label key={f.name} className="text-xs text-ink-soft">
          {f.label}
          <input
            type="number"
            min={0}
            name={f.name}
            defaultValue={defaults?.[f.name] ?? 0}
            className={inputCls}
          />
        </label>
      ))}
      <button className="col-span-2 rounded bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark sm:col-span-3">
        Save day
      </button>
    </form>
  );
}
