"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

/** Inline tag editing for a lead. */
export async function setLeadTags(formData: FormData) {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error("Not authenticated");

  const id = String(formData.get("id"));
  const tags = String(formData.get("tags") || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("leads")
    .update({ tags, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/leads");
}

/**
 * Admin lead reassignment. RLS leads_write only permits the owner or an admin;
 * reassigning to another owner is therefore an admin-only operation in practice.
 */
export async function reassignLead(formData: FormData) {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error("Not authenticated");
  if (!ctx.isAdmin) throw new Error("Only an admin can reassign leads");

  const id = String(formData.get("id"));
  const ownerUserId = String(formData.get("ownerUserId")) || null;

  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase
    .from("leads")
    .select("client_id, owner_user_id")
    .eq("id", id)
    .maybeSingle();
  if (!before) throw new Error("Lead not found or not permitted");

  const { error } = await supabase
    .from("leads")
    .update({ owner_user_id: ownerUserId, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await recordAudit({
    clientId: before.client_id,
    entityType: "lead",
    entityId: id,
    action: "reassign",
    before: { ownerUserId: before.owner_user_id },
    after: { ownerUserId },
    actorUserId: ctx.userId,
  });

  revalidatePath("/dashboard/leads");
}

/** Mark a follow-up done / reopen it. */
export async function toggleFollowUp(formData: FormData) {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error("Not authenticated");

  const id = String(formData.get("id"));
  const status = String(formData.get("status")) === "done" ? "pending" : "done";

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("follow_ups")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/leads");
}
