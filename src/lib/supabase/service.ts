import { createClient } from "@supabase/supabase-js";
import { clientEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env";

/**
 * Privileged Supabase client using the service-role key. BYPASSES RLS.
 *
 * Use ONLY in trusted server-side contexts (seed scripts, ad sync jobs,
 * admin maintenance) where tenant scoping is enforced explicitly in code.
 * NEVER import this into a Client Component or expose the key to the browser.
 */
export function createSupabaseServiceClient() {
  return createClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
