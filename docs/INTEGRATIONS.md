# Integrations — going live with real providers

The app talks to external services only through **ports** (provider interfaces)
selected at the composition root (`src/providers/registry.ts`). Today every port
runs a mock. Switching to a real provider is a short checklist, not a refactor:
`syncAdData`, the normalization layer, the DB, and the entire UI stay unchanged.

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

`MockFxProvider` uses static USD-based rates. To use a live feed, implement a
new `FxProvider` (e.g. an ECB/openexchange adapter) and select it in the
registry. The KPI engine is unchanged.

## Notifications — `NOTIFIER`

`ConsoleNotifier` writes to the console + an in-app inbox. To deliver via Slack
or email, implement a `Notifier` and select it in the registry. AI panels and
endpoints call `notifier.notify(...)` regardless — no UI changes.

## Secrets — `SecretStore`

`EnvSecretStore` resolves a ref to an env var. Swap in Supabase Vault / a cloud
secrets manager by implementing `SecretStore.resolve`/`store` and selecting it
in the registry. `ad_connections` already stores only the reference.
