/**
 * Notifier PORT.
 *
 * Delivers alerts and messages (e.g. AI loss-debriefs, next-best-action). The
 * current implementation writes to the console + an in-app store; Slack/email
 * slot in behind the same interface later with no UI changes.
 */

export type NotificationChannel = "in_app" | "console" | "slack" | "email";

export interface Notification {
  clientId: string;
  /** Optional target user; omit for client-wide / role-wide messages. */
  userId?: string;
  kind: "ai_insight" | "loss_debrief" | "next_best_action" | "alert";
  title: string;
  body: string;
  /** Arbitrary structured context (e.g. the call id that triggered it). */
  meta?: Record<string, unknown>;
}

export interface Notifier {
  readonly name: string;
  notify(notification: Notification): Promise<void>;
}
