import { z } from "zod";

/**
 * Centralized, validated environment access.
 *
 * - `clientEnv` holds only NEXT_PUBLIC_* values safe for the browser.
 * - `serverEnv` holds secrets and provider selection; importing it from a
 *   client component will fail the build (these vars are undefined there).
 *
 * Never read process.env directly elsewhere — go through these objects so
 * validation and the server/client boundary stay in one place.
 */

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  AD_PROVIDER: z.enum(["mock", "meta"]).default("mock"),
  FX_PROVIDER: z.enum(["mock"]).default("mock"),
  NOTIFIER: z.enum(["console"]).default("console"),
});

export const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

/**
 * Lazily parsed so client bundles that never call it don't throw on missing
 * secrets. Call from server code only.
 */
let _serverEnv: z.infer<typeof serverSchema> | null = null;
export function serverEnv() {
  if (_serverEnv) return _serverEnv;
  _serverEnv = serverSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    AD_PROVIDER: process.env.AD_PROVIDER,
    FX_PROVIDER: process.env.FX_PROVIDER,
    NOTIFIER: process.env.NOTIFIER,
  });
  return _serverEnv;
}
