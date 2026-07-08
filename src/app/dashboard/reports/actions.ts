"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { generateReport, type ReportType } from "@/lib/reports/generate";

const REPORT_TYPES: ReportType[] = ["daily", "weekly", "monthly"];

/** "Generate Now" — admin only. Identical code path to the scheduler's automatic runs. */
export async function generateReportNow(formData: FormData) {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error("Not authenticated");
  if (!ctx.isAdmin) throw new Error("Admin only");

  const clientId = String(formData.get("clientId"));
  const type = String(formData.get("type")) as ReportType;
  if (!REPORT_TYPES.includes(type)) throw new Error("Invalid report type");

  const supabase = await createSupabaseServerClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, reporting_currency")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) throw new Error("Client not found or not permitted");

  await generateReport(
    { id: client.id, name: client.name, currency: client.reporting_currency },
    type,
    ctx.userId,
  );
  revalidatePath("/dashboard/reports");
}
