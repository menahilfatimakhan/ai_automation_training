"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";

const OUTCOMES = ["closed", "rescheduled", "lost", "no_show"];

/** Edit a call. RLS restricts this to the owning closer or an admin. */
export async function updateCall(formData: FormData) {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error("Not authenticated");

  const id = String(formData.get("id"));
  const outcome = String(formData.get("outcome"));
  if (!OUTCOMES.includes(outcome)) throw new Error("Invalid outcome");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("calls")
    .update({
      outcome,
      revenue: String(Number(formData.get("revenue") ?? 0) || 0),
      cash_collected: String(Number(formData.get("cashCollected") ?? 0) || 0),
      lead_source: (formData.get("leadSource") as string) || null,
      objection_reason: (formData.get("objectionReason") as string) || null,
      notes: (formData.get("notes") as string) || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/call-logs");
  revalidatePath("/dashboard/master");
}

/** Delete a call. RLS restricts to owning closer or admin. */
export async function deleteCall(formData: FormData) {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error("Not authenticated");

  const id = String(formData.get("id"));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("calls").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/call-logs");
  revalidatePath("/dashboard/master");
}

/** Inline tag edit for a call (used in Sales + Call Logs). */
export async function setCallTags(formData: FormData) {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error("Not authenticated");

  const id = String(formData.get("id"));
  const tags = String(formData.get("tags") || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("calls")
    .update({ tags, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/call-logs");
  revalidatePath("/dashboard/sales");
}
