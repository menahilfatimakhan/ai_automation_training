import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface AuditRow {
  id: string;
  clientId: string;
  entityType: "call" | "lead";
  entityId: string;
  action: "update" | "delete" | "reassign";
  before: Record<string, unknown>;
  after: Record<string, unknown> | null;
  actorUserId: string | null;
  createdAt: string;
}

/** Recent audit trail entries across every client the caller can see (admin: all). */
export async function loadAuditLogAll(limit = 100): Promise<AuditRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("audit_log")
    .select("id, client_id, entity_type, entity_id, action, before_value, after_value, actor_user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => ({
    id: r.id,
    clientId: r.client_id,
    entityType: r.entity_type,
    entityId: r.entity_id,
    action: r.action,
    before: r.before_value ?? {},
    after: r.after_value,
    actorUserId: r.actor_user_id,
    createdAt: r.created_at,
  }));
}

/** Recent audit trail entries for a client, newest first. Admin/client-viewer only (RLS). */
export async function loadAuditLog(clientId: string, limit = 50): Promise<AuditRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("audit_log")
    .select("id, client_id, entity_type, entity_id, action, before_value, after_value, actor_user_id, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => ({
    id: r.id,
    clientId: r.client_id,
    entityType: r.entity_type,
    entityId: r.entity_id,
    action: r.action,
    before: r.before_value ?? {},
    after: r.after_value,
    actorUserId: r.actor_user_id,
    createdAt: r.created_at,
  }));
}
