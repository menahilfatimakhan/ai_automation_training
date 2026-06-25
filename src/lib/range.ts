import { daysAgoIso, monthStartIso, todayIso } from "@/lib/format";

/**
 * Shared time-range resolution for the operational dashboards (Sales/Setter/Ads).
 * Master stays on a monthly scorecard because its goals + overrides are
 * inherently month-scoped.
 */
export type RangeKey = "7d" | "30d" | "mtd" | "qtd";

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "mtd", label: "MTD" },
  { key: "qtd", label: "QTD" },
];

export function isRangeKey(v: string | undefined): v is RangeKey {
  return v === "7d" || v === "30d" || v === "mtd" || v === "qtd";
}

function quarterStartIso(): string {
  const d = new Date();
  const qStartMonth = Math.floor(d.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(d.getUTCFullYear(), qStartMonth, 1))
    .toISOString()
    .slice(0, 10);
}

export function resolveRange(key: RangeKey): { from: string; to: string; label: string } {
  const to = todayIso();
  switch (key) {
    case "7d":
      return { from: daysAgoIso(6), to, label: "last 7 days" };
    case "qtd":
      return { from: quarterStartIso(), to, label: "quarter to date" };
    case "mtd":
      return { from: monthStartIso(), to, label: "month to date" };
    case "30d":
    default:
      return { from: daysAgoIso(29), to, label: "last 30 days" };
  }
}
