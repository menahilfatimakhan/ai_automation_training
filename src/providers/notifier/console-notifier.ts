import type { Notification, Notifier } from "@/providers/ports/notifier";

/**
 * In-app delivery sink. The Notifier writes notifications here; the in-app
 * panel reads from here. Process-local and ephemeral — fine for MVP. A durable
 * store / Slack / email implementation slots in behind the Notifier port later.
 */
export interface StoredNotification extends Notification {
  id: string;
  createdAt: string;
}

const inbox: StoredNotification[] = [];

export function getInbox(): readonly StoredNotification[] {
  return inbox;
}

export function clearInbox(): void {
  inbox.length = 0;
}

/**
 * ConsoleNotifier — logs to the console and appends to the in-app inbox.
 * The default Notifier for MVP.
 */
export class ConsoleNotifier implements Notifier {
  readonly name = "console";

  async notify(notification: Notification): Promise<void> {
    const stored: StoredNotification = {
      ...notification,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    inbox.push(stored);
    // eslint-disable-next-line no-console
    console.info(
      `[notify:${notification.kind}] ${notification.title} — ${notification.body}`,
    );
  }
}
