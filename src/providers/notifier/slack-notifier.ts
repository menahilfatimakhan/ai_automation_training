import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { DbNotifier } from "@/providers/notifier/db-notifier";
import type { Notification, NotificationKind, Notifier } from "@/providers/ports/notifier";

/** Which client_settings toggle (if any) gates a given notification kind. */
const KIND_TOGGLE: Partial<Record<NotificationKind, string>> = {
  loss_debrief: "notify_loss_debrief",
  anomaly_alert: "notify_anomaly_alerts",
  alert: "notify_anomaly_alerts",
  daily_target: "notify_daily_targets",
  eod_report: "notify_eod_report",
  weekly_report: "notify_weekly_report",
  monthly_report: "notify_monthly_report",
  shame_fame: "notify_shame_fame",
  streak: "notify_streaks",
  big_deal: "notify_big_deals",
  // ai_insight, next_best_action, campaign_narrative have no dedicated
  // toggle — they send whenever Slack is enabled for the client at all.
};

function slackText(n: Notification): string {
  return `*${n.title}*\n${n.body}`;
}

/**
 * SlackNotifier — real delivery via the Slack Web API (`chat.postMessage`).
 * Always persists to the in-app notifications table first (DbNotifier), so
 * the dashboard panel never depends on Slack succeeding; Slack delivery is
 * best-effort on top; a channel/settings/network failure never blocks the
 * in-app notification.
 */
export class SlackNotifier implements Notifier {
  readonly name = "slack";
  private db = new DbNotifier();

  constructor(private readonly botToken: string) {}

  async notify(n: Notification): Promise<void> {
    await this.db.notify(n);

    try {
      const supabase = createSupabaseServiceClient();
      const { data: settings } = await supabase
        .from("client_settings")
        .select(
          "slack_enabled, slack_channel_id, notify_loss_debrief, notify_anomaly_alerts, notify_daily_targets, notify_eod_report, notify_weekly_report, notify_monthly_report, notify_shame_fame, notify_streaks, notify_big_deals",
        )
        .eq("client_id", n.clientId)
        .maybeSingle();

      if (!settings?.slack_enabled || !settings.slack_channel_id) return;

      const toggleColumn = KIND_TOGGLE[n.kind];
      if (toggleColumn && settings[toggleColumn as keyof typeof settings] === false) return;

      const resp = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.botToken}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ channel: settings.slack_channel_id, text: slackText(n) }),
      });
      const json = (await resp.json()) as { ok: boolean; error?: string };
      if (!json.ok) {
        console.error(`SlackNotifier: chat.postMessage failed — ${json.error}`);
      }
    } catch (err) {
      // Slack delivery is best-effort; the in-app notification above already succeeded.
      console.error("SlackNotifier: Slack delivery failed:", err);
    }
  }
}
