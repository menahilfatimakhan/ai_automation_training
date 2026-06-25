import { getSessionContext } from "@/lib/auth";
import { loadCallLogs, type DatePreset } from "@/lib/data/call-logs";

/**
 * GET /api/export/call-logs?client=&preset=&outcome=&search=
 * Streams the current (filtered) call log as CSV. Reads go through the RLS-
 * scoped server client, so the export only ever contains rows the caller may
 * see — a closer's export is their own calls, a client's is its client_id.
 */
function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const clientId = url.searchParams.get("client");
  if (!clientId) return new Response("client required", { status: 400 });

  const { rows } = await loadCallLogs(clientId, {
    preset: (url.searchParams.get("preset") as DatePreset) ?? "this_month",
    outcome: url.searchParams.get("outcome") ?? "all",
    search: url.searchParams.get("search") ?? "",
    page: 1,
    pageSize: 5000,
  });

  const header = [
    "date",
    "outcome",
    "revenue",
    "cash_collected",
    "currency",
    "lead_source",
    "objection_reason",
    "tags",
    "notes",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.date,
        r.outcome,
        r.revenue,
        r.cashCollected,
        r.currency,
        r.leadSource,
        r.objectionReason,
        r.tags.join("; "),
        r.notes,
      ]
        .map(csvCell)
        .join(","),
    );
  }

  const csv = lines.join("\r\n");
  const filename = `call-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
