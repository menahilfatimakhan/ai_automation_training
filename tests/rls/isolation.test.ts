import { config } from "dotenv";
config({ path: ".env.local" });

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

/**
 * RLS cross-client ISOLATION test (invariant #1).
 *
 * This is an INTEGRATION test: it requires a live Postgres with the migrations
 * (tables + RLS policies) applied and the seed loaded. It is gated behind
 * RUN_DB_TESTS=1 so the default suite stays hermetic. The always-on companion
 * is tests/access/access-model.test.ts.
 *
 * To run:
 *   1. Point DATABASE_URL at your Supabase Postgres (service/owner connection).
 *   2. npm run db:migrate && npm run db:seed
 *   3. RUN_DB_TESTS=1 npm run test -- tests/rls/isolation.test.ts
 *
 * Mechanism: we emulate a logged-in user the way PostgREST does — switch to the
 * `authenticated` role and set the JWT `sub` claim — then assert that a closer
 * scoped to client A reads ZERO rows from client B, and that auth.uid() context
 * actually constrains the query (cross-tenant read fails to return data).
 */

const RUN = process.env.RUN_DB_TESTS === "1";
const url = process.env.DATABASE_URL ?? "";

let sql: ReturnType<typeof postgres>;

/** Run a query as a specific authenticated user. */
async function asUser<Row>(
  userId: string,
  fn: (tx: postgres.TransactionSql) => Promise<Row[]>,
): Promise<Row[]> {
  const result = await sql.begin(async (tx) => {
    await tx.unsafe(`set local role authenticated`);
    await tx.unsafe(
      `set local request.jwt.claims = '${JSON.stringify({ sub: userId, role: "authenticated" })}'`,
    );
    return fn(tx);
  });
  return result as Row[];
}

describe.skipIf(!RUN)("RLS cross-client isolation", () => {
  let clientA: string;
  let clientB: string;
  let closerAId: string;

  beforeAll(async () => {
    sql = postgres(url, { max: 1, prepare: false });

    // Read seed fixtures as owner (bypasses RLS).
    const clients = await sql<{ id: string; name: string }[]>`
      select id, name from clients order by name limit 2`;
    expect(clients.length).toBe(2);
    clientA = clients[0].id;
    clientB = clients[1].id;

    const closer = await sql<{ user_id: string }[]>`
      select user_id from memberships
      where client_id = ${clientA} and role = 'closer' limit 1`;
    expect(closer.length).toBe(1);
    closerAId = closer[0].user_id;
  });

  afterAll(async () => {
    await sql?.end();
  });

  it("closer of A sees A's calls but NOT B's", async () => {
    const visible = await asUser(closerAId, (tx) =>
      tx<{ client_id: string }[]>`select client_id from calls`,
    );
    // Every visible row belongs to client A; none leak from client B.
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every((r) => r.client_id === clientA)).toBe(true);
    expect(visible.filter((r) => r.client_id === clientB).length).toBe(0);
  });

  it("an explicit cross-client read returns zero rows", async () => {
    const leaked = await asUser(closerAId, (tx) =>
      tx<{ id: string }[]>`select id from calls where client_id = ${clientB}`,
    );
    expect(leaked.length).toBe(0);
  });

  it("closer cannot read another client's goals", async () => {
    const leaked = await asUser(closerAId, (tx) =>
      tx<{ id: string }[]>`select id from goals where client_id = ${clientB}`,
    );
    expect(leaked.length).toBe(0);
  });
});
