# Integrations — going live with real providers

The app talks to external services only through **ports** (provider interfaces)
selected at the composition root (`src/providers/registry.ts`). Meta ads, FX
rates, Slack, and email all have real implementations now (see below);
SecretStore still runs env-backed only. Switching any remaining port to a
different real provider is a short checklist, not a refactor: `syncAdData`,
the normalization layer, the DB, and the entire UI stay unchanged.

## Meta (Facebook) Ads — `AD_PROVIDER=meta`

`MetaAdProvider` (`src/providers/ad/meta-ad-provider.ts`) is **implemented** — it
calls the real Graph Marketing API (`/{adAccount}/campaigns` and
`/{adAccount}/insights`), paginates, and returns raw Graph payloads.
`src/providers/ad/normalize.ts` is the single mapping site, so syncAdData, the
DB, and the UI are unchanged whether mock or Meta runs.

### On Meta's side (one-time)
1. **Set up billing** on your ad account (Business Settings → Payment methods).
2. **Have an ad account** (Business Settings → Accounts → Ad accounts). Note its
   id in `act_<number>` form.
3. **Create a campaign → ad set → ad** and **run it** with real budget. The API
   only returns spend/impressions/results once ads have actually delivered.
4. **Register as a Meta developer** and **create an App** at
   developers.facebook.com → add the **Marketing API** product.
5. **Generate an access token with `ads_read`** (Graph API Explorer for testing,
   or a long-lived / System User token for anything persistent).
6. **Verify** in Graph API Explorer:
   `GET /v21.0/act_<id>/campaigns?fields=id,name,effective_status` returns JSON.

### In the app
7. **Pin the API version** (optional): `META_GRAPH_API_VERSION=v21.0` in `.env.local`.
8. **Store the token as a secret reference, never plaintext.** With the env-backed
   `EnvSecretStore`, put the token in an env var and use its name as the ref —
   e.g. `META_TOKEN_ACME=<token>` and `access_token_ref = env:META_TOKEN_ACME`.
   (Swap a Vault-backed `SecretStore` for production — no other code changes.)
9. **Connect the account**: Admin → Settings → "Connect ad account" writes
   `ad_connections (client_id, ad_account_id=act_<id>, access_token_ref)`.
10. **Set `AD_PROVIDER=meta`** and restart.
11. **Sync**: the Ads dashboard "Sync now" runs the same pull → normalize →
    idempotent upsert pipeline (15-min cooldown, `(client_id, campaign_id, date)`
    unique key). Real campaign data appears on the dashboard.

No dashboard, KPI, or schema changes — only env + the `ad_connections` row.

## FX rates — `FX_PROVIDER`

`LiveFxProvider` (`src/providers/fx/live-fx-provider.ts`) is **implemented and
the `.env.example` default** (`FX_PROVIDER=live`) — it calls the free
Frankfurter/ECB API (`https://api.frankfurter.dev`, no key required), caches
each rate for 12 hours, and falls back to `MockFxProvider`'s static rates if
the live call fails, so an outage never breaks KPI math. `MockFxProvider`
remains available via `FX_PROVIDER=mock` for hermetic tests/offline dev. The
KPI engine is unchanged either way.

## Notifications — `NOTIFIER`

Three `Notifier` implementations exist: `ConsoleNotifier` (console + in-app
inbox), `DbNotifier` (durable in-app only, the `.env.example` default), and
`SlackNotifier` (`src/providers/notifier/slack-notifier.ts`, **implemented** —
real `chat.postMessage` calls). `SlackNotifier` always writes to the in-app
table first (composes `DbNotifier`), then best-effort posts to Slack — a
missing channel, disabled toggle, or Slack API failure never blocks the
in-app notification.

### Going live
1. Create a Slack app at api.slack.com/apps, add the **`chat:write`** bot
   scope, install it to your workspace, copy the **Bot User OAuth Token**
   (`xoxb-...`).
2. `SLACK_BOT_TOKEN=xoxb-...` in `.env.local`, `NOTIFIER=slack`.
3. Invite the bot to the channel you want each client's messages in, then set
   that channel's ID and toggle message types per client in
   **Admin → Slack & notification settings** (writes `client_settings`).

No dashboard, KPI, or schema changes — every existing `notifier.notify(...)`
call site is unchanged; this only swaps which channel actually delivers.

## Email — `EMAIL_PROVIDER`

Account invites and password-reset links only (never KPI/report messages —
those stay on the Notifier/Slack port). `ConsoleEmailProvider` logs to the
console (default); `ResendEmailProvider` (`src/providers/email/resend-email-provider.ts`)
is **implemented** — a plain `fetch` call to the Resend HTTP API, no SDK
dependency (same pattern as `MetaAdProvider`/`LiveFxProvider`).

### Going live
1. Create a Resend account, verify a sending domain (or use their shared
   `onboarding@resend.dev` for testing), copy an API key.
2. `EMAIL_PROVIDER=resend`, `RESEND_API_KEY=re_...`, `EMAIL_FROM="Name <you@yourdomain.com>"`.
3. Admin → "Invite a user" and the login page's "Forgot password?" both
   already call `getProviders().email.send(...)` — no other code changes.

## Secrets — `SecretStore`

`EnvSecretStore` resolves a ref to an env var. Swap in Supabase Vault / a cloud
secrets manager by implementing `SecretStore.resolve`/`store` and selecting it
in the registry. `ad_connections` already stores only the reference.
