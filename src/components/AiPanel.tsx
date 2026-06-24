"use client";

import { runInsights, runNextBestAction } from "@/app/dashboard/ai-actions";
import type { NotificationRow } from "@/lib/data/notifications";

const KIND_LABEL: Record<string, string> = {
  ai_insight: "Insight",
  next_best_action: "Next best action",
  loss_debrief: "Loss debrief",
  alert: "Alert",
};

/**
 * In-app AI panel. Triggers advisory generation (server actions) and shows the
 * notifications delivered via the Notifier. All advisory — no authoritative
 * numbers are produced here.
 */
export function AiPanel({
  clientId,
  notifications,
  readOnly,
}: {
  clientId: string;
  notifications: NotificationRow[];
  readOnly: boolean;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-300">AI coaching</h2>
        {!readOnly && (
          <div className="flex gap-2">
            <form action={runInsights}>
              <input type="hidden" name="clientId" value={clientId} />
              <button className="rounded border border-sky-500/40 px-2 py-1 text-xs text-sky-300 hover:bg-sky-500/10">
                Generate insights
              </button>
            </form>
            <form action={runNextBestAction}>
              <input type="hidden" name="clientId" value={clientId} />
              <button className="rounded border border-sky-500/40 px-2 py-1 text-xs text-sky-300 hover:bg-sky-500/10">
                Next best action
              </button>
            </form>
          </div>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No AI messages yet. Generate insights to get coaching.
        </p>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li key={n.id} className="rounded border border-neutral-800 bg-neutral-950 p-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sky-300">
                  {KIND_LABEL[n.kind] ?? n.kind}
                </span>
                <span className="text-neutral-600">
                  {new Date(n.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="mt-0.5 font-medium text-neutral-200">{n.title}</div>
              <div className="text-neutral-400">{n.body}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
