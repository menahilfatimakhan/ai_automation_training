import "@/lib/load-env"; // must be first: loads .env.local before env validation

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import XLSX from "xlsx";
import { eq, and, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { CallOutcome, ObjectionType } from "@/domain/metrics";

/**
 * Imports the client's real historical trackers (Seed Data/) into the schema,
 * replacing the synthetic demo clients from src/db/seed.ts. Idempotent: safe
 * to re-run (upserts clients/users by stable synthetic key, deletes+reinserts
 * each client's calls/setter-activity/ad rows sourced from these files).
 *
 * WHY the mapping choices below are what they are — every one of these was a
 * judgment call on messy, inconsistently-labeled real spreadsheets. Documented
 * here (and echoed in the generated report) rather than silently assumed:
 *
 * 1. Currency per client — the trackers never state a currency. Assigned by
 *    name origin (Danish names → DKK, "Thee Bridal Coach" → USD, matching
 *    Metrics/KPI_Calculations.md's explicit statement that Julie Bundgaard is
 *    DKK). Confirm/correct via the admin panel after import if wrong.
 * 2. Outcome literal → our 8-value enum — the real "Outcome" column uses its
 *    own vocabulary (see OUTCOME_MAP below), including a few values with no
 *    clean fit (Unresponsive Lead, Information Sent, Half-pay, Drag Over &
 *    Show) — mapped to the closest bucket, documented per-value below.
 * 3. Dates — the sheet-tab NAME cannot be trusted (e.g. one closer's "Mar" tab
 *    contains July-2025 dates while its "Apr" tab contains January-2025
 *    dates — almost certainly copy-pasted-template drift). Every Date cell
 *    that parses as a plausible Excel serial (>= 40000) is trusted directly.
 *    Only bare day-of-month integers (no real file exhibited this needing
 *    the fallback in the final run — see report) fall back to a chronological
 *    tab-order inference, logged as such.
 * 4. Ad spend/follower data only — the Ads trackers' own Revenue/Cash/Calls
 *    Booked columns are NOT imported (they would double-count what the Closer
 *    trackers already report); only Spend and New Followers are pulled from
 *    Ads trackers.
 *
 * Run with `npx tsx src/db/import-seed-data.ts`.
 */

const SEED_ROOT = path.resolve(process.cwd(), "Seed Data");

// ─── Client roster ───────────────────────────────────────────────────────────
interface ClientSpec {
  folder: string;
  displayName: string;
  currency: string;
}

const CLIENTS: ClientSpec[] = [
  { folder: "Daniel Steffensen", displayName: "Daniel Steffensen", currency: "DKK" },
  { folder: "Julie Bundgaard", displayName: "Julie Bundgaard", currency: "DKK" },
  { folder: "Lennart", displayName: "Lennart", currency: "DKK" },
  { folder: "Matti Isho", displayName: "Matti Isho", currency: "DKK" },
  { folder: "Thee Bridal Coach (Hope)", displayName: "Thee Bridal Coach (Hope)", currency: "USD" },
  { folder: "Tracker Archive/Anders Hansen", displayName: "Anders Hansen", currency: "DKK" },
  { folder: "Tracker Archive/Lucas Hedenbeck", displayName: "Lucas Hedenbeck", currency: "DKK" },
  { folder: "Tracker Archive/Olivia Bischoff", displayName: "Olivia Bischoff", currency: "DKK" },
  { folder: "Tracker Archive/The Property Business (Mads)", displayName: "The Property Business (Mads)", currency: "DKK" },
];

// ─── Outcome / objection mapping (derived from a full scan of real data) ────
// Counts from the actual scan are in the report; every literal value seen is
// listed here so an unmapped value is a loud failure, not a silent skip.
const OUTCOME_MAP: Record<string, CallOutcome> = {
  "full-pay": "paid_in_full",
  "split-pay": "split_pay",
  "half-pay": "split_pay", // partial-payment plan; same bucket as split-pay
  "offer & didn't buy": "offer_declined",
  "bad fit & no offer": "not_a_fit",
  "deposit": "deposit_only",
  "no-show": "no_show",
  "cancelled": "cancelled",
  "rescheduled": "rescheduled",
  // No clean fit in the 8-value model — conservatively excluded from every
  // percentage by mapping to "rescheduled" rather than guessing a bucket that
  // would skew close/show-up rates.
  "unresponsive lead": "rescheduled",
  "information sent": "rescheduled",
  "drag over & show": "rescheduled",
};

const OBJECTION_MAP: Record<string, ObjectionType | null> = {
  money: "money",
  "think about it": "think_about_it",
  fear: "fear",
  partner: "partner",
  time: "time",
  value: "value",
  "no obj": null,
  "no objection": null,
  "shopping around": null,
  distance: null,
};

// ─── Excel date handling ─────────────────────────────────────────────────────
/** Trust a cell value as a real Excel date serial only in a sane range. */
function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 40000 || serial > 60000) return null;
  const d = XLSX.SSF.parse_date_code(serial);
  if (!d) return null;
  return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
}

const MONTH_MAP: Record<string, number> = {
  jan: 1, januar: 1, january: 1,
  feb: 2, februar: 2, february: 2,
  mar: 3, marts: 3, march: 3,
  apr: 4, april: 4,
  may: 5, maj: 5,
  jun: 6, june: 6, juni: 6,
  jul: 7, july: 7, juli: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oct: 10, october: 10, oktober: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

/** Chronological month/year for each real (non-Dashboard/Deposits) sheet, anchored on any "<Month> YY" name found. */
function inferSheetMonths(sheetNames: string[]): Map<string, { month: number; year: number }> {
  const real = sheetNames.filter((s) => !/^dashboard$|^deposits$/i.test(s));
  const parsed = real.map((name) => {
    const m = name.trim().match(/^([a-zA-ZæøåÆØÅ]+)\.?\s*(\d{2})?$/);
    const monthKey = m?.[1]?.toLowerCase();
    const month = monthKey ? MONTH_MAP[monthKey] : undefined;
    const year = m?.[2] ? 2000 + Number(m[2]) : undefined;
    return { name, month, year };
  });
  let anchorIdx = parsed.findIndex((p) => p.month && p.year);
  const result = new Map<string, { month: number; year: number }>();
  if (anchorIdx === -1) {
    // No sheet in this workbook carries an explicit year (e.g. all-bare
    // "Oct, Nov, Dec, Jan, Feb"). Every other tracker file in this batch that
    // *does* have an explicit-year sheet places bare Jul-Dec tabs in 2025 and
    // bare Jan-Jun tabs in 2026 — synthesize an anchor on that same
    // convention at the last parseable sheet, rather than leaving every date
    // in the file unrecoverable.
    const lastParseableIdx = [...parsed].reverse().findIndex((p) => p.month !== undefined);
    if (lastParseableIdx === -1) return result;
    anchorIdx = parsed.length - 1 - lastParseableIdx;
    const month = parsed[anchorIdx].month!;
    parsed[anchorIdx].year = month <= 6 ? 2026 : 2025;
  }
  const anchor = parsed[anchorIdx];
  for (let i = 0; i < parsed.length; i++) {
    const offset = i - anchorIdx;
    let month = anchor.month! + offset;
    let year = anchor.year!;
    while (month > 12) { month -= 12; year += 1; }
    while (month < 1) { month += 12; year -= 1; }
    result.set(parsed[i].name, { month, year });
  }
  return result;
}

const MONTH_NAME_RE = new Set(Object.keys(MONTH_MAP));

/**
 * Parses a Date cell in any of the formats real closer trackers actually use:
 * a proper Excel serial, a bare day-of-month integer, or a hand-typed string
 * ("30/10/25", "16.12.25", "7th Jan", "9th January", "3rd", "4th "). Returns
 * null (never a guess) when nothing recognizable is found. `sheetMonth` (from
 * inferSheetMonths) is the fallback month/year for anything that isn't a full
 * date on its own. Result also reports whether a fallback was used, for the
 * report's transparency counters.
 */
function parseDateCell(
  raw: unknown,
  sheetMonth: { month: number; year: number } | undefined,
): { iso: string; usedFallback: boolean } | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (raw >= 40000) {
      const iso = excelSerialToIso(raw);
      return iso ? { iso, usedFallback: false } : null;
    }
    if (raw >= 1 && raw <= 31 && sheetMonth) {
      const { month, year } = sheetMonth;
      return { iso: `${year}-${String(month).padStart(2, "0")}-${String(Math.round(raw)).padStart(2, "0")}`, usedFallback: true };
    }
    return null;
  }

  const s = cellStr(raw);
  if (!s) return null;

  // DD/MM/YYYY, DD/MM/YY, DD.MM.YYYY, DD.MM.YY
  let m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { iso: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, usedFallback: false };
    }
  }

  // DD/MM or DD.MM (no year — use the sheet's inferred year)
  m = s.match(/^(\d{1,2})[./](\d{1,2})$/);
  if (m && sheetMonth) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { iso: `${sheetMonth.year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, usedFallback: true };
    }
  }

  // "7th Jan", "9th January", "15th Jan" — ordinal day + month name, sheet's inferred year
  m = s.toLowerCase().match(/^(\d{1,2})(?:st|nd|rd|th)?\.?\s+([a-z]+)\.?$/);
  if (m && MONTH_NAME_RE.has(m[2]) && sheetMonth) {
    const day = Number(m[1]);
    const month = MONTH_MAP[m[2]];
    if (day >= 1 && day <= 31) {
      return { iso: `${sheetMonth.year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, usedFallback: true };
    }
  }

  // Bare ordinal ("3rd", "4th ") — day-of-month only, sheet's inferred month/year
  m = s.toLowerCase().match(/^(\d{1,2})(?:st|nd|rd|th)\.?$/);
  if (m && sheetMonth) {
    const day = Number(m[1]);
    if (day >= 1 && day <= 31) {
      const { month, year } = sheetMonth;
      return { iso: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, usedFallback: true };
    }
  }

  return null;
}

// ─── Sheet helpers ───────────────────────────────────────────────────────────
function sheetRows(ws: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" }) as unknown[][];
}

function findHeaderRow(rows: unknown[][], required: string[]): { idx: number; header: string[] } | null {
  for (let i = 0; i < rows.length; i++) {
    const header = rows[i].map((c) => String(c).trim());
    if (required.every((r) => header.includes(r))) return { idx: i, header };
  }
  return null;
}

function cellStr(v: unknown): string {
  return v === undefined || v === null ? "" : String(v).trim();
}

function cellNum(v: unknown): number {
  if (typeof v === "number") return v;
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** For integer DB columns — spreadsheet formula artifacts occasionally leave a fractional value. */
function cellInt(v: unknown): number {
  return Math.round(cellNum(v));
}

// ─── Import report ───────────────────────────────────────────────────────────
interface ClientReport {
  client: string;
  currency: string;
  closerFiles: number;
  callsImported: number;
  callsSkippedNoDate: number;
  outcomeCounts: Record<string, number>;
  setterFiles: number;
  setterRowsImported: number;
  adFiles: number;
  adCampaigns: number;
  adMetricRows: number;
  dateFallbackRows: number;
  errors: string[];
}

function emptyReport(client: string, currency: string): ClientReport {
  return {
    client,
    currency,
    closerFiles: 0,
    callsImported: 0,
    callsSkippedNoDate: 0,
    outcomeCounts: {},
    setterFiles: 0,
    setterRowsImported: 0,
    adFiles: 0,
    adCampaigns: 0,
    adMetricRows: 0,
    dateFallbackRows: 0,
    errors: [],
  };
}

// ─── User upsert (no real Supabase auth account — historical reps never log in) ──
async function findOrCreateUser(
  db: ReturnType<typeof getDb>,
  email: string,
  fullName: string,
): Promise<string> {
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (existing) return existing.id;
  const id = randomUUID();
  await db.insert(schema.users).values({ id, email, fullName, isAdmin: false });
  return id;
}

async function findOrCreateClient(
  db: ReturnType<typeof getDb>,
  name: string,
  currency: string,
): Promise<string> {
  const existing = await db.query.clients.findFirst({ where: eq(schema.clients.name, name) });
  if (existing) return existing.id;
  const id = randomUUID();
  await db.insert(schema.clients).values({ id, name, reportingCurrency: currency });
  return id;
}

async function ensureMembership(
  db: ReturnType<typeof getDb>,
  userId: string,
  clientId: string,
  role: "closer" | "setter",
) {
  const existing = await db.query.memberships.findFirst({
    where: and(eq(schema.memberships.userId, userId), eq(schema.memberships.clientId, clientId)),
  });
  if (!existing) {
    await db.insert(schema.memberships).values({ userId, clientId, role });
  }
}

function walkXlsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkXlsxFiles(p));
    else if (entry.isFile() && entry.name.endsWith(".xlsx")) out.push(p);
  }
  return out;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "unnamed";
}

// ─── Closer tracker import ───────────────────────────────────────────────────
async function importCloserFile(
  db: ReturnType<typeof getDb>,
  filePath: string,
  clientId: string,
  clientSlug: string,
  currency: string,
  report: ClientReport,
) {
  const repName = path.basename(filePath, ".xlsx").replace(/closer tracker/i, "").trim() || "Closer";
  const email = `closer.${slugify(repName)}@${clientSlug}.seed-import`;
  const closerId = await findOrCreateUser(db, email, repName);
  await ensureMembership(db, closerId, clientId, "closer");

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.readFile(filePath, { cellDates: false });
  } catch {
    return;
  }
  report.closerFiles++;

  const sheetMonths = inferSheetMonths(wb.SheetNames);

  for (const sn of wb.SheetNames) {
    if (/^dashboard$|^deposits$/i.test(sn)) continue;
    const rows = sheetRows(wb.Sheets[sn]);
    const found = findHeaderRow(rows, ["Date", "Outcome"]);
    if (!found) continue;
    const { idx, header } = found;
    const col = (name: string) => header.indexOf(name);
    const iDate = col("Date");
    const iName = col("Name");
    const iPhone = col("Phone No.");
    const iEmailIg = [col("Email"), col("IG Navn"), col("IG-handle"), col("Ig navn"), col("IG navn")].find((i) => i >= 0) ?? -1;
    const iSource = col("Source");
    const iOutcome = col("Outcome");
    const iRevenue = col("Revenue");
    const iCash = col("Cash");
    const iObjection = col("Objection");
    const iObjectionNotes = col("Objection Notes");
    const iFollowUp = col("Follow Up/Next Steps");
    const iSummary = col("Call Summary");

    const batch: (typeof schema.calls.$inferInsert)[] = [];

    for (const row of rows.slice(idx + 1)) {
      const parsed = parseDateCell(row[iDate], sheetMonths.get(sn));
      const iso = parsed?.iso ?? null;
      if (parsed?.usedFallback) report.dateFallbackRows++;
      if (!iso) {
        // Row is fully blank (template padding) vs. a real row with an
        // unparseable date — only count the latter as skipped.
        const hasContent = row.some((c, i) => i !== iDate && String(c).trim() !== "");
        if (hasContent) report.callsSkippedNoDate++;
        continue;
      }

      const outcomeRaw = cellStr(row[iOutcome]).toLowerCase();
      if (!outcomeRaw) continue;
      const outcome = OUTCOME_MAP[outcomeRaw];
      if (!outcome) continue; // unmapped literal — see report for any misses
      report.outcomeCounts[outcomeRaw] = (report.outcomeCounts[outcomeRaw] ?? 0) + 1;

      const objectionRaw = cellStr(row[iObjection]).toLowerCase();
      const objectionType = objectionRaw ? (OBJECTION_MAP[objectionRaw] ?? null) : null;
      const isDeclineOutcome = outcome === "offer_declined" || outcome === "not_a_fit";

      batch.push({
        clientId,
        closerUserId: closerId,
        date: iso,
        outcome,
        revenue: String(cellNum(row[iRevenue])),
        cashCollected: String(cellNum(row[iCash])),
        currency,
        leadSource: iSource >= 0 ? cellStr(row[iSource]) || null : null,
        objectionType: isDeclineOutcome ? objectionType : null,
        objectionNotes: iObjectionNotes >= 0 ? cellStr(row[iObjectionNotes]) || null : null,
        contactName: iName >= 0 ? cellStr(row[iName]) || null : null,
        contactPhone: iPhone >= 0 ? cellStr(row[iPhone]) || null : null,
        contactEmail: iEmailIg >= 0 ? cellStr(row[iEmailIg]) || null : null,
        notes:
          [iFollowUp >= 0 ? cellStr(row[iFollowUp]) : "", iSummary >= 0 ? cellStr(row[iSummary]) : ""]
            .filter(Boolean)
            .join(" — ") || null,
        tags: [],
      });
    }

    if (batch.length) {
      await db.insert(schema.calls).values(batch);
      report.callsImported += batch.length;
    }
  }
}

// ─── Setter tracker import ───────────────────────────────────────────────────
async function importSetterFile(
  db: ReturnType<typeof getDb>,
  filePath: string,
  clientId: string,
  clientSlug: string,
  report: ClientReport,
) {
  const repName = path.basename(filePath, ".xlsx").replace(/setter tracker|chat tracker/i, "").trim() || "Setter";
  const email = `setter.${slugify(repName)}@${clientSlug}.seed-import`;
  const setterId = await findOrCreateUser(db, email, repName);
  await ensureMembership(db, setterId, clientId, "setter");

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.readFile(filePath, { cellDates: false });
  } catch {
    return;
  }
  report.setterFiles++;

  for (const sn of wb.SheetNames) {
    const rows = sheetRows(wb.Sheets[sn]);
    // Candidate data sheet: col A somewhere contains "New Convos" within the first few rows.
    const labelRowIdx = rows.findIndex((r) => cellStr(r[0]).toLowerCase() === "new convos");
    if (labelRowIdx === -1) continue;
    const dateRowIdx = labelRowIdx - 1;
    if (dateRowIdx < 0) continue;
    const dateRow = rows[dateRowIdx];

    const metricRow = (label: string) => rows.find((r) => cellStr(r[0]).toLowerCase() === label);
    const convos = metricRow("new convos");
    const offers = metricRow("offers");
    const booked = metricRow("booked calls");
    const followUps = metricRow("follow-ups");
    if (!convos) continue;

    const byDate = new Map<string, { conversations: number; proposals: number; callsBooked: number; followUps: number }>();
    for (let c = 1; c < dateRow.length; c++) {
      const serial = Number(dateRow[c]);
      const iso = excelSerialToIso(serial);
      if (!iso) continue; // month-summary columns (e.g. "JAN" totals) land here and are skipped
      const rec = {
        conversations: cellInt(convos[c]),
        proposals: offers ? cellInt(offers[c]) : 0,
        callsBooked: booked ? cellInt(booked[c]) : 0,
        followUps: followUps ? cellInt(followUps[c]) : 0,
      };
      if (rec.conversations || rec.proposals || rec.callsBooked || rec.followUps) {
        byDate.set(iso, rec);
      }
    }

    const batch = [...byDate.entries()].map(([date, rec]) => ({
      clientId,
      setterUserId: setterId,
      date,
      conversations: rec.conversations,
      // "Responses" isn't tracked separately in these real trackers (only
      // New Convos → Offers → Booked, no distinct Replies stage) — left 0
      // rather than fabricated. Lead/Response % will read as 0 for imported
      // clients until/unless a client's tracker turns out to carry it.
      replies: 0,
      proposals: rec.proposals,
      callsBooked: rec.callsBooked,
      followUps: rec.followUps,
    }));

    if (batch.length) {
      await db.insert(schema.setterDailyActivity).values(batch).onConflictDoNothing({
        target: [
          schema.setterDailyActivity.clientId,
          schema.setterDailyActivity.setterUserId,
          schema.setterDailyActivity.date,
        ],
      });
      report.setterRowsImported += batch.length;
    }
  }
}

// ─── Ads tracker import (spend + followers only — never revenue/cash/calls) ──
async function importAdsFile(
  db: ReturnType<typeof getDb>,
  filePath: string,
  clientId: string,
  currency: string,
  report: ClientReport,
) {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.readFile(filePath, { cellDates: false });
  } catch {
    return;
  }
  report.adFiles++;

  for (const sn of wb.SheetNames) {
    const rows = sheetRows(wb.Sheets[sn]);
    const found = findHeaderRow(rows, ["Day", "Daily Spend"]);
    if (!found) continue;
    const { idx, header } = found;

    // Locate each "AD n" block's column start.
    const blockStarts = header
      .map((h, i) => ({ h, i }))
      .filter(({ h }) => /^AD \d+$/.test(h));

    // campaignId -> name (first non-empty string seen in that block's name column)
    const campaignNames = new Map<number, string>();
    const campaignRows = new Map<number, { date: string; spend: number; newFollowers: number }[]>();

    for (const row of rows.slice(idx + 1)) {
      const dayRaw = row[header.indexOf("Day")];
      const iso = excelSerialToIso(Number(dayRaw));
      if (!iso) continue;

      for (const { i: blockStart } of blockStarts) {
        // Block layout: [Name/AD-n, Follows, New AD Follows, Total Spend, Daily Spend, Cost/Lead]
        const nameCell = cellStr(row[blockStart]);
        if (nameCell && Number.isNaN(Number(nameCell))) {
          if (!campaignNames.has(blockStart)) campaignNames.set(blockStart, nameCell);
        }
        const dailySpend = cellNum(row[blockStart + 4]);
        const newFollows = cellInt(row[blockStart + 2]);
        if (dailySpend || newFollows) {
          const list = campaignRows.get(blockStart) ?? [];
          list.push({ date: iso, spend: dailySpend, newFollowers: newFollows });
          campaignRows.set(blockStart, list);
        }
      }
    }

    for (const [blockStart, dayRows] of campaignRows) {
      const name = campaignNames.get(blockStart) ?? `Ad ${blockStarts.findIndex((b) => b.i === blockStart) + 1}`;
      const campaignId = `${slugify(path.basename(filePath, ".xlsx"))}-${slugify(name)}`;

      await db
        .insert(schema.adCampaigns)
        .values({ clientId, campaignId, name, status: "active", currency })
        .onConflictDoNothing({ target: [schema.adCampaigns.clientId, schema.adCampaigns.campaignId] });
      report.adCampaigns++;

      const metricRows = dayRows.map((r) => ({
        clientId,
        campaignId,
        date: r.date,
        spend: String(r.spend),
        impressions: 0,
        reach: 0,
        results: 0,
        ctr: "0",
        newFollowers: r.newFollowers || null,
        totalFollowers: null,
        status: "active" as const,
        currency,
      }));
      if (metricRows.length) {
        await db
          .insert(schema.adDailyMetrics)
          .values(metricRows)
          .onConflictDoNothing({
            target: [schema.adDailyMetrics.clientId, schema.adDailyMetrics.campaignId, schema.adDailyMetrics.date],
          });
        report.adMetricRows += metricRows.length;
      }
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const db = getDb();
  const reports: ClientReport[] = [];

  for (const spec of CLIENTS) {
    const dir = path.join(SEED_ROOT, spec.folder);
    if (!fs.existsSync(dir)) {
      console.warn(`Skipping ${spec.displayName}: folder not found at ${dir}`);
      continue;
    }
    const clientSlug = slugify(spec.displayName);
    const clientId = await findOrCreateClient(db, spec.displayName, spec.currency);
    const report = emptyReport(spec.displayName, spec.currency);

    // Clear this client's previously-imported rows for a clean, idempotent re-run.
    await db.delete(schema.calls).where(eq(schema.calls.clientId, clientId));
    await db.delete(schema.setterDailyActivity).where(eq(schema.setterDailyActivity.clientId, clientId));
    await db.delete(schema.adDailyMetrics).where(eq(schema.adDailyMetrics.clientId, clientId));
    await db.delete(schema.adCampaigns).where(eq(schema.adCampaigns.clientId, clientId));

    const allFiles = walkXlsxFiles(dir);

    for (const file of allFiles) {
      const lower = file.toLowerCase();
      if (lower.includes("p&l") || lower.includes("commission")) continue;
      try {
        if (lower.includes("closer") || lower.includes("sales tracker")) {
          await importCloserFile(db, file, clientId, clientSlug, spec.currency, report);
        } else if (lower.includes("setter") || lower.includes("chat tracker")) {
          await importSetterFile(db, file, clientId, clientSlug, report);
        } else if (lower.includes("ads") || lower.includes("follower")) {
          await importAdsFile(db, file, clientId, spec.currency, report);
        }
      } catch (err) {
        const msg = `${path.basename(file)}: ${err instanceof Error ? err.message : String(err)}`;
        report.errors.push(msg);
        console.error(`  ERROR importing ${msg}`);
      }
    }

    reports.push(report);
    console.info(
      `${spec.displayName}: ${report.callsImported} calls, ${report.setterRowsImported} setter-days, ` +
        `${report.adCampaigns} ad campaigns / ${report.adMetricRows} ad-metric rows`,
    );
  }

  // Write a full markdown report.
  const lines: string[] = ["# Seed Import Report", "", `Generated ${new Date().toISOString()}`, ""];
  for (const r of reports) {
    lines.push(`## ${r.client} (${r.currency})`);
    lines.push(`- Closer files: ${r.closerFiles}, calls imported: ${r.callsImported}, skipped (unparseable date): ${r.callsSkippedNoDate}, date-fallback rows: ${r.dateFallbackRows}`);
    lines.push(`- Setter files: ${r.setterFiles}, setter-days imported: ${r.setterRowsImported}`);
    lines.push(`- Ad files: ${r.adFiles}, campaigns: ${r.adCampaigns}, metric rows: ${r.adMetricRows}`);
    lines.push(`- Outcome literal counts: ${JSON.stringify(r.outcomeCounts)}`);
    if (r.errors.length) {
      lines.push(`- Errors (file skipped, not aborted):`);
      for (const e of r.errors) lines.push(`  - ${e}`);
    }
    lines.push("");
  }
  fs.writeFileSync(path.resolve(process.cwd(), "docs/SEED_IMPORT_REPORT.md"), lines.join("\n"));

  console.info("\nImport complete. Report written to docs/SEED_IMPORT_REPORT.md");
  process.exit(0);
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
