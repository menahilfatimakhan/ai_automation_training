import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Membership, Role, SessionContext } from "@/lib/access";

/**
 * Loads the current session context (identity + admin flag + memberships) for
 * server components, layouts, and route handlers. Reads run as the logged-in
 * user, so RLS already constrains them; this is for routing/UI decisions.
 *
 * Returns null when not authenticated.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // is_admin + memberships from our tables (RLS lets a user read their own).
  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("users").select("is_admin").eq("id", user.id).maybeSingle(),
    supabase
      .from("memberships")
      .select("client_id, role")
      .eq("user_id", user.id),
  ]);

  return {
    userId: user.id,
    isAdmin: Boolean(profile?.is_admin),
    memberships: (memberships ?? []).map(
      (m: { client_id: string; role: Role }): Membership => ({
        clientId: m.client_id,
        role: m.role,
      }),
    ),
  };
}
