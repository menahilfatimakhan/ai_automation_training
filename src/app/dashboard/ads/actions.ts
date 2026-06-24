"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth";
import { hasRole } from "@/lib/access";
import { runSync } from "@/lib/ad-sync";
import { SyncCooldownError, NoConnectionError } from "@/lib/ad-sync/types";

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
