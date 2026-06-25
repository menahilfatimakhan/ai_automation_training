"use client";

import { useActionState } from "react";
import { signIn, type AuthState } from "@/app/auth/actions";

const initial: AuthState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initial);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
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

        <p className="mt-4 text-center text-xs text-ink-faint">
          Demo · admin@newszn.test · Password123!
        </p>
      </div>
    </main>
  );
}
