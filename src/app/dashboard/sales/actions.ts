"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { todayIso } from "@/lib/format";
import { generateLossDebrief } from "@/lib/ai/usecases";

const OUTCOMES = ["closed", "rescheduled", "lost", "no_show"] as const;
type Outcome = (typeof OUTCOMES)[number];

/**
 * Log a sales call. RLS (calls_write) requires the caller to be the owning
 * closer, so closer_user_id is forced to the session user. A 'lost' outcome is
 * where Step 8 will trigger the AI loss-debrief via the Notifier.
 */
export async function logCall(formData: FormData) {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error("Not authenticated");

  const clientId = String(formData.get("clientId"));
  const outcome = String(formData.get("outcome")) as Outcome;
  if (!OUTCOMES.includes(outcome)) throw new Error("Invalid outcome");

  const revenue = Number(formData.get("revenue") ?? 0) || 0;
  const cashCollected = Number(formData.get("cashCollected") ?? 0) || 0;
  const currency = String(formData.get("currency") || "USD");
  const date = String(formData.get("date") || todayIso());
  const leadSource = (formData.get("leadSource") as string) || null;
  const objectionReason = (formData.get("objectionReason") as string) || null;
  const notes = (formData.get("notes") as string) || null;
  const tagsRaw = (formData.get("tags") as string) || "";
  const tags = tagsRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("calls").insert({
    client_id: clientId,
    closer_user_id: ctx.userId,
    date,
    outcome,
    revenue: String(revenue),
    cash_collected: String(cashCollected),
    currency,
    lead_source: leadSource,
    objection_reason: objectionReason,
    notes,
    tags,
  });
  if (error) throw new Error(error.message);

  // A lost call triggers an advisory AI loss-debrief delivered to the in-app
  // panel via the Notifier. Best-effort: never block call logging on AI.
  if (outcome === "lost") {
    try {
      const { data: client } = await supabase
        .from("clients")
        .select("id, name, reporting_currency")
        .eq("id", clientId)
        .maybeSingle();
      if (client) {
        await generateLossDebrief(
          { id: client.id, name: client.name, currency: client.reporting_currency },
          { objection: objectionReason, notes, userId: ctx.userId },
        );
      }
    } catch (err) {
      console.error("loss debrief failed:", err);
    }
  }

  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/master");
}
