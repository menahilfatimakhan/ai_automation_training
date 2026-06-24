# NEW SZN — Agency Performance Dashboard

Multi-tenant analytics + workflow app for a digital marketing agency. Tracks
sales calls, appointment-setting, and paid-ad performance; computes KPIs vs.
monthly goals; manages leads/follow-ups; layers advisory AI coaching on top.

## Roles
- **Admin** — all clients, all data, settings. Modeled as a global
  `users.is_admin` flag (agency-wide admin).
- **Closer** — own sales activity only.
- **Setter** — own outreach activity only.
- **Client** — read-only, own `client_id` only.

## Stack (use exactly this — do not substitute)
Next.js (App Router) + TypeScript + Tailwind · Supabase (Postgres, Auth, RLS) ·
Drizzle ORM with SQL migrations · Recharts · Anthropic API · Vitest.
All secrets come from env (`.env.local`); never hardcode; keep `.env.example`
current.

## Non-negotiable invariants
1. **Multi-tenant isolation is requirement #1.** Every domain table has
   `client_id`. Enforce with Postgres **RLS**, not just app code. Admin sees
   all; Closer/Setter see only their own rows; Client sees only its `client_id`.
   There MUST be a test that attempts a cross-client read and asserts it fails.
2. **Manual-override + AI-suggestion pattern for every derived value.** Each KPI/
   goal/threshold has: (a) a computed value, always recalculated, never
   destroyed; (b) an optional manual override stored as a SEPARATE record with
   who/when/prior-value — overrides win at read time, never overwrite raw data;
   (c) AI suggestions in their own table with status
   (pending/accepted/dismissed), advisory only. Accepting a suggestion creates a
   manual override tagged with its provenance.
3. **AI never computes authoritative numbers.** Metrics are computed in
   TypeScript and passed into prompts; the model only explains and suggests.

## External edges = ports & adapters (key architecture)
The app NEVER calls an external service directly. Define provider interfaces
("ports"); inject implementations selected by env. Build mocks now; leave real
ones as throwing skeletons with TODOs. Going live later must be a checklist, not
a refactor.

- **AdProvider** — `listCampaigns(conn)`, `getDailyMetrics(conn, range)`.
  - `MockAdProvider` reads committed fixtures.
  - `MetaAdProvider` is a skeleton: same signatures, bodies throw
    "not implemented", TODOs mark exactly where the Graph API call, API version,
    and access token go. Do NOT call Meta.
  - Select via `AD_PROVIDER=mock|meta`.
- **Normalization layer** (`mapProviderCampaign` / `mapProviderMetricRow`) is the
  ONLY place provider-specific field names appear. Provider response formats must
  never leak past this layer.
- **`syncAdData(clientId)`** — shared by all providers: pull via injected
  provider → normalize → idempotent upsert (unique key
  `(client_id, campaign_id, date)`) → return summary. Mock and Meta run identical
  sync code.
- **`ad_connections`** (`client_id`, `ad_account_id`, `access_token_ref`,
  `last_synced_at`). Token stored as a secret REFERENCE (resolved via
  `SecretStore` port), never plaintext. Enforce a **15-minute manual-sync
  cooldown** via `last_synced_at`.
- Dashboards & KPI engine read ONLY from our normalized DB tables, never a
  provider. UI is 100% decoupled from Meta.
- Same port pattern for **FxProvider** (currency; `MockFxProvider` static rates),
  **Notifier** (in-app/console now; Slack/email later), and **SecretStore**
  (env-backed now; Supabase Vault later).
- Keep `docs/INTEGRATIONS.md` as the short, accurate go-live checklist for Meta.

## Data model
`clients`; `users` (+ `is_admin`) + `memberships` (user↔client + role); `calls`
(date, outcome [closed/rescheduled/lost/no_show], revenue, cash_collected,
closer, lead_source, objection_reason, notes, tags, currency); `leads`/
`follow_ups` (tags, owner, reassignment); `setter_daily_activity` (conversations,
replies, proposals, calls_booked, follow_ups); `goals` (monthly revenue + call
goals per client, override support); `ad_connections`; `ad_campaigns` +
`ad_daily_metrics` (spend, impressions, reach, results, ctr, status, category,
flags, currency); `kpi_values` (computed + override); `ai_suggestions`;
`fx_rates`. **Add a `currency` field everywhere money is stored.**

## Migrations
One consistent approach: Drizzle owns table schema; RLS policies live in
hand-written SQL migrations in the same ordered `drizzle/` folder, applied in
sequence. Seed is idempotent.

## How to work
- Plan first, wait for approval, then build in the documented step order.
- **Commit after each step.**
- If a requirement is ambiguous, state the assumption and proceed.
- Required tests: RLS cross-client isolation; KPI math; ad-sync idempotency
  (running sync twice does not duplicate rows); provider swap changes only the
  injected implementation.
- The KPI engine is pure and currency-aware (via FxProvider). UI reads normalized
  DB only.

## Build order (commit after each)
1. Scaffold + env + Supabase clients + define ports/interfaces
2. Schema + migrations + seed
3. Auth + RLS + isolation tests
4. Metrics engine + tests
5. External-edge adapters + `syncAdData` (idempotency + cooldown)
6. Dashboards
7. Lead tagging + call logs
8. AI endpoints
9. Admin settings

## Commands
- `npm run dev` — local dev
- `npm run test` — Vitest
- `npm run db:generate` / `db:migrate` — Drizzle migrations
- `npm run db:seed` — seed clients/users/sample data

## Env (see `.env.example`)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` (server only), `DATABASE_URL`, `ANTHROPIC_API_KEY`,
`AD_PROVIDER=mock|meta`, `FX_PROVIDER=mock`, `NOTIFIER=db|console`,
`AI_PROVIDER=mock|anthropic`.

## Deferred (leave seams/TODOs, don't build)
Real Meta/Slack/email calls, cron/scheduling, anomaly detection, scheduled PDF
reports, streak/milestone messages. These slot in behind existing ports with no
UI changes.
