# Gap Analysis — Scope vs. Implementation

Audited against `NEW_SZN_Project_Scope.pdf` (stakeholder scope doc) and
`CLAUDE.md`. Status legend: **DONE** (implemented and wired to real data),
**PARTIAL** (some UI/scaffold exists but incomplete or using placeholder
logic), **MISSING** (no trace found in the codebase).

Every row cites the file(s) that were actually read to determine status —
these are pointers back into the running code, not into this document.

---

## Master Dashboard

| # | Feature | Status | Evidence |
|---|---|---|---|
| 1 | 12 KPI cards (revenue, cash collected, calls booked, close rate, avg deal size, no-shows, ROAS, cost per follower, ad spend, etc.) | **PARTIAL** | Only 9 cards are defined: `src/lib/data/master.ts:45-55` `CARD_DEFS` = revenue, closeRate, cashCollected, totalCalls, avgDealSize, noShowRate, roas, adSpend, costPerCall. Cost-per-follower, cost-per-conversation, cost-per-customer are entirely absent from the Master card set. |
| 2 | Monthly goal progress bars, green/amber/red | **PARTIAL** | Bars render (`src/components/KpiCard.tsx:77-91`) but the fill color is always `bg-brand` regardless of progress %; only the percentage *text* color switches (`progress >= 100 ? "text-brand" : "text-ink-soft"`, line 81). No amber/red threshold classes exist anywhere in the component. |
| 3 | Daily trend arrows (today vs. yesterday) | **MISSING** | No day-over-day comparison exists anywhere in `master.ts` or `KpiCard.tsx`. Only month-to-date sparklines exist. |
| 4 | Top performers leaderboard | **MISSING** | No leaderboard query, type, or UI component found anywhere in `src/`. |
| 5 | Setter activity summary (admin view) | **MISSING** | `master.ts:78-93` loads `setterRows` via `loadSetterActivity`, but only to compute one aggregate (`callsBooked`) fed into ad-KPI attribution. `src/app/dashboard/master/page.tsx` has no setter-summary section; that data only surfaces on the separate Setter dashboard. |
| 6 | Interactive revenue and deal trend charts | **DONE** | `src/app/dashboard/master/page.tsx:82-104` renders `DealsRevenueChart` and `DualAreaChart` (Recharts, tooltips/legends), backed by `loadClosedDealsTrend` and `computeMasterView`. |

## Sales & Closing Dashboard

| # | Feature | Status | Evidence |
|---|---|---|
| 7 | Today's call log — outcome, revenue, who closed it | **PARTIAL** | Table shows Outcome/Revenue/Cash/Source/Tags (`src/app/dashboard/sales/page.tsx:141-168`); `CallRow.closerUserId` is loaded (`src/lib/data/dashboards.ts:19`) but never rendered as a column. |
| 8 | Click a call → full notes, objection reason, contact info | **MISSING** | `objectionReason`/`notes` are captured on write (`src/components/LogCallForm.tsx:60-75`) but the Today's Calls table has no click handler, expandable row, or modal to read them back. There is also no contact-info field (name/phone/email) anywhere on the `calls` table. |
| 9 | Pie chart of outcomes | **DONE** | `sales/page.tsx:106-112` + `OutcomePie` (`src/components/charts.tsx:102-127`), driven by real `outcomeCounts`. |
| 10 | Daily revenue trend chart | **PARTIAL** | The Sales page instead shows a conversion funnel + "revenue by lead source" bar chart (`sales/page.tsx:115-128`). The literal daily-revenue-trend chart (`DualAreaChart`) lives on the Master dashboard, not here. |
| 11 | "Log Call" form for closers | **DONE** | `src/components/LogCallForm.tsx` (outcome, date, revenue, cash, lead source, conditional objection field, tags, notes) wired to the `logCall` server action. |
| 12 | Dashboard locked/blurred until first call of the day | **DONE** | `sales/page.tsx:44-48`: `gated = isCloser && !isAdmin && todaysCalls.length === 0`, applied via `blur-sm pointer-events-none select-none` to pie/funnel/table, with an unlock banner. Confirmed this is the correct dashboard per scope. |

## Ads Dashboard

| # | Feature | Status | Evidence |
|---|---|---|
| 13 | 12 ad metrics | **PARTIAL / MISSING** | `AdCampaignTable.tsx:25-34` and `src/domain/ad.ts:24-33` expose only spend, impressions, reach, results, CTR (~5 metrics). No CPM, CPC, frequency, cost-per-follower, cost-per-conversation, cost-per-customer at the ad level. |
| 14 | Full campaign table, sortable/filterable, hideable columns | **DONE** | `AdCampaignTable.tsx:38-59,84-97,99-116` — sort-by-column, status filter, column-visibility checkboxes. |
| 15 | Filter by status (Active/Paused/Archived) | **DONE** | `AdCampaignTable.tsx:43-46,86-96`; `StatusBadge` (`src/components/badges.tsx:15-25`) covers active/paused/archived/deleted. |
| 16 | Categorize ads as "Typeform-focused" or "Normal" | **MISSING** | `category` (`src/domain/ad.ts:18`) is a free-form provider-objective string (e.g. `"OUTCOME_LEADS"`), not a Typeform/Normal enum. No UI control, no seed reference to "Typeform" anywhere. |
| 17 | Flag problematic ads for review with a reason | **MISSING** | No `flagged`/`review_reason` column on `ad_campaigns`/`ad_daily_metrics`, no UI action. |
| 18 | Daily spend trend chart | **DONE** | `src/app/dashboard/ads/page.tsx:87-94,126-130` — `SeriesBarChart` fed by `spendTrend`. |
| 19 | Manual sync button, 15-minute cooldown | **DONE** | `src/components/SyncButton.tsx` + `src/app/dashboard/ads/actions.ts:19-51`; cooldown enforced server-side in `src/lib/ad-sync/sync.ts:54-58` / `types.ts:36` (`SYNC_COOLDOWN_MS = 15 * 60 * 1000`). |
| 20 | AI-written summary of campaign performance after each sync | **MISSING** | `syncNow` (`ads/actions.ts:19-51`) only calls `runSync` and returns a plain row-count message. It never calls `generateDashboardInsights`/AI. AI insight generation only exists as a manual button on the Master dashboard's `AiPanel`, fully decoupled from the sync action. |

## Setter Dashboard

| # | Feature | Status | Evidence |
|---|---|---|
| 21 | 8 metrics | **PARTIAL** | Only 7 cards render — Conversations, Replies, Proposals, Calls Booked, Reply Rate, Proposal Rate, Booking Rate (`src/app/dashboard/setter/page.tsx:36-44`). `computeSetterKpis` also returns `followUps` (`src/lib/kpi/engine.ts:129-138`) but it's excluded from the `cards` array — only visible in the recent-days table. |
| 22 | Daily activity log (editable) | **DONE** | `setter/page.tsx:101-129`; idempotent upsert keyed on `(client_id, setter_user_id, date)` (`src/app/dashboard/setter/actions.ts:20-35`) so re-logging a date edits it. |
| 23 | Booking trend chart | **DONE** | `setter/page.tsx:79-84`, `SeriesBarChart` over `trend.callsBooked`. |
| 24 | 30-day heatmap | **MISSING** | No heatmap/calendar component anywhere in the codebase. |
| 25 | Mini trend lines on each metric card | **MISSING** | Setter cards (`setter/page.tsx:61-71`) are plain `<div>`s with label+value; they don't reuse `KpiCard`/`Sparkline` the way Master's cards do. |
| 26 | "Log Day" form | **DONE** | `src/components/LogDayForm.tsx`, backed by `logSetterDay` (`setter/actions.ts:12-38`). |

## Settings (Admin Only)

| # | Feature | Status | Evidence |
|---|---|---|
| 27 | Set monthly revenue/call goals per client | **DONE** | `src/app/dashboard/admin/page.tsx:37-80`, `setMonthlyGoal` (`admin/actions.ts:14-39`) upserts `goals` on `(client_id, month)`. |
| 28 | Connect Facebook/Instagram ad accounts | **PARTIAL** | UI + action persist a row to `ad_connections`, explicitly documented as non-functional for real OAuth: `admin/page.tsx:154-158` — *"Writes ad_connections only. No real Meta call yet..."*; `admin/actions.ts:68-71` doc-comment confirms *"UI only — writes ad_connections; no real Meta call."* No Instagram-specific handling; one generic "ad account" form. |
| 29 | Customize the AI's coaching personality per dashboard | **MISSING** | No `personality`/`persona` field in schema or admin UI; `CoachWidget.tsx`/`AiPanel.tsx` have no configuration surface; system prompt is fixed in `src/providers/ai/anthropic-ai-provider.ts`. |
| 30 | Configure Slack notifications and schedules | **MISSING** | `NotificationChannel` type includes `"slack"` (`src/providers/ports/notifier.ts:5-9`) as a placeholder only; concrete implementations are `ConsoleNotifier` and `DbNotifier`. No admin UI, no schedule config, no cron. |
| 31 | Set alert thresholds | **MISSING** | `target_type` enum reserves `"threshold"` (`src/db/schema.ts:55`) but it's unused everywhere outside the enum declaration — no admin UI, no action, no read path. |
| 32 | Manage users and client assignments | **DONE** (scoped as assignment, not account creation) | `admin/page.tsx:82-147` — membership table + assign/remove, backed by `assignMembership`/`removeMembership` (`admin/actions.ts:42-66`). No way to create/deactivate a user account from this screen, but that wasn't in scope for this card either. |

---

## Integrations & Infrastructure

| Item | Status | Notes |
|---|---|---|
| Slack | **MISSING** | No Slack SDK, bot token, or `chat.postMessage`-style call anywhere. `console`/`db` are the only two `Notifier` implementations (`src/providers/notifier/console-notifier.ts`, `db-notifier.ts`); `selectNotifier` (`src/providers/registry.ts:59-61`) only switches between them. Message types that exist at all today (in-app only): `ai_insight`, `loss_debrief`, `next_best_action`. `alert` is a declared `Notification.kind` that nothing ever emits. EOD/weekly/monthly reports, shame/fame, streaks, and big-deal messages don't exist in any form. |
| Email | **MISSING** | No Resend/SendGrid/SES/nodemailer dependency in `package.json`, no adapter file — not even a throwing skeleton exists for the `"email"` notifier channel. |
| Meta ad provider | **DONE — ahead of the original spec.** | `CLAUDE.md` calls for a throwing skeleton ("Do NOT call Meta"), but `src/providers/ad/meta-ad-provider.ts` is a real, working Graph API client: real `fetch()` calls, pagination handling, `accountCurrency`, `listCampaigns`, `getDailyMetrics` all hit `https://graph.facebook.com/{version}/...`. `docs/INTEGRATIONS.md:10-14` already documents this as implemented. This matches the scope PDF's "Live in Production" / hourly-auto-sync claim, so it's being treated as intentional forward progress, not a violation — flagging only so it's not mistaken for unbuilt. |
| FX provider | **DONE — ahead of the original spec.** | `src/providers/fx/live-fx-provider.ts` calls the free Frankfurter/ECB API, caches for 12h, falls back to `MockFxProvider` on failure. `.env.example` already defaults to `FX_PROVIDER=live`. `docs/INTEGRATIONS.md`'s FX section (lines 44-48) is stale — still describes mock-only. |
| AI insights / next-best-action | **DONE, manual trigger only** | `src/lib/ai/usecases.ts:38-95`, `98-102`; `/api/ai/insights`, `/api/ai/next-best-action`; button-driven via `src/app/dashboard/ai-actions.ts`, not scheduled. |
| Loss debrief | **DONE — already triggers on lost-call logging** | `src/app/dashboard/sales/actions.ts:54-72`: `if (outcome === "lost") { ...generateLossDebrief... }`, best-effort (try/catch so it never blocks call logging), delivered via `Notifier.notify({kind:"loss_debrief", ...})`. |
| Anomaly detection | **MISSING** | No job, no interval, no `alert` notification ever emitted anywhere. |
| Campaign narratives (post-sync AI summary) | **MISSING** | `syncAdData` (`src/lib/ad-sync/sync.ts`) ends after touching `last_synced_at` — no call into AI or Notifier. |
| Daily target DMs | **MISSING** | No Slack (see above), no scheduler (see below), no "daily target" use-case anywhere. |
| Scheduling (cron/queue) | **MISSING entirely** | `package.json` has no node-cron/BullMQ/agenda/node-schedule dependency. No `vercel.json` cron, no systemd timer, no `ecosystem.config.cjs` cron entry. Ad sync is strictly on-demand (manual button, 15-min cooldown) or via the one-off `src/db/meta-connect.ts` script. |
| AI Reports (PDF) | **MISSING** | No PDF library (`pdfkit`/`puppeteer`/`jspdf`/`@react-pdf/renderer`) in `package.json`. No report-history table in `schema.ts`. No "Generate Now" route anywhere. |
| Audit trail | **PARTIAL** | `metric_overrides` (`schema.ts:370-394`) is a solid who/when/prior-value audit record — but only for KPI/goal/threshold overrides. `src/app/dashboard/call-logs/actions.ts` `updateCall`/`deleteCall` do direct UPDATE/DELETE with only `updated_at` bumped — no before-value snapshot, no actor id, no audit row; a `deleteCall` destroys the row with no trace. `src/app/dashboard/leads/actions.ts` `reassignLead` similarly overwrites `owner_user_id` with no history. |
| RLS / tenant isolation | **DONE** | `drizzle/0001_rls_policies.sql` (RLS + `is_admin()`/`is_member_of()`/`has_client_role()`/`is_client_viewer()` helpers + per-table policies), `0003_notifications_rls.sql`, `0004_restrict_aggregate_rls.sql` (tightens ad/KPI visibility to admin/client-viewer only). Isolation asserted in `tests/rls/isolation.test.ts` (closer-of-A cannot see client B's calls/goals; explicit cross-client query returns zero rows) — but this test is gated behind `RUN_DB_TESTS=1` and is **not** part of the default `npm run test` run. |
| `docs/INTEGRATIONS.md` | Exists, mostly accurate | Correctly documents Meta as implemented with an 11-step go-live checklist. FX section is stale (still says mock-only). |
| `docs/DEPLOYMENT.md` | Exists, complete for web-process deployment | Full Hostinger VPS runbook (provisioning → nginx → PM2 → certbot → `deploy.sh`). No cron/scheduler setup described anywhere — consistent with scheduling being unbuilt. |

### Environment variables currently in `.env.example`

- **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`
- **Anthropic:** `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (optional)
- **Provider selection:** `AD_PROVIDER` (mock|meta), `FX_PROVIDER` (mock|live), `NOTIFIER` (db|console), `AI_PROVIDER` (mock|anthropic), `FX_API_BASE` (optional)
- **Ad-account token references:** `META_TOKEN_ACME`, `META_TOKEN_GLOBEX`, `META_TOKEN_INITECH`
- **Meta-specific:** `META_GRAPH_API_VERSION` (optional)

No Slack, email-provider, PDF, or scheduler env vars exist yet — consistent with those features being unbuilt.
