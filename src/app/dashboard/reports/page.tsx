import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { resolveClientScope } from "@/lib/data/client-scope";
import { loadReports } from "@/lib/data/reports";
import { generateReportNow } from "@/app/dashboard/reports/actions";
import { ActionForm } from "@/components/ActionForm";
import { ClientSwitcher } from "@/components/ClientSwitcher";

const TYPE_LABEL: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  const sp = await searchParams;
  const { active, options } = await resolveClientScope(ctx, sp.client);
  if (!active) return <p className="text-ink-soft">No client available.</p>;

  const reports = await loadReports(active.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">AI Reports</h1>
          <p className="text-sm text-ink-soft">{active.name}</p>
        </div>
        <ClientSwitcher options={options} activeId={active.id} />
      </div>

      {ctx.isAdmin && (
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-medium text-ink-soft">Generate now</h2>
          <ActionForm action={generateReportNow} success="Report generated" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="clientId" value={active.id} />
            <label className="text-xs text-ink-soft">
              Type
              <select
                name="type"
                className="mt-1 block rounded border border-line bg-surface-sunken px-2 py-1.5 text-sm outline-none focus:border-brand"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <button className="rounded bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark">
              Generate Now
            </button>
          </ActionForm>
        </section>
      )}

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-medium text-ink-soft">Report history</h2>
        {reports.length === 0 ? (
          <p className="text-sm text-ink-faint">No reports generated yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-ink-faint">
              <tr>
                <th className="py-1">Generated</th>
                <th className="py-1">Type</th>
                <th className="py-1">Period</th>
                <th className="py-1">Summary</th>
                <th className="py-1 text-right">Download</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="py-1.5 text-ink-soft">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="py-1.5">{TYPE_LABEL[r.type] ?? r.type}</td>
                  <td className="py-1.5 text-ink-soft">{r.periodStart} → {r.periodEnd}</td>
                  <td className="py-1.5 max-w-md truncate text-ink-soft" title={r.narrative}>
                    {r.narrative}
                  </td>
                  <td className="py-1.5 text-right">
                    <a
                      href={`/api/reports/${r.id}/download`}
                      className="text-xs font-medium text-brand hover:underline"
                    >
                      Download PDF
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
