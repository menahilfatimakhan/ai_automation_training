"use client";

import { useActionState } from "react";
import { syncNow, type SyncState } from "@/app/dashboard/ads/actions";

const initial: SyncState = {};

export function SyncButton({
  clientId,
  lastSyncedLabel,
}: {
  clientId: string;
  lastSyncedLabel: string;
}) {
  const [state, action, pending] = useActionState(syncNow, initial);

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-neutral-500">{lastSyncedLabel}</span>
      <form action={action}>
        <input type="hidden" name="clientId" value={clientId} />
        <button
          disabled={pending}
          className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-black hover:bg-brand-dark disabled:opacity-50"
        >
          {pending ? "Syncing…" : "Sync now"}
        </button>
      </form>
      {state.message && (
        <span className={`text-xs ${state.ok ? "text-brand" : "text-amber-400"}`}>
          {state.message}
        </span>
      )}
    </div>
  );
}
