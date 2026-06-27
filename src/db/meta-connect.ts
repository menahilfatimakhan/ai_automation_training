import "@/lib/load-env"; // must be first: loads .env.local before env validation

import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { runSync } from "@/lib/ad-sync";

/**
 * One-off helper: point the Acme client's ad connection at a real Meta ad
 * account (from env META_AD_ACCOUNT_ID, token resolved via env:META_TOKEN_ACME)
 * and run a live sync. Run with: npx tsx src/db/meta-connect.ts
 */
const ACME = "11111111-1111-1111-1111-111111111111";

async function main() {
  const accountId = process.env.META_AD_ACCOUNT_ID;
  if (!accountId) throw new Error("META_AD_ACCOUNT_ID not set in .env.local");

  const db = getDb();

  // Clear Acme's seeded MOCK ad data so only real Meta data remains.
  await db.delete(schema.adDailyMetrics).where(eq(schema.adDailyMetrics.clientId, ACME));
  await db.delete(schema.adCampaigns).where(eq(schema.adCampaigns.clientId, ACME));

  // Ensure exactly one connection for Acme → the real account.
  await db.delete(schema.adConnections).where(eq(schema.adConnections.clientId, ACME));
  await db.insert(schema.adConnections).values({
    clientId: ACME,
    adAccountId: accountId,
    accessTokenRef: "env:META_TOKEN_ACME",
    lastSyncedAt: null,
  });
  console.info(`Connected Acme → ${accountId} (provider=${process.env.AD_PROVIDER})`);

  console.info("Running live sync via Meta…");
  const summary = await runSync(ACME, { ignoreCooldown: true });
  console.info(
    `✅ Sync result: ${summary.campaigns} campaigns, ${summary.metricRows} metric rows`,
  );
  if (summary.campaigns === 0) {
    console.info(
      "No campaigns returned — either none exist yet, or the account has no campaigns the token can read.",
    );
  } else if (summary.metricRows === 0) {
    console.info(
      "Campaigns found but 0 metric rows — ads have not delivered/spent yet (needs budget + active delivery).",
    );
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Meta connect/sync failed:", err.message ?? err);
  process.exit(1);
});
