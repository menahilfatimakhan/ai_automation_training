import { createSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * Audit trail — who/when/before-value on mutations to raw data (calls,
 * leads). Mirrors the metric_overrides pattern (append-only, prior value
 * captured) but for raw operational rows rather than derived KPIs.
 *
 * Called from within an already-authorized server action (RLS on the
 * underlying table — calls_write/leads_write — is what gates whether the
 * mutation itself succeeds); this just records what happened, via the
 * service client since it's a trusted side-effect of an already-permitted
 * write, not a new privilege boundary.
 */
export async function recordAudit(entry: {
  clientId: string;
  entityType: "call" | "lead";
  entityId: string;
  action: "update" | "delete" | "reassign";
  before: Record<string, unknown>;
  after?: Record<string, unknown> | null;
  actorUserId?: string;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("audit_log").insert({
    client_id: entry.clientId,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    action: entry.action,
    before_value: entry.before,
    after_value: entry.after ?? null,
    actor_user_id: entry.actorUserId ?? null,
  });
  if (error) {
    // Never let an audit-logging failure block the underlying mutation that
    // already succeeded — log loudly instead.
    console.error("recordAudit failed:", error.message);
  }
}
