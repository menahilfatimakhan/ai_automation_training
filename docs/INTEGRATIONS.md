# Integrations — going live with real providers

The app talks to external services only through **ports** (provider interfaces)
selected at the composition root (`src/providers/registry.ts`). Today every port
runs a mock. Switching to a real provider is a short checklist, not a refactor:
`syncAdData`, the normalization layer, the DB, and the entire UI stay unchanged.

## Meta (Facebook) Ads — `AD_PROVIDER=meta`

Everything downstream already understands Meta's Graph response shape (the mock
emits the same shape, and `src/providers/ad/normalize.ts` is the single mapping
site). To go live:

1. **Implement `MetaAdProvider`** in `src/providers/ad/meta-ad-provider.ts`.
   Fill the two TODO blocks (`listCampaigns`, `getDailyMetrics`):
   - `listCampaigns`: `GET /{apiVersion}/{adAccountId}/campaigns?fields=id,name,effective_status,objective,account_currency`, paginate `paging.next`, return raw `data[]`.
   - `getDailyMetrics`: `GET /{apiVersion}/{adAccountId}/insights?level=campaign&time_increment=1&fields=campaign_id,spend,impressions,reach,ctr,actions&time_range={since,until}`, paginate, return raw `data[]`.
   - Do **not** remap fields in the provider — normalization is the only place
     provider field names may appear.
2. **Pin the Graph API version.** Set `META_GRAPH_API_VERSION` (e.g. `v21.0`) in
   `.env.local`. `MetaAdProvider` reads it; no code change to bump it later.
3. **Set `AD_PROVIDER=meta`** in `.env.local` (or per environment).
4. **Populate `ad_connections` per client.** Each tenant connects its own ad
   account via Admin → Settings → "Connect ad account", which writes
   `ad_connections (client_id, ad_account_id, access_token_ref)`.
5. **Store the access token as a secret reference, never plaintext.**
   - MVP: `EnvSecretStore` — set the token in an env var and store its name as
     `access_token_ref` (e.g. `env:META_TOKEN_ACME`).
   - Production: implement a Vault-backed `SecretStore` and select it in the
     registry. No other code changes.
6. **Sync.** The Ads dashboard "Sync now" button (or a future scheduled job)
   calls `syncAdData` → the same pull → normalize → idempotent upsert pipeline.
   The 15-minute cooldown (`SYNC_COOLDOWN_MS`) and the
   `(client_id, campaign_id, date)` unique key apply identically to Meta.

That's it — no dashboard, KPI, or schema changes.

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
