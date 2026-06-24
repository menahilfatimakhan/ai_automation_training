"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";

/**
 * Create a manual override for a KPI (invariant #2): a SEPARATE record with
 * who/when and the prior value. It never mutates raw data or the computed
 * snapshot — resolveValue() picks the newest active override at read time.
 */
export async function createManualOverride(formData: FormData) {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error("Not authenticated");

  const clientId = String(formData.get("clientId"));
  const targetKey = String(formData.get("targetKey"));
  const periodStart = String(formData.get("periodStart"));
  const periodEnd = String(formData.get("periodEnd"));
  const value = Number(formData.get("value"));
  const priorValue = formData.get("priorValue")
    ? Number(formData.get("priorValue"))
    : null;
  const currency = formData.get("currency") ? String(formData.get("currency")) : null;

  if (Number.isNaN(value)) throw new Error("Invalid override value");

  const supabase = await createSupabaseServerClient();

  // Deactivate prior active overrides for this target/period (audit kept).
  await supabase
    .from("metric_overrides")
    .update({ active: false })
    .eq("client_id", clientId)
    .eq("target_type", "kpi")
    .eq("target_key", targetKey)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .eq("active", true);

  const { error } = await supabase.from("metric_overrides").insert({
    client_id: clientId,
    target_type: "kpi",
    target_key: targetKey,
    period_start: periodStart,
    period_end: periodEnd,
    value: String(value),
    currency,
    prior_value: priorValue === null ? null : String(priorValue),
    source: "manual",
    active: true,
    created_by: ctx.userId,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/master");
}

/** Clear (deactivate) the active manual override, reverting to the computed value. */
export async function clearManualOverride(formData: FormData) {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error("Not authenticated");

  const clientId = String(formData.get("clientId"));
  const targetKey = String(formData.get("targetKey"));
  const periodStart = String(formData.get("periodStart"));
  const periodEnd = String(formData.get("periodEnd"));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("metric_overrides")
    .update({ active: false })
    .eq("client_id", clientId)
    .eq("target_type", "kpi")
    .eq("target_key", targetKey)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .eq("active", true);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/master");
}
