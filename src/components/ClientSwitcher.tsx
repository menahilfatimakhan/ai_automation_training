"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ClientOption } from "@/lib/data/client-scope";

/** Lets admins (and multi-client users) switch the active client via ?client=. */
export function ClientSwitcher({
  options,
  activeId,
}: {
  options: ClientOption[];
  activeId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  if (options.length <= 1) return null;

  return (
    <select
      value={activeId}
      onChange={(e) => {
        const next = new URLSearchParams(params);
        next.set("client", e.target.value);
        router.push(`${pathname}?${next.toString()}`);
      }}
      className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm outline-none focus:border-brand"
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name} ({o.reportingCurrency})
        </option>
      ))}
    </select>
  );
}
