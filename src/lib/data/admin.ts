import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Admin-scoped loaders. The admin RLS policies grant full visibility. */

export interface AdminClient {
  id: string;
  name: string;
  reportingCurrency: string;
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string | null;
  isAdmin: boolean;
}

export interface AdminMembership {
  id: string;
  userId: string;
  clientId: string;
  role: string;
}

export interface AdminAdConnection {
  clientId: string;
  adAccountId: string;
  accessTokenRef: string | null;
  lastSyncedAt: string | null;
}

export interface AdminClientSettings {
  clientId: string;
  slackChannelId: string | null;
  slackEnabled: boolean;
  notifyDailyTargets: boolean;
  notifyEodReport: boolean;
  notifyWeeklyReport: boolean;
  notifyMonthlyReport: boolean;
  notifyLossDebrief: boolean;
  notifyAnomalyAlerts: boolean;
  notifyShameFame: boolean;
  notifyStreaks: boolean;
  notifyBigDeals: boolean;
  timezone: string;
  dailyTargetHour: number;
}

export type DashboardKey = "master" | "sales" | "ads" | "setter";

export interface AdminAiPersona {
  clientId: string;
  dashboard: DashboardKey;
  persona: string;
}

export interface AdminAlertThreshold {
  id: string;
  clientId: string;
  metricKey: string;
  warnBelow: number | null;
  criticalBelow: number | null;
}

export async function loadAdminData() {
  const supabase = await createSupabaseServerClient();
  const [clients, users, memberships, goals, connections, settings, personas, thresholds] =
    await Promise.all([
      supabase.from("clients").select("id, name, reporting_currency").order("name"),
      supabase.from("users").select("id, email, full_name, is_admin").order("email"),
      supabase.from("memberships").select("id, user_id, client_id, role"),
      supabase.from("goals").select("client_id, month, revenue_goal, calls_goal, currency"),
      supabase.from("ad_connections").select("client_id, ad_account_id, access_token_ref, last_synced_at"),
      supabase.from("client_settings").select("*"),
      supabase.from("ai_personas").select("client_id, dashboard, persona"),
      supabase.from("alert_thresholds").select("id, client_id, metric_key, warn_below, critical_below"),
    ]);

  return {
    clients: (clients.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      reportingCurrency: c.reporting_currency,
    })) as AdminClient[],
    users: (users.data ?? []).map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.full_name,
      isAdmin: u.is_admin,
    })) as AdminUser[],
    memberships: (memberships.data ?? []).map((m) => ({
      id: m.id,
      userId: m.user_id,
      clientId: m.client_id,
      role: m.role,
    })) as AdminMembership[],
    goals: goals.data ?? [],
    connections: (connections.data ?? []).map((a) => ({
      clientId: a.client_id,
      adAccountId: a.ad_account_id,
      accessTokenRef: a.access_token_ref,
      lastSyncedAt: a.last_synced_at,
    })) as AdminAdConnection[],
    settings: (settings.data ?? []).map((s) => ({
      clientId: s.client_id,
      slackChannelId: s.slack_channel_id,
      slackEnabled: s.slack_enabled,
      notifyDailyTargets: s.notify_daily_targets,
      notifyEodReport: s.notify_eod_report,
      notifyWeeklyReport: s.notify_weekly_report,
      notifyMonthlyReport: s.notify_monthly_report,
      notifyLossDebrief: s.notify_loss_debrief,
      notifyAnomalyAlerts: s.notify_anomaly_alerts,
      notifyShameFame: s.notify_shame_fame,
      notifyStreaks: s.notify_streaks,
      notifyBigDeals: s.notify_big_deals,
      timezone: s.timezone,
      dailyTargetHour: s.daily_target_hour,
    })) as AdminClientSettings[],
    personas: (personas.data ?? []).map((p) => ({
      clientId: p.client_id,
      dashboard: p.dashboard,
      persona: p.persona,
    })) as AdminAiPersona[],
    thresholds: (thresholds.data ?? []).map((t) => ({
      id: t.id,
      clientId: t.client_id,
      metricKey: t.metric_key,
      warnBelow: t.warn_below === null ? null : Number(t.warn_below),
      criticalBelow: t.critical_below === null ? null : Number(t.critical_below),
    })) as AdminAlertThreshold[],
  };
}
