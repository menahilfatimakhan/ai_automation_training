import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CallRow } from "@/lib/data/dashboards";
import { CALL_OUTCOMES, bucketOf, type OutcomeBucket } from "@/domain/metrics";
import { daysAgoIso, monthStartIso, todayIso } from "@/lib/format";

const CALL_LOG_COLUMNS =
  "id, client_id, closer_user_id, booked_by_setter_id, date, outcome, revenue, cash_collected, currency, lead_source, objection_type, objection_notes, contact_name, contact_phone, contact_email, notes, tags";

function toCallRow(c: Record<string, unknown>): CallRow {
  return {
    id: c.id as string,
    clientId: c.client_id as string,
    closerUserId: c.closer_user_id as string | null,
    bookedBySetterId: c.booked_by_setter_id as string | null,
    date: c.date as string,
    outcome: c.outcome as CallRow["outcome"],
    revenue: Number(c.revenue),
    cashCollected: Number(c.cash_collected),
    currency: c.currency as string,
    leadSource: c.lead_source as string | null,
    objectionType: c.objection_type as CallRow["objectionType"],
    objectionNotes: c.objection_notes as string | null,
    contactName: c.contact_name as string | null,
    contactPhone: c.contact_phone as string | null,
    contactEmail: c.contact_email as string | null,
    notes: c.notes as string | null,
    tags: (c.tags as string[]) ?? [],
  };
}

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
    .select(CALL_LOG_COLUMNS, { count: "exact" })
    .eq("client_id", clientId)
    .gte("date", from)
    .lte("date", to);

  if (filter.outcome && filter.outcome !== "all") {
    query = query.eq("outcome", filter.outcome);
  }
  if (filter.search) {
    const s = filter.search.replace(/[%,]/g, "");
    query = query.or(
      `lead_source.ilike.%${s}%,objection_notes.ilike.%${s}%,notes.ilike.%${s}%`,
    );
  }

  const { data, count } = await query
    .order("date", { ascending: false })
    .range(offset, offset + filter.pageSize - 1);

  const rows: CallRow[] = (data ?? []).map(toCallRow);

  return { rows, total: count ?? 0, page: filter.page, pageSize: filter.pageSize };
}

/**
 * Outcome mix for the current date/search filter (ignores the outcome filter so
 * the full breakdown is always visible). Powers the color-coded summary strip.
 */
/** Outcome mix grouped into the 4 client buckets (closed / showed_not_closed / no_show / rescheduled). */
export async function loadOutcomeMix(
  clientId: string,
  filter: Pick<CallLogFilter, "preset" | "search">,
): Promise<Record<OutcomeBucket, number>> {
  const supabase = await createSupabaseServerClient();
  const { from, to } = presetRange(filter.preset);

  let query = supabase
    .from("calls")
    .select("outcome")
    .eq("client_id", clientId)
    .gte("date", from)
    .lte("date", to)
    .limit(5000);

  if (filter.search) {
    const s = filter.search.replace(/[%,]/g, "");
    query = query.or(
      `lead_source.ilike.%${s}%,objection_notes.ilike.%${s}%,notes.ilike.%${s}%`,
    );
  }

  const { data } = await query;
  const mix: Record<OutcomeBucket, number> = {
    closed: 0,
    showed_not_closed: 0,
    no_show: 0,
    rescheduled: 0,
  };
  for (const r of data ?? []) {
    const bucket = bucketOf(r.outcome as (typeof CALL_OUTCOMES)[number]);
    mix[bucket] += 1;
  }
  return mix;
}
