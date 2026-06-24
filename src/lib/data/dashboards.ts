import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AdMetricRecord,
  CallRecord,
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
  date: string;
  outcome: CallRecord["outcome"];
  revenue: number;
  cashCollected: number;
  currency: string;
  leadSource: string | null;
  objectionReason: string | null;
  notes: string | null;
  tags: string[];
}

export async function loadCalls(
  clientId: string,
  fromIso: string,
  toIso: string,
): Promise<CallRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("calls")
    .select(
      "id, client_id, closer_user_id, date, outcome, revenue, cash_collected, currency, lead_source, objection_reason, notes, tags",
    )
    .eq("client_id", clientId)
    .gte("date", fromIso)
    .lte("date", toIso)
    .order("date", { ascending: false });

  return (data ?? []).map((c) => ({
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
}

export function toCallRecords(rows: CallRow[]): CallRecord[] {
  return rows.map((r) => ({
    outcome: r.outcome,
    revenue: r.revenue,
    cashCollected: r.cashCollected,
    currency: r.currency,
    date: r.date,
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
  impressions: number;
  reach: number;
  ctr: number;
  status: string;
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
      "campaign_id, date, spend, impressions, reach, results, ctr, status, category, currency",
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
    status: r.status,
    category: r.category,
    currency: r.currency,
  }));
}

export interface CampaignRow {
  campaignId: string;
  name: string;
  status: string;
  category: string | null;
  currency: string;
}

export async function loadCampaigns(clientId: string): Promise<CampaignRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("ad_campaigns")
    .select("campaign_id, name, status, category, currency")
    .eq("client_id", clientId)
    .order("name");
  return (data ?? []).map((r) => ({
    campaignId: r.campaign_id,
    name: r.name,
    status: r.status,
    category: r.category,
    currency: r.currency,
  }));
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
