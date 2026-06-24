import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Admin-scoped loaders. The admin RLS policies grant full visibility. */

export interface AdminClient {
  id: string;
  name: string;
  reportingCurrency: string;
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string | null;
  isAdmin: boolean;
}

export interface AdminMembership {
  id: string;
  userId: string;
  clientId: string;
  role: string;
}

export interface AdminAdConnection {
  clientId: string;
  adAccountId: string;
  accessTokenRef: string | null;
  lastSyncedAt: string | null;
}

export async function loadAdminData() {
  const supabase = await createSupabaseServerClient();
  const [clients, users, memberships, goals, connections] = await Promise.all([
    supabase.from("clients").select("id, name, reporting_currency").order("name"),
    supabase.from("users").select("id, email, full_name, is_admin").order("email"),
    supabase.from("memberships").select("id, user_id, client_id, role"),
    supabase.from("goals").select("client_id, month, revenue_goal, calls_goal, currency"),
    supabase.from("ad_connections").select("client_id, ad_account_id, access_token_ref, last_synced_at"),
  ]);

  return {
    clients: (clients.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      reportingCurrency: c.reporting_currency,
    })) as AdminClient[],
    users: (users.data ?? []).map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.full_name,
      isAdmin: u.is_admin,
    })) as AdminUser[],
    memberships: (memberships.data ?? []).map((m) => ({
      id: m.id,
      userId: m.user_id,
      clientId: m.client_id,
      role: m.role,
    })) as AdminMembership[],
    goals: goals.data ?? [],
    connections: (connections.data ?? []).map((a) => ({
      clientId: a.client_id,
      adAccountId: a.ad_account_id,
      accessTokenRef: a.access_token_ref,
      lastSyncedAt: a.last_synced_at,
    })) as AdminAdConnection[],
  };
}
