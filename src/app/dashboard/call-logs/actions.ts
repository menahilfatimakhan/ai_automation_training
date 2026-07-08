"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { CALL_OUTCOMES, OBJECTION_TYPES, bucketOf, type CallOutcome, type ObjectionType } from "@/domain/metrics";
import { recordAudit } from "@/lib/audit";

/** Edit a call. RLS restricts this to the owning closer or an admin. */
export async function updateCall(formData: FormData) {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error("Not authenticated");

  const id = String(formData.get("id"));
  const outcome = String(formData.get("outcome")) as CallOutcome;
  if (!CALL_OUTCOMES.includes(outcome)) throw new Error("Invalid outcome");

  const objectionTypeRaw = (formData.get("objectionType") as string) || null;
  const objectionType =
    objectionTypeRaw && OBJECTION_TYPES.includes(objectionTypeRaw as ObjectionType)
      ? (objectionTypeRaw as ObjectionType)
      : null;

  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase.from("calls").select("*").eq("id", id).maybeSingle();
  if (!before) throw new Error("Call not found or not permitted");

  const after = {
    outcome,
    revenue: String(Number(formData.get("revenue") ?? 0) || 0),
    cash_collected: String(Number(formData.get("cashCollected") ?? 0) || 0),
    lead_source: (formData.get("leadSource") as string) || null,
    objection_type: bucketOf(outcome) === "showed_not_closed" ? objectionType : null,
    objection_notes: (formData.get("objectionNotes") as string) || null,
    contact_name: (formData.get("contactName") as string) || null,
    contact_phone: (formData.get("contactPhone") as string) || null,
    contact_email: (formData.get("contactEmail") as string) || null,
    notes: (formData.get("notes") as string) || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("calls").update(after).eq("id", id);
  if (error) throw new Error(error.message);

  await recordAudit({
    clientId: before.client_id,
    entityType: "call",
    entityId: id,
    action: "update",
    before,
    after: { ...before, ...after },
    actorUserId: ctx.userId,
  });

  revalidatePath("/dashboard/call-logs");
  revalidatePath("/dashboard/master");
}

/** Delete a call. RLS restricts to owning closer or admin. */
export async function deleteCall(formData: FormData) {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error("Not authenticated");

  const id = String(formData.get("id"));
  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase.from("calls").select("*").eq("id", id).maybeSingle();
  if (!before) throw new Error("Call not found or not permitted");

  const { error } = await supabase.from("calls").delete().eq("id", id);
  if (error) throw new Error(error.message);

  await recordAudit({
    clientId: before.client_id,
    entityType: "call",
    entityId: id,
    action: "delete",
    before,
    after: null,
    actorUserId: ctx.userId,
  });

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
