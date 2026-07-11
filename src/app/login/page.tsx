"use client";

import { useActionState, useState } from "react";
import { signIn, requestPasswordReset, type AuthState } from "@/app/auth/actions";

const initial: AuthState = {};

const DEMO_PASSWORD = "Password123!";
const DEMO_ACCOUNTS: { role: string; email: string; note: string }[] = [
  { role: "Admin", email: "admin@newszn.test", note: "All clients" },
  { role: "Closer", email: "closer.acme@newszn.test", note: "Own sales calls" },
  { role: "Setter", email: "setter.acme@newszn.test", note: "Own outreach" },
  { role: "Client", email: "client.acme@newszn.test", note: "Read-only" },
];

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initial);
  const [resetState, resetAction, resetPending] = useActionState(requestPasswordReset, initial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showReset, setShowReset] = useState(false);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="enter w-full max-w-sm">
        <div className="group mb-8 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-base font-bold text-white transition-transform duration-300 group-hover:rotate-[8deg] group-hover:scale-105">
            N
          </span>
          <div>
            <div className="text-[15px] font-semibold tracking-tight">NEW SZN</div>
            <div className="text-xs text-ink-faint">Agency Performance Dashboard</div>
          </div>
        </div>

        <div className="card p-6">
          <h1 className="text-lg font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-ink-soft">Sign in to continue.</p>

          <form action={formAction} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-xs text-ink-soft">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@agency.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-xs text-ink-soft">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
              />
            </div>

            {state.error && (
              <p
                className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 px-3 py-2 text-sm text-accent-rose"
                role="alert"
              >
                {state.error}
              </p>
            )}

            <button type="submit" disabled={pending} className="btn-primary w-full">
              {pending ? "Signing in…" : "Sign in"}
            </button>

            <button
              type="button"
              onClick={() => setShowReset((v) => !v)}
              className="w-full text-center text-xs text-ink-faint hover:text-ink"
            >
              Forgot password?
            </button>
          </form>

          {showReset && (
            <form action={resetAction} className="enter mt-4 space-y-2 border-t border-line pt-4">
              <label htmlFor="reset-email" className="mb-1 block text-xs text-ink-soft">
                Enter your email and we&apos;ll send a reset link
              </label>
              <input
                id="reset-email"
                name="email"
                type="email"
                required
                className="input"
                placeholder="you@agency.com"
              />
              {resetState.message && (
                <p className="text-xs text-accent-green">{resetState.message}</p>
              )}
              <button type="submit" disabled={resetPending} className="btn-ghost w-full">
                {resetPending ? "Sending…" : "Send reset link"}
              </button>
            </form>
          )}
        </div>

        {/* Demo quick-login — click a role to fill the form */}
        <div className="card enter mt-4 p-4" style={{ "--stagger": 2 } as React.CSSProperties}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-ink-soft">Demo accounts</span>
            <span className="chip">password: {DEMO_PASSWORD}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => {
                  setEmail(a.email);
                  setPassword(DEMO_PASSWORD);
                }}
                className="rounded-lg border border-line bg-surface-sunken px-3 py-2 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-pop active:translate-y-0 active:scale-[0.98]"
              >
                <div className="text-sm font-medium">{a.role}</div>
                <div className="text-[11px] text-ink-faint">{a.note}</div>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-ink-faint">
            Click a role to fill the form, then press Sign in. Also available for
            <code className="mx-1">globex</code>/<code>initech</code> clients.
          </p>
        </div>
      </div>
    </main>
  );
}
