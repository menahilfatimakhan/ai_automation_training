# NEW SZN — Agency Performance Dashboard

A multi-tenant analytics + workflow app for a digital marketing agency. It tracks
sales calls, appointment-setting activity, and paid-ad performance, computes KPIs
against monthly goals, manages leads/follow-ups, and layers **advisory** AI
coaching on top.

> Architecture & conventions live in [`CLAUDE.md`](CLAUDE.md); the Meta go-live
> checklist is in [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md).

## Stack
Next.js (App Router) · TypeScript · Tailwind · Supabase (Postgres + Auth + RLS) ·
Drizzle ORM · Recharts · Anthropic API · Vitest.

## Roles
| Role | Scope |
|------|-------|
| **Admin** (`users.is_admin`) | All clients, all data, settings |
| **Closer** | Their own sales calls for a client |
| **Setter** | Their own daily outreach activity |
| **Client** | Read-only view of its own client's data |

Separation is enforced in the database with **Row-Level Security**, not just app
code. There is a test that logs in as one tenant and asserts a cross-client read
returns zero rows.

## Core design principles
1. **Multi-tenant isolation is requirement #1** — every domain table has
   `client_id`; RLS policies key off `auth.uid()`.
2. **Computed / override / suggestion triad** — every derived value has a
   recomputed value (`kpi_values`), an optional manual override stored as a
   separate audited record (`metric_overrides`, newest-active wins at read time),
   and advisory AI suggestions (`ai_suggestions`). Accepting a suggestion creates
   an override tagged with its provenance. Raw data is never overwritten.
3. **AI never computes authoritative numbers** — metrics are computed in
   TypeScript and passed into prompts; the model only explains and suggests.
4. **Ports & adapters at every external edge** — the app never calls an external
   service directly. `AdProvider`, `FxProvider`, `Notifier`, `SecretStore`, and
   `AiProvider` are interfaces selected by env (`src/providers/registry.ts`).
   Mocks run now; real Meta is a same-signature skeleton. Going live is a
   checklist, not a refactor.

## Getting started

### 1. Install
```bash
npm install
```

### 2. Configure env
Copy `.env.example` → `.env.local` and fill in your Supabase values. For
Postgres on an IPv4 network, use the **Session pooler** connection string. AI and
ad data run on mocks by default (`AI_PROVIDER=mock`, `AD_PROVIDER=mock`), so no
Anthropic key or Meta account is required to run the app.

### 3. Migrate + seed
```bash
npm run db:migrate   # tables + RLS policies
npm run db:seed      # 3 clients, 10 users, ~60 days of data, ad metrics
```

### 4. Run
```bash
npm run dev          # http://localhost:3000
```

### Demo logins (password `Password123!`)
| Email | Role |
|-------|------|
| `admin@newszn.test` | Admin |
| `closer.acme@newszn.test` | Closer |
| `setter.acme@newszn.test` | Setter |
| `client.acme@newszn.test` | Client (read-only) |

## Scripts
| Command | Description |
|---------|-------------|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run test` | Vitest |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Generate a Drizzle migration |
| `npm run db:migrate` | Apply migrations (tables + RLS) |
| `npm run db:seed` | Seed clients/users/sample data |

## Tests
The four required guarantees each have coverage:
- **RLS isolation** — `tests/rls/isolation.test.ts` (integration, gated by
  `RUN_DB_TESTS=1`) + `tests/access/access-model.test.ts` (always-on).
- **KPI math** — `tests/kpi/*` (pure math, currency conversion, override resolution).
- **Ad-sync idempotency** — running sync twice never duplicates rows.
- **Provider swap** — swapping a provider changes only the injected implementation.

```bash
npm run test
```

## Project layout
```
src/
  app/                 Next.js routes (login, dashboard/*, api/*)
  components/          UI (cards, charts, tables, forms, shell)
  lib/
    kpi/               Pure + currency-aware KPI engine
    data/              RLS-scoped data loaders + view assembly
    ai/                Advisory AI use-cases
    ad-sync/           syncAdData pipeline (idempotent + cooldown)
    supabase/          Browser/server/service clients
  providers/           Ports + adapters (ad, fx, notifier, secrets, ai)
  db/                  Drizzle schema, migrate, seed
drizzle/               SQL migrations (tables + hand-written RLS)
docs/INTEGRATIONS.md   Meta go-live checklist
```

## Deferred (clean seams left, not built)
Real Meta/Slack/email calls, background scheduling/cron, anomaly detection,
scheduled PDF reports, streak/milestone messages. Each slots in behind an
existing port with no UI changes.
