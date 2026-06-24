"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { todayIso } from "@/lib/format";

/**
 * Upsert a setter's daily activity. Idempotent on (client_id, setter_user_id,
 * date) so re-logging the same day edits it. RLS forces ownership.
 */
export async function logSetterDay(formData: FormData) {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error("Not authenticated");

  const clientId = String(formData.get("clientId"));
  const date = String(formData.get("date") || todayIso());
  const num = (k: string) => Math.max(0, Number(formData.get(k) ?? 0) || 0);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("setter_daily_activity").upsert(
    {
      client_id: clientId,
      setter_user_id: ctx.userId,
      date,
      conversations: num("conversations"),
      replies: num("replies"),
      proposals: num("proposals"),
      calls_booked: num("callsBooked"),
      follow_ups: num("followUps"),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id,setter_user_id,date" },
  );
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/setter");
}
