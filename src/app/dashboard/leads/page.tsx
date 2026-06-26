import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { resolveClientScope } from "@/lib/data/client-scope";
import { loadClientMembers, loadFollowUps, loadLeads } from "@/lib/data/leads";
import { ClientSwitcher } from "@/components/ClientSwitcher";
import { LeadRow } from "@/components/LeadRow";
import { FollowUpItem } from "@/components/FollowUpItem";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  const { client } = await searchParams;
  const { active, options } = await resolveClientScope(ctx, client);
  if (!active) return <p className="text-ink-soft">No client available.</p>;

  const [leads, members] = await Promise.all([
    loadLeads(active.id),
    loadClientMembers(active.id),
  ]);
  // Admin sees the whole queue; everyone else sees their own follow-ups.
  const followUps = await loadFollowUps(
    active.id,
    ctx.isAdmin ? undefined : ctx.userId,
  );

  const memberName = (id: string | null) =>
    members.find((m) => m.userId === id)?.name ?? "Unassigned";

  const statusMeta = [
    { key: "new", label: "New", cls: "text-accent-sky" },
    { key: "working", label: "Working", cls: "text-accent-amber" },
    { key: "won", label: "Won", cls: "text-accent-green" },
    { key: "lost", label: "Lost", cls: "text-accent-rose" },
  ];
  const statusCounts = leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Leads & follow-ups</h1>
          <p className="text-sm text-ink-soft">{active.name}</p>
        </div>
        <ClientSwitcher options={options} activeId={active.id} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {statusMeta.map((s) => (
          <div key={s.key} className="card flex items-center gap-2 px-3 py-2">
            <span className={`text-lg font-semibold ${s.cls}`}>
              {statusCounts[s.key] ?? 0}
            </span>
            <span className="text-xs text-ink-soft">{s.label}</span>
          </div>
        ))}
      </div>

      <section className="card p-4">
        <h2 className="mb-2 text-sm font-medium text-ink-soft">
          {ctx.isAdmin ? "Follow-up queue (all)" : "My follow-up queue"}
        </h2>
        {followUps.length === 0 ? (
          <p className="text-sm text-ink-faint">No follow-ups.</p>
        ) : (
          <ul>
            {followUps.map((f) => (
              <FollowUpItem
                key={f.id}
                id={f.id}
                leadName={f.leadName}
                dueDate={f.dueDate}
                status={f.status}
                notes={f.notes}
                ownerLabel={ctx.isAdmin ? memberName(f.ownerUserId) : undefined}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-medium text-ink-soft">Leads</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-ink-faint">
            <tr>
              <th className="py-1">Name</th>
              <th className="py-1">Contact</th>
              <th className="py-1">Source</th>
              <th className="py-1">Status</th>
              <th className="py-1">Tags</th>
              <th className="py-1">Owner</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <LeadRow key={l.id} lead={l} members={members} isAdmin={ctx.isAdmin} />
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-ink-faint">
                  No leads yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
