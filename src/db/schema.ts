import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Database schema (Drizzle owns tables; RLS policies live in hand-written SQL
 * migrations — see drizzle/ and Step 3).
 *
 * Conventions:
 * - Every domain table carries `client_id` (the multi-tenant key). RLS keys off
 *   it. There is no domain table without it.
 * - Money is stored as numeric(14,2) alongside an explicit `currency` (ISO
 *   4217). Raw amounts keep their original currency; the KPI engine converts.
 * - Derived values follow the computed/override/suggestion triad:
 *     kpi_values        -> computed snapshots (always recalculated)
 *     metric_overrides  -> separate, append-only override records (who/when/prior)
 *     ai_suggestions    -> advisory only; accepting one writes an override
 */

// ─── Enums ──────────────────────────────────────────────────────────────────
export const membershipRole = pgEnum("membership_role", [
  "closer",
  "setter",
  "client",
]);
/**
 * The 8 literal outcomes from the client's KPI spec (Metrics/KPI_Calculations.md),
 * grouped into 4 buckets by `bucketOf()` in src/domain/metrics.ts — see that
 * function for the canonical bucket mapping used by every KPI formula.
 */
export const callOutcome = pgEnum("call_outcome", [
  "paid_in_full",
  "split_pay",
  "offer_declined",
  "not_a_fit",
  "deposit_only",
  "no_show",
  "cancelled",
  "rescheduled",
]);
export const objectionType = pgEnum("objection_type", [
  "think_about_it",
  "money",
  "time",
  "partner",
  "fear",
  "value",
]);
export const campaignStatus = pgEnum("campaign_status", [
  "active",
  "paused",
  "archived",
  "deleted",
]);
export const leadStatus = pgEnum("lead_status", [
  "new",
  "working",
  "won",
  "lost",
]);
export const followUpStatus = pgEnum("follow_up_status", ["pending", "done"]);
export const targetType = pgEnum("target_type", ["kpi", "goal", "threshold"]);
export const overrideSource = pgEnum("override_source", [
  "manual",
  "ai_suggestion",
]);
export const suggestionStatus = pgEnum("suggestion_status", [
  "pending",
  "accepted",
  "dismissed",
]);

const money = (name: string) => numeric(name, { precision: 14, scale: 2 });

// ─── Tenancy & identity ──────────────────────────────────────────────────────
export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** Currency KPIs roll up to for this client's dashboards. */
  reportingCurrency: text("reporting_currency").notNull().default("USD"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Mirrors auth.users; `id` equals the Supabase auth uid. */
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  /** Agency-wide admin (sees all clients). Distinct from per-client roles. */
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** user ↔ client ↔ role. A user may belong to multiple clients. */
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    role: membershipRole("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqUserClient: unique("memberships_user_client_uniq").on(
      t.userId,
      t.clientId,
    ),
  }),
);

// ─── Sales activity ──────────────────────────────────────────────────────────
export const calls = pgTable("calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  /** The closer who owns this call (a user with role=closer). */
  closerUserId: uuid("closer_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  /** The setter who booked this call, for the Setter Attribution Panel. */
  bookedBySetterId: uuid("booked_by_setter_id").references(() => users.id, {
    onDelete: "set null",
  }),
  date: date("date").notNull(),
  outcome: callOutcome("outcome").notNull(),
  revenue: money("revenue").notNull().default("0"),
  cashCollected: money("cash_collected").notNull().default("0"),
  currency: text("currency").notNull().default("USD"),
  leadSource: text("lead_source"),
  /** Controlled-vocabulary objection category (the 6 client counters). */
  objectionType: objectionType("objection_type"),
  /** Free-text objection detail — kept separate from the enum above. */
  objectionNotes: text("objection_notes"),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  notes: text("notes"),
  tags: text("tags").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Leads & follow-ups ──────────────────────────────────────────────────────
export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  ownerUserId: uuid("owner_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  contact: text("contact"),
  source: text("source"),
  status: leadStatus("status").notNull().default("new"),
  tags: text("tags").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const followUps = pgTable("follow_ups", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
  ownerUserId: uuid("owner_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  dueDate: date("due_date"),
  status: followUpStatus("status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Setter activity ─────────────────────────────────────────────────────────
export const setterDailyActivity = pgTable(
  "setter_daily_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    setterUserId: uuid("setter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    conversations: integer("conversations").notNull().default(0),
    replies: integer("replies").notNull().default(0),
    proposals: integer("proposals").notNull().default(0),
    callsBooked: integer("calls_booked").notNull().default(0),
    followUps: integer("follow_ups").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqSetterDay: unique("setter_activity_client_setter_date_uniq").on(
      t.clientId,
      t.setterUserId,
      t.date,
    ),
  }),
);

// ─── Goals (admin-set monthly targets; override-capable) ─────────────────────
export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    /** First day of the target month. */
    month: date("month").notNull(),
    revenueGoal: money("revenue_goal").notNull().default("0"),
    callsGoal: integer("calls_goal").notNull().default(0),
    currency: text("currency").notNull().default("USD"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqClientMonth: unique("goals_client_month_uniq").on(t.clientId, t.month),
  }),
);

// ─── Ad integration (normalized, provider-agnostic) ──────────────────────────
export const adConnections = pgTable(
  "ad_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    adAccountId: text("ad_account_id").notNull(),
    /** Secret REFERENCE resolved via SecretStore — never plaintext. */
    accessTokenRef: text("access_token_ref"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqClientAccount: unique("ad_connections_client_account_uniq").on(
      t.clientId,
      t.adAccountId,
    ),
  }),
);

export const adCampaigns = pgTable(
  "ad_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    /** Provider-stable campaign id. */
    campaignId: text("campaign_id").notNull(),
    name: text("name").notNull(),
    status: campaignStatus("status").notNull().default("active"),
    category: text("category"),
    /** Client-set categorization: "typeform" (Typeform-focused) or "normal". */
    adFocus: text("ad_focus"),
    /** Set when an admin flags this ad for review; null = not flagged. */
    flaggedReason: text("flagged_reason"),
    currency: text("currency").notNull().default("USD"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqClientCampaign: unique("ad_campaigns_client_campaign_uniq").on(
      t.clientId,
      t.campaignId,
    ),
  }),
);

export const adDailyMetrics = pgTable(
  "ad_daily_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    campaignId: text("campaign_id").notNull(),
    date: date("date").notNull(),
    spend: money("spend").notNull().default("0"),
    impressions: integer("impressions").notNull().default(0),
    reach: integer("reach").notNull().default(0),
    results: integer("results").notNull().default(0),
    /** CTR as a fraction (0.012 = 1.2%). */
    ctr: numeric("ctr", { precision: 8, scale: 5 }).notNull().default("0"),
    /** Cumulative follower count as of this day, when the provider/tracker reports it. */
    totalFollowers: integer("total_followers"),
    /** New followers gained this day. Powers Cost per Follower. */
    newFollowers: integer("new_followers"),
    status: campaignStatus("status").notNull().default("active"),
    category: text("category"),
    currency: text("currency").notNull().default("USD"),
    flags: jsonb("flags").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // Idempotency key: re-running sync upserts, never duplicates.
    uniqClientCampaignDate: unique("ad_metrics_client_campaign_date_uniq").on(
      t.clientId,
      t.campaignId,
      t.date,
    ),
  }),
);

// ─── Derived values: computed / override / suggestion ────────────────────────
/** Computed KPI snapshots. Always recalculated; never the source of truth for raw data. */
export const kpiValues = pgTable(
  "kpi_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    metricKey: text("metric_key").notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    value: numeric("value", { precision: 18, scale: 4 }).notNull(),
    /** Set for money metrics; null for ratios/counts. */
    currency: text("currency"),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqMetricPeriod: unique("kpi_values_metric_period_uniq").on(
      t.clientId,
      t.metricKey,
      t.periodStart,
      t.periodEnd,
    ),
  }),
);

/**
 * Separate, append-only manual override records for any derived value (KPI,
 * goal, threshold). Overrides win at read time; the newest `active` row for a
 * target applies. Raw data and computed snapshots are never mutated.
 */
export const metricOverrides = pgTable("metric_overrides", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  targetType: targetType("target_type").notNull(),
  /** e.g. metric_key for a KPI, or "revenue_goal" for a goal. */
  targetKey: text("target_key").notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  value: numeric("value", { precision: 18, scale: 4 }).notNull(),
  currency: text("currency"),
  /** The value in effect immediately before this override (for audit/undo). */
  priorValue: numeric("prior_value", { precision: 18, scale: 4 }),
  source: overrideSource("source").notNull().default("manual"),
  /** When source=ai_suggestion, the suggestion that was accepted. */
  sourceSuggestionId: uuid("source_suggestion_id"),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Advisory AI suggestions. Never authoritative. Accepting one writes an override. */
export const aiSuggestions = pgTable("ai_suggestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  targetType: targetType("target_type").notNull(),
  targetKey: text("target_key").notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  /** Optional numeric suggestion; null for purely textual coaching. */
  suggestedValue: numeric("suggested_value", { precision: 18, scale: 4 }),
  currency: text("currency"),
  rationale: text("rationale").notNull(),
  /** The pre-computed metrics passed into the prompt (provenance/audit). */
  promptContext: jsonb("prompt_context").notNull().default({}),
  status: suggestionStatus("status").notNull().default("pending"),
  /** Set when accepted → the override this produced. */
  overrideId: uuid("override_id"),
  decidedBy: uuid("decided_by").references(() => users.id, {
    onDelete: "set null",
  }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Notifications (in-app delivery channel for the Notifier port) ───────────
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  /** Optional target user; null = visible to all client members. */
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  meta: jsonb("meta").notNull().default({}),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── FX ──────────────────────────────────────────────────────────────────────
export const fxRates = pgTable(
  "fx_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    baseCurrency: text("base_currency").notNull(),
    quoteCurrency: text("quote_currency").notNull(),
    /** quote_amount = base_amount * rate */
    rate: numeric("rate", { precision: 18, scale: 8 }).notNull(),
    asOf: date("as_of").notNull(),
  },
  (t) => ({
    uniqPair: unique("fx_rates_pair_asof_uniq").on(
      t.baseCurrency,
      t.quoteCurrency,
      t.asOf,
    ),
  }),
);
