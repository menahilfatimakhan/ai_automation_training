import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CallRow } from "@/lib/data/dashboards";
import { daysAgoIso, monthStartIso, todayIso } from "@/lib/format";

export type DatePreset = "this_month" | "last_7_days" | "ytd" | "all";

export function presetRange(preset: DatePreset): { from: string; to: string } {
  const to = todayIso();
  switch (preset) {
    case "last_7_days":
      return { from: daysAgoIso(6), to };
    case "ytd":
      return { from: `${new Date().getUTCFullYear()}-01-01`, to };
    case "all":
      return { from: "1970-01-01", to };
    case "this_month":
    default:
      return { from: monthStartIso(), to };
  }
}

export interface CallLogFilter {
  search?: string;
  outcome?: string;
  preset: DatePreset;
  page: number;
  pageSize: number;
}

export interface CallLogPage {
  rows: CallRow[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Paginated, searchable, filterable historical call log. RLS-scoped: a closer
 * sees only their own calls, a client sees all of its calls, admin sees all.
 */
export async function loadCallLogs(
  clientId: string,
  filter: CallLogFilter,
): Promise<CallLogPage> {
  const supabase = await createSupabaseServerClient();
  const { from, to } = presetRange(filter.preset);
  const offset = (filter.page - 1) * filter.pageSize;

  let query = supabase
    .from("calls")
    .select(
      "id, client_id, closer_user_id, date, outcome, revenue, cash_collected, currency, lead_source, objection_reason, notes, tags",
      { count: "exact" },
    )
    .eq("client_id", clientId)
    .gte("date", from)
    .lte("date", to);

  if (filter.outcome && filter.outcome !== "all") {
    query = query.eq("outcome", filter.outcome);
  }
  if (filter.search) {
    const s = filter.search.replace(/[%,]/g, "");
    query = query.or(
      `lead_source.ilike.%${s}%,objection_reason.ilike.%${s}%,notes.ilike.%${s}%`,
    );
  }

  const { data, count } = await query
    .order("date", { ascending: false })
    .range(offset, offset + filter.pageSize - 1);

  const rows: CallRow[] = (data ?? []).map((c) => ({
    id: c.id,
    clientId: c.client_id,
    closerUserId: c.closer_user_id,
    date: c.date,
    outcome: c.outcome,
    revenue: Number(c.revenue),
    cashCollected: Number(c.cash_collected),
    currency: c.currency,
    leadSource: c.lead_source,
    objectionReason: c.objection_reason,
    notes: c.notes,
    tags: c.tags ?? [],
  }));

  return { rows, total: count ?? 0, page: filter.page, pageSize: filter.pageSize };
}
