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
      <span className="text-xs text-ink-faint">{lastSyncedLabel}</span>
      <form action={action}>
        <input type="hidden" name="clientId" value={clientId} />
        <button disabled={pending} className="btn-primary py-1.5">
          {pending ? "Syncing…" : "Sync now"}
        </button>
      </form>
      {state.message && (
        <span className={`text-xs ${state.ok ? "text-brand" : "text-accent-amber"}`}>
          {state.message}
        </span>
      )}
    </div>
  );
}
