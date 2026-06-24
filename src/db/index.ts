import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverEnv } from "@/lib/env";
import * as schema from "@/db/schema";

/**
 * Drizzle client over a postgres.js connection. Server-only.
 *
 * This connects with the DATABASE_URL credentials and is NOT subject to RLS —
 * it is for trusted server contexts (sync jobs, KPI computation, seed). User-
 * scoped reads in the app go through the Supabase server client, which enforces
 * RLS. Keep tenant scoping explicit when using this client.
 */
let _client: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_db) return _db;
  _client = postgres(serverEnv().DATABASE_URL, { prepare: false });
  _db = drizzle(_client, { schema });
  return _db;
}

export { schema };
