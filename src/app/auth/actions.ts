"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getSessionContext } from "@/lib/auth";
import { landingRoute } from "@/lib/access";
import { getProviders } from "@/providers/registry";

export interface AuthState {
  error?: string;
  message?: string;
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  const ctx = await getSessionContext();
  redirect(ctx ? landingRoute(ctx) : "/dashboard");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Password reset — generates a recovery link via the Supabase Admin API and
 * emails it through our EmailProvider port (never Supabase's own SMTP), so
 * delivery stays swappable behind the same port as everything else.
 */
export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Email is required" };

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
  });
  // Don't reveal whether the email exists — always show the same message.
  if (!error && data?.properties?.action_link) {
    try {
      const { email: emailProvider } = getProviders();
      await emailProvider.send({
        to: email,
        subject: "Reset your NEW SZN password",
        text: `Click the link below to reset your password:\n\n${data.properties.action_link}\n\nIf you didn't request this, you can ignore this email.`,
      });
    } catch (err) {
      console.error("password reset email failed:", err);
    }
  }
  return { message: "If that email has an account, a reset link is on its way." };
}
