"use client";

import { useMemo, useState } from "react";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";

export interface CampaignAggregate {
  campaignId: string;
  name: string;
  status: string;
  category: string | null;
  currency: string;
  spend: number;
  impressions: number;
  reach: number;
  results: number;
  ctr: number;
}

type ColumnKey = keyof Pick<
  CampaignAggregate,
  "name" | "status" | "category" | "spend" | "impressions" | "reach" | "results" | "ctr"
>;

const COLUMNS: { key: ColumnKey; label: string; numeric: boolean }[] = [
  { key: "name", label: "Campaign", numeric: false },
  { key: "status", label: "Status", numeric: false },
  { key: "category", label: "Category", numeric: false },
  { key: "spend", label: "Spend", numeric: true },
  { key: "impressions", label: "Impressions", numeric: true },
  { key: "reach", label: "Reach", numeric: true },
  { key: "results", label: "Results", numeric: true },
  { key: "ctr", label: "CTR", numeric: true },
];

/** Read-only campaign table: sortable, status-filterable, hideable columns. */
export function AdCampaignTable({ rows }: { rows: CampaignAggregate[] }) {
  const [sortKey, setSortKey] = useState<ColumnKey>("spend");
  const [asc, setAsc] = useState(false);
  const [status, setStatus] = useState<string>("all");
  const [hidden, setHidden] = useState<Set<ColumnKey>>(new Set());

  const statuses = useMemo(
    () => ["all", ...new Set(rows.map((r) => r.status))],
    [rows],
  );

  const visibleCols = COLUMNS.filter((c) => !hidden.has(c.key));

  const filtered = useMemo(() => {
    const subset = status === "all" ? rows : rows.filter((r) => r.status === status);
    return [...subset].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      return asc ? cmp : -cmp;
    });
  }, [rows, status, sortKey, asc]);

  function fmt(c: ColumnKey, r: CampaignAggregate) {
    switch (c) {
      case "spend":
        return formatMoney(r.spend, r.currency);
      case "impressions":
        return formatNumber(r.impressions);
      case "reach":
        return formatNumber(r.reach);
      case "results":
        return formatNumber(r.results);
      case "ctr":
        return formatPercent(r.ctr, 2);
      case "category":
        return r.category ?? "—";
      default:
        return String(r[c]);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-1 text-ink-soft">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded border border-line bg-surface-sunken px-2 py-1 outline-none focus:border-brand"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2 text-ink-soft">
          <span>Columns:</span>
          {COLUMNS.filter((c) => c.key !== "name").map((c) => (
            <label key={c.key} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={!hidden.has(c.key)}
                onChange={(e) => {
                  const next = new Set(hidden);
                  if (e.target.checked) next.delete(c.key);
                  else next.add(c.key);
                  setHidden(next);
                }}
              />
              {c.label}
            </label>
          ))}
        </div>
      </div>

      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-ink-faint">
          <tr>
            {visibleCols.map((c) => (
              <th
                key={c.key}
                onClick={() => {
                  if (sortKey === c.key) setAsc(!asc);
                  else {
                    setSortKey(c.key);
                    setAsc(false);
                  }
                }}
                className={`cursor-pointer select-none py-1 ${c.numeric ? "text-right" : ""}`}
              >
                {c.label}
                {sortKey === c.key ? (asc ? " ▲" : " ▼") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.campaignId} className="border-t border-line">
              {visibleCols.map((c) => (
                <td key={c.key} className={`py-1.5 ${c.numeric ? "text-right tabular-nums" : ""}`}>
                  {fmt(c.key, r)}
                </td>
              ))}
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={visibleCols.length} className="py-4 text-center text-ink-faint">
                No campaigns match.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
