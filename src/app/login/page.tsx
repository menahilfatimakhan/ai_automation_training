"use client";

import { useActionState, useState } from "react";
import { signIn, type AuthState } from "@/app/auth/actions";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-base font-bold text-white">
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
          </form>
        </div>

        {/* Demo quick-login — click a role to fill the form */}
        <div className="card mt-4 p-4">
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
                className="rounded-lg border border-line bg-surface-sunken px-3 py-2 text-left transition-colors hover:border-brand/50"
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
