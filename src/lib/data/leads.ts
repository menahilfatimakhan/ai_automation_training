import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface LeadRow {
  id: string;
  name: string;
  contact: string | null;
  source: string | null;
  status: string;
  ownerUserId: string | null;
  tags: string[];
}

export interface FollowUpRow {
  id: string;
  leadId: string | null;
  leadName: string | null;
  ownerUserId: string | null;
  dueDate: string | null;
  status: string;
  notes: string | null;
}

export interface ClientMember {
  userId: string;
  role: string;
  name: string;
}

export async function loadLeads(clientId: string): Promise<LeadRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("leads")
    .select("id, name, contact, source, status, owner_user_id, tags")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    contact: l.contact,
    source: l.source,
    status: l.status,
    ownerUserId: l.owner_user_id,
    tags: l.tags ?? [],
  }));
}

/** Follow-up queue. `ownerUserId` scopes to one person; omit for all (admin). */
export async function loadFollowUps(
  clientId: string,
  ownerUserId?: string,
): Promise<FollowUpRow[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("follow_ups")
    .select("id, lead_id, owner_user_id, due_date, status, notes, leads(name)")
    .eq("client_id", clientId)
    .order("due_date", { ascending: true });
  if (ownerUserId) query = query.eq("owner_user_id", ownerUserId);

  const { data } = await query;
  return (data ?? []).map((f) => {
    const lead = f.leads as { name: string } | { name: string }[] | null;
    const leadName = Array.isArray(lead) ? lead[0]?.name ?? null : lead?.name ?? null;
    return {
      id: f.id,
      leadId: f.lead_id,
      leadName,
      ownerUserId: f.owner_user_id,
      dueDate: f.due_date,
      status: f.status,
      notes: f.notes,
    };
  });
}

export async function loadClientMembers(clientId: string): Promise<ClientMember[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("memberships")
    .select("user_id, role, users(full_name, email)")
    .eq("client_id", clientId);
  return (data ?? []).map((m) => {
    const u = m.users as { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
    const user = Array.isArray(u) ? u[0] : u;
    return {
      userId: m.user_id,
      role: m.role,
      name: user?.full_name ?? user?.email ?? m.user_id,
    };
  });
}
