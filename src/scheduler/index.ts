import "@/lib/load-env"; // must be first: loads .env.local before env validation

import cron from "node-cron";
import { runSync } from "@/lib/ad-sync";
import { runAnomalyScan } from "@/lib/ai/anomaly";
import { sendDailyTarget } from "@/lib/ai/daily-target";
import { generateReport } from "@/lib/reports/generate";
import {
  listAllClientsService,
  listClientsWithAdConnectionsService,
  loadClientSettingsService,
} from "@/lib/data/service-loaders";
import { runJob } from "@/scheduler/job-runner";

/**
 * The scheduler — a standalone long-running process (run under PM2 alongside
 * the web process; see docs/DEPLOYMENT.md), NOT part of the Next.js request
 * lifecycle. It has no logged-in user, so every job below reads through the
 * service-level loaders (src/lib/data/service-loaders.ts), not the RLS-scoped
 * ones the dashboards use — same trusted-server precedent as ad-sync.
 *
 * Every job is also reachable manually (Admin Settings' "Check anomalies
 * now", the Reports page's "Generate Now", the Ads dashboard's "Sync now")
 * so it can be dry-run and verified without waiting on cron.
 *
 * Run with `npx tsx src/scheduler/index.ts`, kept alive by PM2.
 */

const REPORT_HOUR = 19; // local hour reports/EOD fire at, distinct from each client's own daily-target hour

function localHour(timezone: string): number {
  try {
    const formatted = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).format(new Date());
    return Number(formatted) % 24;
  } catch {
    return new Date().getUTCHours(); // unknown/invalid timezone — fall back to UTC
  }
}

function isMondayIn(timezone: string): boolean {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(new Date()) === "Mon";
  } catch {
    return new Date().getUTCDay() === 1;
  }
}

function isFirstOfMonthIn(timezone: string): boolean {
  try {
    return Number(new Intl.DateTimeFormat("en-US", { timeZone: timezone, day: "numeric" }).format(new Date())) === 1;
  } catch {
    return new Date().getUTCDate() === 1;
  }
}

// ─── Hourly: ad sync for every connected client ─────────────────────────────
cron.schedule("0 * * * *", async () => {
  const clientIds = await listClientsWithAdConnectionsService();
  for (const clientId of clientIds) {
    await runJob(`ad sync (${clientId})`, async () => {
      await runSync(clientId); // respects the existing 15-min cooldown internally
    });
  }
});

// ─── Every 4 hours: anomaly scan for every client ───────────────────────────
cron.schedule("0 */4 * * *", async () => {
  const clients = await listAllClientsService();
  for (const row of clients) {
    const client = { id: row.id, name: row.name, currency: row.reportingCurrency };
    await runJob(`anomaly scan (${client.name})`, async () => {
      await runAnomalyScan(client);
    });
  }
});

// ─── Hourly: per-client daily targets + EOD/weekly/monthly reports ──────────
// Runs every hour and checks each client's own local time, so one job
// definition covers every timezone without N separate cron entries.
cron.schedule("0 * * * *", async () => {
  const rows = await listAllClientsService();
  for (const row of rows) {
    const client = { id: row.id, name: row.name, currency: row.reportingCurrency };
    const settings = await loadClientSettingsService(client.id);
    const timezone = settings?.timezone ?? "UTC";
    const dailyTargetHour = settings?.dailyTargetHour ?? 8;
    const hour = localHour(timezone);

    if (settings?.notifyDailyTargets !== false && hour === dailyTargetHour) {
      await runJob(`daily target (${client.name})`, async () => {
        await sendDailyTarget(client);
      });
    }

    if (hour === REPORT_HOUR) {
      if (settings?.notifyEodReport !== false) {
        await runJob(`EOD report (${client.name})`, async () => {
          await generateReport(client, "daily");
        });
      }
      if (settings?.notifyWeeklyReport !== false && isMondayIn(timezone)) {
        await runJob(`weekly report (${client.name})`, async () => {
          await generateReport(client, "weekly");
        });
      }
      if (settings?.notifyMonthlyReport !== false && isFirstOfMonthIn(timezone)) {
        await runJob(`monthly report (${client.name})`, async () => {
          await generateReport(client, "monthly");
        });
      }
    }
  }
});

console.info("[scheduler] started — hourly ad sync, 4-hourly anomaly scan, hourly daily-target/report check");
