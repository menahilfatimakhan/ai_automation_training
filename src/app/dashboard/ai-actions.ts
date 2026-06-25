"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import {
  generateDashboardInsights,
  generateNextBestAction,
} from "@/lib/ai/usecases";

async function loadClientInfo(clientId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("clients")
    .select("id, name, reporting_currency")
    .eq("id", clientId)
    .maybeSingle();
  if (!data) throw new Error("Client not found or not permitted");
  return { id: data.id, name: data.name, currency: data.reporting_currency };
}

export async function runInsights(formData: FormData) {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error("Not authenticated");
  const client = await loadClientInfo(String(formData.get("clientId")));
  await generateDashboardInsights(client);
  revalidatePath("/dashboard/master");
}

export async function runNextBestAction(formData: FormData) {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error("Not authenticated");
  const client = await loadClientInfo(String(formData.get("clientId")));
  await generateNextBestAction(client);
  revalidatePath("/dashboard/master");
}

/**
 * Accept an AI suggestion → create a manual override tagged with its provenance
 * (invariant #2c). The override (not the suggestion) becomes the effective
 * value; raw/computed data is untouched.
 */
export async function acceptSuggestion(formData: FormData) {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error("Not authenticated");
  const id = String(formData.get("id"));

  const supabase = await createSupabaseServerClient();
  const { data: sug, error: loadErr } = await supabase
    .from("ai_suggestions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (loadErr || !sug) throw new Error("Suggestion not found");
  if (sug.suggested_value === null) throw new Error("Suggestion has no value to apply");

  // Deactivate any current active override for this target/period.
  await supabase
    .from("metric_overrides")
    .update({ active: false })
    .eq("client_id", sug.client_id)
    .eq("target_type", sug.target_type)
    .eq("target_key", sug.target_key)
    .eq("period_start", sug.period_start)
    .eq("period_end", sug.period_end)
    .eq("active", true);

  const { data: override, error: ovErr } = await supabase
    .from("metric_overrides")
    .insert({
      client_id: sug.client_id,
      target_type: sug.target_type,
      target_key: sug.target_key,
      period_start: sug.period_start,
      period_end: sug.period_end,
      value: sug.suggested_value,
      currency: sug.currency,
      source: "ai_suggestion",
      source_suggestion_id: sug.id,
      active: true,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (ovErr) throw new Error(ovErr.message);

  await supabase
    .from("ai_suggestions")
    .update({
      status: "accepted",
      override_id: override.id,
      decided_by: ctx.userId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath("/dashboard/master");
}

/** Mark all of a client's in-app notifications as read for the current viewer. */
export async function markNotificationsRead(formData: FormData) {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error("Not authenticated");
  const clientId = String(formData.get("clientId"));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("client_id", clientId)
    .eq("read", false);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/master");
  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/setter");
  revalidatePath("/dashboard/ads");
}

export async function dismissSuggestion(formData: FormData) {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error("Not authenticated");
  const id = String(formData.get("id"));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("ai_suggestions")
    .update({
      status: "dismissed",
      decided_by: ctx.userId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/master");
}
