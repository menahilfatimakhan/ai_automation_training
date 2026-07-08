import type { EmailMessage, EmailProvider } from "@/providers/ports/email-provider";

/** ConsoleEmailProvider — logs to the console. Default until RESEND_API_KEY is set. */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";

  async send(message: EmailMessage): Promise<void> {
    // eslint-disable-next-line no-console
    console.info(`[email:console] to=${message.to} subject="${message.subject}"\n${message.text}`);
  }
}
