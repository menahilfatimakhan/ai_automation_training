import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SessionContext } from "@/lib/access";

export interface ClientOption {
  id: string;
  name: string;
  reportingCurrency: string;
}

/**
 * Resolves which client a dashboard should display, and the list the viewer may
 * switch between. Admins can pick any client (RLS lets them read all); other
 * roles are pinned to their membership client(s). Reads go through the RLS-
 * scoped server client, so this can only ever surface clients the user may see.
 */
export async function resolveClientScope(
  _ctx: SessionContext,
  requestedClientId?: string,
): Promise<{ active: ClientOption | null; options: ClientOption[] }> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("clients")
    .select("id, name, reporting_currency")
    .order("name");

  const options: ClientOption[] = (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    reportingCurrency: c.reporting_currency,
  }));

  const active =
    options.find((o) => o.id === requestedClientId) ?? options[0] ?? null;
  return { active, options };
}
