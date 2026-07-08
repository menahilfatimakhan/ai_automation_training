import type { EmailMessage, EmailProvider } from "@/providers/ports/email-provider";

/**
 * ResendEmailProvider — real delivery via the Resend HTTP API. No SDK
 * dependency, same raw-fetch pattern as MetaAdProvider/LiveFxProvider.
 * Selected via EMAIL_PROVIDER=resend + RESEND_API_KEY.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Resend API error (${resp.status}): ${body}`);
    }
  }
}
