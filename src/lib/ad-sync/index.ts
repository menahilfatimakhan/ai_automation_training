import { getProviders } from "@/providers/registry";
import { DrizzleSyncRepository } from "@/lib/ad-sync/drizzle-repository";
import { syncAdData, type SyncDeps } from "@/lib/ad-sync/sync";
import type { SyncSummary } from "@/lib/ad-sync/types";

/**
 * App/seed entry point: wires the real Drizzle repository and the env-selected
 * providers, then runs the shared syncAdData pipeline. The Ads dashboard
 * "Sync now" action calls this; the seed calls it with `ignoreCooldown` to
 * backfill the demo dataset from fixtures.
 */
export async function runSync(
  clientId: string,
  opts: Pick<SyncDeps, "ignoreCooldown" | "range" | "now"> = {},
): Promise<SyncSummary> {
  const providers = getProviders();
  return syncAdData(clientId, {
    repo: new DrizzleSyncRepository(),
    provider: providers.ad,
    secrets: providers.secrets,
    ...opts,
  });
}

export { syncAdData } from "@/lib/ad-sync/sync";
export * from "@/lib/ad-sync/types";
