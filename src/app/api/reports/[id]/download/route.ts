import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/reports/:id/download — streams the stored PDF. Goes through the
 * RLS-scoped server client, so a caller only ever gets a report their role is
 * allowed to see (admin or client-viewer for that client_id).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("reports")
    .select("pdf_base64, type, period_start, client_id")
    .eq("id", id)
    .maybeSingle();

  if (!data) return new Response("Not found", { status: 404 });

  const bytes = Buffer.from(data.pdf_base64, "base64");
  const filename = `report-${data.type}-${data.period_start}.pdf`;
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
