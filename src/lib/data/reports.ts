import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface ReportRow {
  id: string;
  type: "daily" | "weekly" | "monthly";
  periodStart: string;
  periodEnd: string;
  narrative: string;
  createdAt: string;
}

/** Report history for a client, newest first. RLS-scoped (admin/client-viewer). */
export async function loadReports(clientId: string): Promise<ReportRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("reports")
    .select("id, type, period_start, period_end, narrative, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(100);

  return (data ?? []).map((r) => ({
    id: r.id,
    type: r.type,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    narrative: r.narrative,
    createdAt: r.created_at,
  }));
}
