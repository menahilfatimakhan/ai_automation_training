"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth";
import { hasRole } from "@/lib/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runSync } from "@/lib/ad-sync";
import { SyncCooldownError, NoConnectionError } from "@/lib/ad-sync/types";
import { generateCampaignNarrative } from "@/lib/ai/usecases";

export interface SyncState {
  ok?: boolean;
  message?: string;
}

/**
 * "Sync now" — runs the shared syncAdData pipeline through the active provider,
 * respecting the 15-minute cooldown. Read-only dashboard, but the sync itself
 * is an admin/member action. Errors are returned (not thrown) for the UI.
 */
export async function syncNow(
  _prev: SyncState,
  formData: FormData,
): Promise<SyncState> {
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, message: "Not authenticated" };

  const clientId = String(formData.get("clientId"));
  const allowed =
    ctx.isAdmin ||
    hasRole(ctx, clientId, "closer") ||
    hasRole(ctx, clientId, "setter") ||
    hasRole(ctx, clientId, "client");
  if (!allowed) return { ok: false, message: "Not permitted for this client" };

  try {
    const summary = await runSync(clientId);
    revalidatePath("/dashboard/ads");

    // AI-written campaign performance summary after each sync. Best-effort:
    // never fail the sync itself if advisory generation has an issue.
    try {
      const supabase = await createSupabaseServerClient();
      const { data: client } = await supabase
        .from("clients")
        .select("id, name, reporting_currency")
        .eq("id", clientId)
        .maybeSingle();
      if (client) {
        await generateCampaignNarrative(
          { id: client.id, name: client.name, currency: client.reporting_currency },
          summary,
        );
      }
    } catch (err) {
      console.error("campaign narrative failed:", err);
    }

    return {
      ok: true,
      message: `Synced ${summary.campaigns} campaigns, ${summary.metricRows} rows.`,
    };
  } catch (err) {
    if (err instanceof SyncCooldownError) {
      const mins = Math.ceil(err.remainingMs / 60000);
      return { ok: false, message: `On cooldown — try again in ~${mins} min.` };
    }
    if (err instanceof NoConnectionError) {
      return { ok: false, message: "No ad account connected for this client." };
    }
    return { ok: false, message: (err as Error).message };
  }
}

/** Set the Typeform/Normal categorization and/or flag-for-review reason on a campaign. */
export async function setAdCampaignFlags(formData: FormData) {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error("Not authenticated");
  const clientId = String(formData.get("clientId"));
  if (!ctx.isAdmin && !hasRole(ctx, clientId, "closer") && !hasRole(ctx, clientId, "setter")) {
    throw new Error("Not permitted for this client");
  }
  const campaignId = String(formData.get("campaignId"));
  const adFocus = (formData.get("adFocus") as string) || null;
  const flaggedReason = (formData.get("flaggedReason") as string) || null;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("ad_campaigns")
    .update({ ad_focus: adFocus, flagged_reason: flaggedReason, updated_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .eq("campaign_id", campaignId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/ads");
}
