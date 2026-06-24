import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { Notification, Notifier } from "@/providers/ports/notifier";

/**
 * DbNotifier — the in-app delivery channel. Persists notifications to the
 * `notifications` table (durable, RLS-scoped), which the in-app panel reads.
 * Uses the service client because delivery is a trusted server action; the
 * recipient's reads are still constrained by RLS. Slack/email Notifiers slot in
 * behind the same port later.
 */
export class DbNotifier implements Notifier {
  readonly name = "db";

  async notify(n: Notification): Promise<void> {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.from("notifications").insert({
      client_id: n.clientId,
      user_id: n.userId ?? null,
      kind: n.kind,
      title: n.title,
      body: n.body,
      meta: n.meta ?? {},
    });
    if (error) throw new Error(`DbNotifier failed: ${error.message}`);
  }
}
