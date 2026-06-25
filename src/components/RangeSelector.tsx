"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RANGE_OPTIONS, type RangeKey } from "@/lib/range";

/** Pill group that sets the dashboard time window via ?range=. */
export function RangeSelector({ active }: { active: RangeKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: RangeKey) {
    const next = new URLSearchParams(params);
    next.set("range", key);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex gap-1 rounded-lg border border-line bg-surface-sunken p-0.5 text-xs">
      {RANGE_OPTIONS.map((o) => (
        <button
          key={o.key}
          onClick={() => set(o.key)}
          className={`rounded-md px-2.5 py-1 transition-colors ${
            active === o.key
              ? "bg-brand text-white"
              : "text-ink-soft hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
