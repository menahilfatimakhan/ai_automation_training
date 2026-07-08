"use client";

import {
  runInsights,
  runNextBestAction,
  markNotificationsRead,
} from "@/app/dashboard/ai-actions";
import type { NotificationRow } from "@/lib/data/notifications";

const KIND_LABEL: Record<string, string> = {
  ai_insight: "Insight",
  next_best_action: "Next best action",
  loss_debrief: "Loss debrief",
  campaign_narrative: "Campaign summary",
  alert: "Alert",
  anomaly_alert: "Anomaly alert",
  daily_target: "Daily target",
  eod_report: "EOD report",
  weekly_report: "Weekly report",
  monthly_report: "Monthly report",
  shame_fame: "Shame / Fame",
  streak: "Streak",
  big_deal: "Big deal",
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
  dashboard = "master",
}: {
  clientId: string;
  notifications: NotificationRow[];
  readOnly: boolean;
  /** Which dashboard's AI persona to apply (Settings → AI coaching personality). */
  dashboard?: "master" | "sales" | "ads" | "setter";
}) {
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="panel-title">AI coaching</h2>
          {unread > 0 && (
            <span className="badge bg-brand-soft text-brand">{unread} new</span>
          )}
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <form action={runInsights}>
              <input type="hidden" name="clientId" value={clientId} />
              <input type="hidden" name="dashboard" value={dashboard} />
              <button className="rounded-lg border border-brand/40 px-2.5 py-1 text-xs text-brand hover:bg-brand-soft">
                Generate insights
              </button>
            </form>
            <form action={runNextBestAction}>
              <input type="hidden" name="clientId" value={clientId} />
              <input type="hidden" name="dashboard" value={dashboard} />
              <button className="rounded-lg border border-brand/40 px-2.5 py-1 text-xs text-brand hover:bg-brand-soft">
                Next best action
              </button>
            </form>
          </div>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className="text-sm text-ink-faint">
          No AI messages yet. Generate insights to get coaching.
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`rounded-lg border p-2.5 text-xs ${
                  n.read
                    ? "border-line bg-surface-sunken"
                    : "border-brand/30 bg-brand-soft"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-brand">
                    {KIND_LABEL[n.kind] ?? n.kind}
                  </span>
                  <span className="text-ink-faint">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="mt-0.5 font-medium text-ink">{n.title}</div>
                <div className="text-ink-soft">{n.body}</div>
              </li>
            ))}
          </ul>
          {unread > 0 && (
            <form action={markNotificationsRead} className="mt-3">
              <input type="hidden" name="clientId" value={clientId} />
              <button className="text-xs text-ink-faint hover:text-ink">
                Mark all as read
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
