import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateNextBestAction } from "@/lib/ai/usecases";

/**
 * POST /api/ai/next-best-action  { clientId }
 * Advisory "next best action" delivered to the in-app panel via the Notifier.
 */
export async function POST(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = (await req.json().catch(() => ({}))) as { clientId?: string };
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, reporting_currency")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const advice = await generateNextBestAction({
    id: client.id,
    name: client.name,
    currency: client.reporting_currency,
  });
  return NextResponse.json(advice);
}
