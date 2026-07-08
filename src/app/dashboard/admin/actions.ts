"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getSessionContext } from "@/lib/auth";
import { getProviders } from "@/providers/registry";

async function requireAdmin() {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error("Not authenticated");
  if (!ctx.isAdmin) throw new Error("Admin only");
  return ctx;
}

/**
 * Invite a new user: creates the Supabase auth account (unconfirmed, no
 * password set), mirrors it into public.users, and emails an invite link via
 * our EmailProvider port (never Supabase's own SMTP).
 */
export async function inviteUser(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim() || null;
  const isAdminFlag = formData.get("isAdmin") === "on";
  if (!email) throw new Error("Email is required");

  const service = createSupabaseServiceClient();
  const { data, error } = await service.auth.admin.generateLink({
    type: "invite",
    email,
  });
  if (error) throw new Error(error.message);

  const userId = data.user?.id;
  if (userId) {
    const db = await createSupabaseServerClient();
    await db.from("users").upsert(
      { id: userId, email, full_name: fullName, is_admin: isAdminFlag },
      { onConflict: "id" },
    );
  }

  if (data.properties?.action_link) {
    try {
      const { email: emailProvider } = getProviders();
      await emailProvider.send({
        to: email,
        subject: "You're invited to NEW SZN",
        text: `You've been invited to the NEW SZN agency dashboard. Set up your account:\n\n${data.properties.action_link}`,
      });
    } catch (err) {
      console.error("invite email failed:", err);
    }
  }

  revalidatePath("/dashboard/admin");
}

/** Set the monthly revenue + call goals for a client (upsert on client+month). */
export async function setMonthlyGoal(formData: FormData) {
  const ctx = await requireAdmin();
  const clientId = String(formData.get("clientId"));
  const month = String(formData.get("month")); // YYYY-MM-01
  const revenueGoal = Number(formData.get("revenueGoal") ?? 0) || 0;
  const callsGoal = Number(formData.get("callsGoal") ?? 0) || 0;
  const currency = String(formData.get("currency") || "USD");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("goals").upsert(
    {
      client_id: clientId,
      month,
      revenue_goal: String(revenueGoal),
      calls_goal: callsGoal,
      currency,
      updated_by: ctx.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id,month" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/master");
}

/** Assign a user to a client with a role (upsert on user+client). */
export async function assignMembership(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId"));
  const clientId = String(formData.get("clientId"));
  const role = String(formData.get("role"));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("memberships")
    .upsert(
      { user_id: userId, client_id: clientId, role },
      { onConflict: "user_id,client_id" },
    );
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin");
}

export async function removeMembership(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("memberships").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin");
}

/**
 * Connect an ad account (UI only — writes ad_connections; no real Meta call).
 * The token is stored as a secret REFERENCE, never plaintext.
 */
export async function connectAdAccount(formData: FormData) {
  await requireAdmin();
  const clientId = String(formData.get("clientId"));
  const adAccountId = String(formData.get("adAccountId"));
  const accessTokenRef = String(formData.get("accessTokenRef") || "") || null;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("ad_connections").upsert(
    {
      client_id: clientId,
      ad_account_id: adAccountId,
      access_token_ref: accessTokenRef,
    },
    { onConflict: "client_id,ad_account_id" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/ads");
}

/** Update Slack/notification delivery preferences for a client (upsert). */
export async function updateClientSettings(formData: FormData) {
  await requireAdmin();
  const clientId = String(formData.get("clientId"));
  const checkbox = (name: string) => formData.get(name) === "on";

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("client_settings").upsert(
    {
      client_id: clientId,
      slack_channel_id: (formData.get("slackChannelId") as string) || null,
      slack_enabled: checkbox("slackEnabled"),
      notify_daily_targets: checkbox("notifyDailyTargets"),
      notify_eod_report: checkbox("notifyEodReport"),
      notify_weekly_report: checkbox("notifyWeeklyReport"),
      notify_monthly_report: checkbox("notifyMonthlyReport"),
      notify_loss_debrief: checkbox("notifyLossDebrief"),
      notify_anomaly_alerts: checkbox("notifyAnomalyAlerts"),
      notify_shame_fame: checkbox("notifyShameFame"),
      notify_streaks: checkbox("notifyStreaks"),
      notify_big_deals: checkbox("notifyBigDeals"),
      timezone: String(formData.get("timezone") || "UTC"),
      daily_target_hour: Number(formData.get("dailyTargetHour") ?? 8) || 8,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin");
}

/** Set the AI coaching persona for one dashboard of a client (upsert). */
export async function updateAiPersona(formData: FormData) {
  await requireAdmin();
  const clientId = String(formData.get("clientId"));
  const dashboard = String(formData.get("dashboard"));
  const persona = String(formData.get("persona") || "").trim();

  const supabase = await createSupabaseServerClient();
  if (!persona) {
    const { error } = await supabase
      .from("ai_personas")
      .delete()
      .eq("client_id", clientId)
      .eq("dashboard", dashboard);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("ai_personas").upsert(
      { client_id: clientId, dashboard, persona, updated_at: new Date().toISOString() },
      { onConflict: "client_id,dashboard" },
    );
    if (error) throw new Error(error.message);
  }
  revalidatePath("/dashboard/admin");
}

/** Set (or clear) a warning/critical threshold for a KPI metric. */
export async function setAlertThreshold(formData: FormData) {
  await requireAdmin();
  const clientId = String(formData.get("clientId"));
  const metricKey = String(formData.get("metricKey"));
  const warnRaw = formData.get("warnBelow");
  const criticalRaw = formData.get("criticalBelow");
  const warnBelow = warnRaw === "" || warnRaw === null ? null : String(Number(warnRaw));
  const criticalBelow = criticalRaw === "" || criticalRaw === null ? null : String(Number(criticalRaw));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("alert_thresholds").upsert(
    {
      client_id: clientId,
      metric_key: metricKey,
      warn_below: warnBelow,
      critical_below: criticalBelow,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id,metric_key" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin");
}

export async function deleteAlertThreshold(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("alert_thresholds").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin");
}
