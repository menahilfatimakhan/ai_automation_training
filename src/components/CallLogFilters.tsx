"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const PRESETS: { value: string; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "ytd", label: "YTD" },
  { value: "all", label: "All time" },
];
const OUTCOMES = ["all", "closed", "rescheduled", "lost", "no_show"];

/** Search / outcome / date-preset filter bar. Pushes state to the URL. */
export function CallLogFilters({
  preset,
  outcome,
  search,
}: {
  preset: string;
  outcome: string;
  search: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(patch: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) next.set(k, v);
    next.set("page", "1"); // reset pagination on filter change
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <div className="flex gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => update({ preset: p.value })}
            className={`rounded px-2 py-1 ${
              preset === p.value
                ? "bg-brand text-white"
                : "border border-line text-ink-soft hover:text-ink"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-1 text-ink-soft">
        Outcome
        <select
          value={outcome}
          onChange={(e) => update({ outcome: e.target.value })}
          className="rounded border border-line bg-surface-sunken px-2 py-1 outline-none focus:border-brand"
        >
          {OUTCOMES.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </label>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          update({ search: String(data.get("search") ?? "") });
        }}
        className="flex items-center gap-1"
      >
        <input
          name="search"
          defaultValue={search}
          placeholder="Search source / objection / notes"
          className="w-56 rounded border border-line bg-surface-sunken px-2 py-1 outline-none focus:border-brand"
        />
        <button className="rounded border border-line px-2 py-1 text-ink-soft hover:text-ink">
          Search
        </button>
      </form>
    </div>
  );
}
