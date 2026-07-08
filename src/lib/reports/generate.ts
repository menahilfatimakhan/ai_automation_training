import { getDb, schema } from "@/db";
import { getProviders } from "@/providers/registry";
import { generateReportNarrative } from "@/lib/ai/usecases";
import { renderReportPdf } from "@/lib/reports/pdf";
import { monthEndIso, monthStartIso, daysAgoIso, todayIso } from "@/lib/format";
import type { NotificationKind } from "@/providers/ports/notifier";

export type ReportType = "daily" | "weekly" | "monthly";

interface ClientInfo {
  id: string;
  name: string;
  currency: string;
}

const LABEL: Record<ReportType, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

const NOTIFY_KIND: Record<ReportType, NotificationKind> = {
  daily: "eod_report",
  weekly: "weekly_report",
  monthly: "monthly_report",
};

function periodFor(type: ReportType): { periodStart: string; periodEnd: string } {
  const today = todayIso();
  if (type === "daily") return { periodStart: today, periodEnd: today };
  if (type === "weekly") return { periodStart: daysAgoIso(6), periodEnd: today };
  return { periodStart: monthStartIso(), periodEnd: monthEndIso() };
}

/**
 * Generates one report: computes metrics, gets the AI narrative, renders the
 * PDF, persists it, and delivers a notification (in-app + Slack once
 * configured) pointing at the Reports page. Used by both the "Generate Now"
 * button and the scheduler (Step 8) — identical code path either way, so a
 * manual dry run is a faithful test of what cron will do.
 */
export async function generateReport(
  client: ClientInfo,
  type: ReportType,
  generatedBy?: string,
) {
  const period = periodFor(type);
  const { advice, metrics } = await generateReportNarrative(client, {
    label: LABEL[type],
    ...period,
  });

  const pdfBuffer = await renderReportPdf({
    clientName: client.name,
    currency: client.currency,
    reportLabel: LABEL[type],
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    headline: advice.headline,
    narrative: advice.details,
    metrics,
  });

  const db = getDb();
  const [row] = await db
    .insert(schema.reports)
    .values({
      clientId: client.id,
      type,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      narrative: advice.details,
      metricsSnapshot: metrics,
      pdfBase64: pdfBuffer.toString("base64"),
      generatedBy: generatedBy ?? null,
    })
    .returning();

  const { notifier } = getProviders();
  await notifier.notify({
    clientId: client.id,
    kind: NOTIFY_KIND[type],
    title: `${LABEL[type]} report ready — ${client.name}`,
    body: advice.headline,
    meta: { reportId: row.id, periodStart: period.periodStart, periodEnd: period.periodEnd },
  });

  return row;
}
