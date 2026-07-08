/**
 * EmailProvider PORT.
 *
 * Used for account invites and password-reset links only (per scope — all
 * other messaging goes through the Notifier/Slack port). Selected via
 * EMAIL_PROVIDER=console|resend.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain text body. Kept simple — these are short transactional emails. */
  text: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}
