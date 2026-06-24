import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  createdAt: string;
}

/** Recent in-app notifications visible to the viewer (RLS-scoped). */
export async function loadNotifications(
  clientId: string,
  limit = 10,
): Promise<NotificationRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    createdAt: n.created_at,
  }));
}
