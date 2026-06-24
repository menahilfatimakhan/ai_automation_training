import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionContext } from "@/lib/auth";
import { isClientViewer } from "@/lib/access";
import { resolveClientScope } from "@/lib/data/client-scope";
import { loadCallLogs, type DatePreset } from "@/lib/data/call-logs";
import { ClientSwitcher } from "@/components/ClientSwitcher";
import { CallLogFilters } from "@/components/CallLogFilters";
import { CallLogRow } from "@/components/CallLogRow";

const PAGE_SIZE = 20;

export default async function CallLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    client?: string;
    preset?: string;
    outcome?: string;
    search?: string;
    page?: string;
  }>;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  const sp = await searchParams;
  const { active, options } = await resolveClientScope(ctx, sp.client);
  if (!active) return <p className="text-neutral-400">No client available.</p>;

  const preset = (sp.preset as DatePreset) ?? "this_month";
  const outcome = sp.outcome ?? "all";
  const search = sp.search ?? "";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const result = await loadCallLogs(active.id, {
    preset,
    outcome,
    search,
    page,
    pageSize: PAGE_SIZE,
  });

  // Client-role viewers are read-only; closers/admin can edit/delete.
  const canEdit = !isClientViewer(ctx, active.id) || ctx.isAdmin;
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  function pageHref(p: number) {
    const params = new URLSearchParams();
    params.set("client", active!.id);
    params.set("preset", preset);
    params.set("outcome", outcome);
    if (search) params.set("search", search);
    params.set("page", String(p));
    return `/dashboard/call-logs?${params.toString()}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Call logs</h1>
          <p className="text-sm text-neutral-400">
            {active.name} · {result.total} calls
          </p>
        </div>
        <ClientSwitcher options={options} activeId={active.id} />
      </div>

      <CallLogFilters preset={preset} outcome={outcome} search={search} />

      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-neutral-500">
            <tr>
              <th className="py-1">Date</th>
              <th className="py-1">Outcome</th>
              <th className="py-1">Revenue</th>
              <th className="py-1">Cash</th>
              <th className="py-1">Source</th>
              <th className="py-1">Tags</th>
              <th className="py-1 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((c) => (
              <CallLogRow key={c.id} call={c} canEdit={canEdit} />
            ))}
            {result.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-neutral-500">
                  No calls match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-500">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={pageHref(page - 1)} className="rounded border border-neutral-700 px-3 py-1 hover:text-white">
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link href={pageHref(page + 1)} className="rounded border border-neutral-700 px-3 py-1 hover:text-white">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
