/**
 * Notifier PORT.
 *
 * Delivers alerts and messages (e.g. AI loss-debriefs, next-best-action). The
 * current implementation writes to the console + an in-app store; Slack/email
 * slot in behind the same interface later with no UI changes.
 */

export type NotificationChannel = "in_app" | "console" | "slack" | "email";

export type NotificationKind =
  | "ai_insight"
  | "loss_debrief"
  | "next_best_action"
  | "campaign_narrative"
  | "alert"
  | "anomaly_alert"
  | "daily_target"
  | "eod_report"
  | "weekly_report"
  | "monthly_report"
  | "shame_fame"
  | "streak"
  | "big_deal";

export interface Notification {
  clientId: string;
  /** Optional target user; omit for client-wide / role-wide messages. */
  userId?: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Arbitrary structured context (e.g. the call id that triggered it). */
  meta?: Record<string, unknown>;
}

export interface Notifier {
  readonly name: string;
  notify(notification: Notification): Promise<void>;
}
