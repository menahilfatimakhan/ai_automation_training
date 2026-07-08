import "@/lib/load-env"; // must be first: loads .env.local before env validation

import { inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { runSync } from "@/lib/ad-sync";

/**
 * Idempotent seed. Safe to run repeatedly.
 *
 * - Auth users + `users`/`clients`/`memberships` are upserted by stable key.
 * - Per-client domain rows (calls, setter activity, leads, follow-ups, goals,
 *   ad_connections, fx_rates) are deleted-then-reinserted for the seed clients,
 *   so the dataset is deterministic on every run.
 * - Ad campaigns/metrics are intentionally NOT seeded here; they are populated
 *   by running `syncAdData` through the MockAdProvider (Step 5), exercising the
 *   real sync path against the committed fixtures.
 *
 * Run with `npm run db:seed` against a live Supabase + Postgres.
 */

const SEED_PASSWORD = "Password123!";

// Stable client IDs so the seed is idempotent and referenceable.
const CLIENTS = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Acme Co", currency: "USD", adAccountId: "act_1001" },
  { id: "22222222-2222-2222-2222-222222222222", name: "Globex", currency: "EUR", adAccountId: "act_1002" },
  { id: "33333333-3333-3333-3333-333333333333", name: "Initech", currency: "GBP", adAccountId: "act_1003" },
] as const;

type Role = "closer" | "setter" | "client";
interface SeedUser {
  email: string;
  fullName: string;
  isAdmin: boolean;
  memberships: { clientId: string; role: Role }[];
}

const ADMIN: SeedUser = {
  email: "admin@newszn.test",
  fullName: "Agency Admin",
  isAdmin: true,
  memberships: [],
};

const USERS: SeedUser[] = [
  ADMIN,
  ...CLIENTS.flatMap((c): SeedUser[] => {
    const slug = c.name.toLowerCase().split(" ")[0];
    return [
      {
        email: `closer.${slug}@newszn.test`,
        fullName: `${c.name} Closer`,
        isAdmin: false,
        memberships: [{ clientId: c.id, role: "closer" }],
      },
      {
        email: `setter.${slug}@newszn.test`,
        fullName: `${c.name} Setter`,
        isAdmin: false,
        memberships: [{ clientId: c.id, role: "setter" }],
      },
      {
        email: `client.${slug}@newszn.test`,
        fullName: `${c.name} Client`,
        isAdmin: false,
        memberships: [{ clientId: c.id, role: "client" }],
      },
    ];
  }),
];

// ─── Deterministic helpers ───────────────────────────────────────────────────
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function isoDay(offsetFromToday: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetFromToday);
  return d.toISOString().slice(0, 10);
}
function firstOfMonth(offsetMonths: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + offsetMonths);
  return d.toISOString().slice(0, 10);
}

// ─── Auth ────────────────────────────────────────────────────────────────────
async function ensureAuthUser(email: string): Promise<string> {
  const supabase = createSupabaseServiceClient();
  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
  });
  if (!error && created.user) return created.user.id;

  // Already exists — look it up.
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) throw listErr;
  const existing = list.users.find((u) => u.email === email);
  if (!existing) throw error ?? new Error(`Could not create/find user ${email}`);
  return existing.id;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const db = getDb();
  const clientIds = CLIENTS.map((c) => c.id);

  // 1) Clients (upsert).
  for (const c of CLIENTS) {
    await db
      .insert(schema.clients)
      .values({ id: c.id, name: c.name, reportingCurrency: c.currency })
      .onConflictDoUpdate({
        target: schema.clients.id,
        set: { name: c.name, reportingCurrency: c.currency },
      });
  }

  // 2) Auth users + users table + memberships.
  const userIdByEmail = new Map<string, string>();
  for (const u of USERS) {
    const id = await ensureAuthUser(u.email);
    userIdByEmail.set(u.email, id);
    await db
      .insert(schema.users)
      .values({ id, email: u.email, fullName: u.fullName, isAdmin: u.isAdmin })
      .onConflictDoUpdate({
        target: schema.users.id,
        set: { email: u.email, fullName: u.fullName, isAdmin: u.isAdmin },
      });
    for (const m of u.memberships) {
      await db
        .insert(schema.memberships)
        .values({ userId: id, clientId: m.clientId, role: m.role })
        .onConflictDoNothing({
          target: [schema.memberships.userId, schema.memberships.clientId],
        });
    }
  }

  const closerFor = (clientId: string) =>
    userIdByEmail.get(
      `closer.${CLIENTS.find((c) => c.id === clientId)!.name.toLowerCase().split(" ")[0]}@newszn.test`,
    )!;
  const setterFor = (clientId: string) =>
    userIdByEmail.get(
      `setter.${CLIENTS.find((c) => c.id === clientId)!.name.toLowerCase().split(" ")[0]}@newszn.test`,
    )!;

  // 3) Reset per-client domain rows for determinism.
  await db.delete(schema.followUps).where(inArray(schema.followUps.clientId, clientIds));
  await db.delete(schema.leads).where(inArray(schema.leads.clientId, clientIds));
  await db.delete(schema.calls).where(inArray(schema.calls.clientId, clientIds));
  await db
    .delete(schema.setterDailyActivity)
    .where(inArray(schema.setterDailyActivity.clientId, clientIds));
  await db.delete(schema.goals).where(inArray(schema.goals.clientId, clientIds));
  await db
    .delete(schema.adConnections)
    .where(inArray(schema.adConnections.clientId, clientIds));

  const adminId = userIdByEmail.get(ADMIN.email)!;
  // Weighted toward the client's real-world mix: mostly closed/showed-not-closed,
  // a modest no-show rate, few reschedules.
  const OUTCOMES = [
    "paid_in_full",
    "paid_in_full",
    "split_pay",
    "split_pay",
    "offer_declined",
    "offer_declined",
    "not_a_fit",
    "deposit_only",
    "no_show",
    "cancelled",
    "rescheduled",
  ] as const;
  const SOURCES = ["paid_ads", "referral", "organic", "outbound"];
  const OBJECTIONS = ["think_about_it", "money", "time", "partner", "fear", "value"] as const;

  for (const c of CLIENTS) {
    const closerId = closerFor(c.id);
    const setterId = setterFor(c.id);

    // Goals: current + prior month.
    await db.insert(schema.goals).values([
      {
        clientId: c.id,
        month: firstOfMonth(0),
        revenueGoal: "50000",
        callsGoal: 60,
        currency: c.currency,
        createdBy: adminId,
        updatedBy: adminId,
      },
      {
        clientId: c.id,
        month: firstOfMonth(-1),
        revenueGoal: "45000",
        callsGoal: 55,
        currency: c.currency,
        createdBy: adminId,
        updatedBy: adminId,
      },
    ]);

    // ~60 days of calls + setter activity.
    for (let day = 59; day >= 0; day--) {
      const date = isoDay(-day);
      const rand = mulberry32(hash(`${c.id}:calls:${date}`));

      const callCount = Math.floor(rand() * 4); // 0-3 calls/day
      const calls = [];
      for (let i = 0; i < callCount; i++) {
        const r = mulberry32(hash(`${c.id}:${date}:${i}`));
        const outcome = OUTCOMES[Math.floor(r() * OUTCOMES.length)];
        const isClosed = outcome === "paid_in_full" || outcome === "split_pay";
        const revenue = isClosed ? Math.round((1500 + r() * 6000) * 100) / 100 : 0;
        const cash =
          outcome === "paid_in_full"
            ? revenue
            : outcome === "split_pay"
              ? Math.round(revenue * (0.2 + r() * 0.3) * 100) / 100
              : 0;
        const isDeclineOutcome = outcome === "offer_declined" || outcome === "not_a_fit";
        calls.push({
          clientId: c.id,
          closerUserId: closerId,
          bookedBySetterId: setterId,
          date,
          outcome,
          revenue: String(revenue),
          cashCollected: String(cash),
          currency: c.currency,
          leadSource: SOURCES[Math.floor(r() * SOURCES.length)],
          objectionType: isDeclineOutcome ? OBJECTIONS[Math.floor(r() * OBJECTIONS.length)] : null,
          objectionNotes: null,
          contactName: null,
          contactPhone: null,
          contactEmail: null,
          notes: null,
          tags: r() > 0.7 ? ["hot"] : [],
        });
      }
      if (calls.length) await db.insert(schema.calls).values(calls);

      const sa = mulberry32(hash(`${c.id}:setter:${date}`));
      await db.insert(schema.setterDailyActivity).values({
        clientId: c.id,
        setterUserId: setterId,
        date,
        conversations: 20 + Math.floor(sa() * 40),
        replies: 8 + Math.floor(sa() * 20),
        proposals: Math.floor(sa() * 8),
        callsBooked: Math.floor(sa() * 5),
        followUps: Math.floor(sa() * 10),
      });
    }

    // Leads + follow-ups.
    const leadRows = Array.from({ length: 6 }, (_, i) => {
      const r = mulberry32(hash(`${c.id}:lead:${i}`));
      const status = (["new", "working", "won", "lost"] as const)[Math.floor(r() * 4)];
      return {
        clientId: c.id,
        ownerUserId: i % 2 === 0 ? closerId : setterId,
        name: `${c.name} Lead ${i + 1}`,
        contact: `lead${i + 1}@${c.name.toLowerCase().split(" ")[0]}.example`,
        source: SOURCES[Math.floor(r() * SOURCES.length)],
        status,
        tags: r() > 0.5 ? ["priority"] : [],
      };
    });
    const insertedLeads = await db
      .insert(schema.leads)
      .values(leadRows)
      .returning({ id: schema.leads.id, owner: schema.leads.ownerUserId });

    await db.insert(schema.followUps).values(
      insertedLeads.slice(0, 4).map((l, i) => ({
        clientId: c.id,
        leadId: l.id,
        ownerUserId: l.owner,
        dueDate: isoDay(i + 1),
        status: "pending" as const,
        notes: "Follow up on proposal",
      })),
    );

    // Ad connection (token stored as an env-backed secret reference).
    await db.insert(schema.adConnections).values({
      clientId: c.id,
      adAccountId: c.adAccountId,
      accessTokenRef: `env:META_TOKEN_${c.name.toUpperCase().split(" ")[0]}`,
      lastSyncedAt: null,
    });
  }

  // 4) FX rates (mirror MockFxProvider, USD-based) as_of today.
  const asOf = isoDay(0);
  const usdRates: Record<string, number> = { USD: 1, EUR: 1.08, GBP: 1.27, CAD: 0.74, AUD: 0.66 };
  await db.delete(schema.fxRates);
  const fxRows = [];
  for (const [base, baseUsd] of Object.entries(usdRates)) {
    for (const [quote, quoteUsd] of Object.entries(usdRates)) {
      fxRows.push({
        baseCurrency: base,
        quoteCurrency: quote,
        rate: String(baseUsd / quoteUsd),
        asOf,
      });
    }
  }
  await db.insert(schema.fxRates).values(fxRows);

  // 5) Backfill ad campaigns/metrics by running the REAL sync pipeline through
  //    the MockAdProvider (ignoring the cooldown for seeding).
  for (const c of CLIENTS) {
    const summary = await runSync(c.id, { ignoreCooldown: true });
    console.info(
      `  synced ${c.name}: ${summary.campaigns} campaigns, ${summary.metricRows} metric rows`,
    );
  }

  console.info(
    `Seed complete: ${CLIENTS.length} clients, ${USERS.length} users, ~60 days of calls/setter activity, leads + follow-ups, ad connections + metrics, fx rates.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
