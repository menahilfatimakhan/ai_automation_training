import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getProviders } from "@/providers/registry";
import { clientMetricsMap } from "@/lib/ai/usecases";
import type { ChatMessage } from "@/providers/ports/ai-provider";

/**
 * POST /api/ai/chat  { clientId, messages: [{role, content}] }
 *
 * Advisory chat grounded in the client's PRE-COMPUTED metrics (invariant #3):
 * metrics are computed in TypeScript and passed to the model as authoritative
 * context; the assistant only explains/recommends. RLS scopes which client the
 * caller may ask about.
 */
export async function POST(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    clientId?: string;
    messages?: ChatMessage[];
  };
  if (!body.clientId || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: "clientId and messages required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, reporting_currency")
    .eq("id", body.clientId)
    .maybeSingle();
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Trim history to the last few turns to keep prompts tight.
  const messages = body.messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-10);

  const metrics = await clientMetricsMap({
    id: client.id,
    name: client.name,
    currency: client.reporting_currency,
  });

  const reply = await getProviders().ai.chat(
    { clientName: client.name, currency: client.reporting_currency, metrics },
    messages,
  );

  return NextResponse.json({ reply });
}
