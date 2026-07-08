import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AdMetricRecord,
  CallRecord,
  ObjectionType,
  SetterActivityRecord,
} from "@/domain/metrics";
import type { OverrideRecord } from "@/lib/kpi/resolve";

/**
 * Dashboard data loaders. All reads go through the RLS-scoped Supabase server
 * client, so a caller only ever receives rows their role is allowed to see —
 * the KPI engine then computes over exactly that visible slice.
 */

export interface CallRow {
  id: string;
  clientId: string;
  closerUserId: string | null;
  bookedBySetterId: string | null;
  date: string;
  outcome: CallRecord["outcome"];
  revenue: number;
  cashCollected: number;
  currency: string;
  leadSource: string | null;
  objectionType: ObjectionType | null;
  objectionNotes: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  notes: string | null;
  tags: string[];
}

const CALL_COLUMNS =
  "id, client_id, closer_user_id, booked_by_setter_id, date, outcome, revenue, cash_collected, currency, lead_source, objection_type, objection_notes, contact_name, contact_phone, contact_email, notes, tags";

function toCallRow(c: Record<string, unknown>): CallRow {
  return {
    id: c.id as string,
    clientId: c.client_id as string,
    closerUserId: c.closer_user_id as string | null,
    bookedBySetterId: c.booked_by_setter_id as string | null,
    date: c.date as string,
    outcome: c.outcome as CallRecord["outcome"],
    revenue: Number(c.revenue),
    cashCollected: Number(c.cash_collected),
    currency: c.currency as string,
    leadSource: c.lead_source as string | null,
    objectionType: c.objection_type as ObjectionType | null,
    objectionNotes: c.objection_notes as string | null,
    contactName: c.contact_name as string | null,
    contactPhone: c.contact_phone as string | null,
    contactEmail: c.contact_email as string | null,
    notes: c.notes as string | null,
    tags: (c.tags as string[]) ?? [],
  };
}

export async function loadCalls(
  clientId: string,
  fromIso: string,
  toIso: string,
): Promise<CallRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("calls")
    .select(CALL_COLUMNS)
    .eq("client_id", clientId)
    .gte("date", fromIso)
    .lte("date", toIso)
    .order("date", { ascending: false });

  return (data ?? []).map(toCallRow);
}

/**
 * Daily closed-deal count + closed revenue over a trailing window (e.g. 100
 * days), oldest → newest. Powers the Master deals-vs-revenue trend.
 */
export async function loadClosedDealsTrend(
  clientId: string,
  fromIso: string,
  toIso: string,
): Promise<{ date: string; deals: number; revenue: number }[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("calls")
    .select("date, revenue, outcome")
    .eq("client_id", clientId)
    .in("outcome", ["paid_in_full", "split_pay"])
    .gte("date", fromIso)
    .lte("date", toIso)
    .order("date", { ascending: true });

  const byDate = new Map<string, { deals: number; revenue: number }>();
  for (const c of data ?? []) {
    const cur = byDate.get(c.date) ?? { deals: 0, revenue: 0 };
    cur.deals += 1;
    cur.revenue += Number(c.revenue);
    byDate.set(c.date, cur);
  }
  return [...byDate.entries()].map(([date, v]) => ({
    date,
    deals: v.deals,
    revenue: Math.round(v.revenue),
  }));
}

export function toCallRecords(rows: CallRow[]): CallRecord[] {
  return rows.map((r) => ({
    outcome: r.outcome,
    revenue: r.revenue,
    cashCollected: r.cashCollected,
    currency: r.currency,
    date: r.date,
    objectionType: r.objectionType,
  }));
}

export interface SetterActivityRow extends SetterActivityRecord {
  id: string;
  date: string;
  setterUserId: string;
}

export async function loadSetterActivity(
  clientId: string,
  fromIso: string,
  toIso: string,
): Promise<SetterActivityRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("setter_daily_activity")
    .select(
      "id, setter_user_id, date, conversations, replies, proposals, calls_booked, follow_ups",
    )
    .eq("client_id", clientId)
    .gte("date", fromIso)
    .lte("date", toIso)
    .order("date", { ascending: true });

  return (data ?? []).map((r) => ({
    id: r.id,
    setterUserId: r.setter_user_id,
    date: r.date,
    conversations: r.conversations,
    replies: r.replies,
    proposals: r.proposals,
    callsBooked: r.calls_booked,
    followUps: r.follow_ups,
  }));
}

export interface AdMetricRow extends AdMetricRecord {
  campaignId: string;
  reach: number;
  totalFollowers: number | null;
  category: string | null;
}

export async function loadAdMetrics(
  clientId: string,
  fromIso: string,
  toIso: string,
): Promise<AdMetricRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("ad_daily_metrics")
    .select(
      "campaign_id, date, spend, impressions, reach, results, ctr, total_followers, new_followers, status, category, currency",
    )
    .eq("client_id", clientId)
    .gte("date", fromIso)
    .lte("date", toIso)
    .order("date", { ascending: true });

  return (data ?? []).map((r) => ({
    campaignId: r.campaign_id,
    date: r.date,
    spend: Number(r.spend),
    impressions: r.impressions,
    reach: r.reach,
    results: r.results,
    ctr: Number(r.ctr),
    totalFollowers: r.total_followers,
    newFollowers: r.new_followers,
    status: r.status as AdMetricRow["status"],
    category: r.category,
    currency: r.currency,
  }));
}

export interface CampaignRow {
  campaignId: string;
  name: string;
  status: string;
  category: string | null;
  /** Client-set: "typeform" (Typeform-focused) or "normal". */
  adFocus: string | null;
  /** Set when an admin flags this ad for review; null = not flagged. */
  flaggedReason: string | null;
  currency: string;
}

export async function loadCampaigns(clientId: string): Promise<CampaignRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("ad_campaigns")
    .select("campaign_id, name, status, category, ad_focus, flagged_reason, currency")
    .eq("client_id", clientId)
    .order("name");
  return (data ?? []).map((r) => ({
    campaignId: r.campaign_id,
    name: r.name,
    status: r.status,
    category: r.category,
    adFocus: r.ad_focus,
    flaggedReason: r.flagged_reason,
    currency: r.currency,
  }));
}

export interface UserRef {
  id: string;
  fullName: string | null;
}

/** Users with a given role on a client (for the Closer Leaderboard / Setter Summary). */
export async function loadMembersByRole(
  clientId: string,
  role: "closer" | "setter",
): Promise<UserRef[]> {
  const supabase = await createSupabaseServerClient();
  const { data: memberships } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("client_id", clientId)
    .eq("role", role);
  const userIds = [...new Set((memberships ?? []).map((m) => m.user_id))];
  if (userIds.length === 0) return [];
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name")
    .in("id", userIds);
  return (users ?? []).map((u) => ({ id: u.id, fullName: u.full_name }));
}

/** A client's configured timezone (client_settings), defaulting to UTC when unset. */
export async function loadClientTimezone(clientId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("client_settings")
    .select("timezone")
    .eq("client_id", clientId)
    .maybeSingle();
  return data?.timezone ?? "UTC";
}

export interface GoalRow {
  revenueGoal: number;
  callsGoal: number;
  currency: string;
}

export async function loadGoalForMonth(
  clientId: string,
  monthIso: string,
): Promise<GoalRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("goals")
    .select("revenue_goal, calls_goal, currency")
    .eq("client_id", clientId)
    .eq("month", monthIso)
    .maybeSingle();
  if (!data) return null;
  return {
    revenueGoal: Number(data.revenue_goal),
    callsGoal: data.calls_goal,
    currency: data.currency,
  };
}

/** Active overrides for a period, grouped by metric_key. */
export async function loadOverrides(
  clientId: string,
  periodStart: string,
  periodEnd: string,
): Promise<Map<string, OverrideRecord[]>> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("metric_overrides")
    .select("target_key, value, active, created_at, source")
    .eq("client_id", clientId)
    .eq("target_type", "kpi")
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd);

  const map = new Map<string, OverrideRecord[]>();
  for (const o of data ?? []) {
    const list = map.get(o.target_key) ?? [];
    list.push({
      value: Number(o.value),
      active: o.active,
      createdAt: o.created_at,
      source: o.source,
    });
    map.set(o.target_key, list);
  }
  return map;
}

export interface SuggestionRow {
  id: string;
  targetKey: string;
  suggestedValue: number | null;
  rationale: string;
  status: string;
  createdAt: string;
}

export async function loadSuggestions(
  clientId: string,
  periodStart: string,
  periodEnd: string,
): Promise<SuggestionRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("ai_suggestions")
    .select("id, target_key, suggested_value, rationale, status, created_at")
    .eq("client_id", clientId)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .order("created_at", { ascending: false });

  return (data ?? []).map((s) => ({
    id: s.id,
    targetKey: s.target_key,
    suggestedValue: s.suggested_value === null ? null : Number(s.suggested_value),
    rationale: s.rationale,
    status: s.status,
    createdAt: s.created_at,
  }));
}
