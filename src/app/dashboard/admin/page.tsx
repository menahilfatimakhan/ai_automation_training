import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { loadAdminData } from "@/lib/data/admin";
import { monthStartIso } from "@/lib/format";
import {
  assignMembership,
  connectAdAccount,
  removeMembership,
  setMonthlyGoal,
} from "@/app/dashboard/admin/actions";

const inputCls =
  "rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm outline-none focus:border-brand";
const btnCls =
  "rounded bg-brand px-3 py-1.5 text-sm font-medium text-black hover:bg-brand-dark";

export default async function AdminPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  if (!ctx.isAdmin) redirect("/dashboard");

  const { clients, users, memberships, goals, connections } = await loadAdminData();
  const month = monthStartIso();
  const goalFor = (clientId: string) =>
    goals.find((g) => g.client_id === clientId && g.month === month);
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? id;
  const userLabel = (id: string) => {
    const u = users.find((x) => x.id === id);
    return u ? (u.fullName ?? u.email) : id;
  };

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Admin settings</h1>

      {/* ── Monthly goals ─────────────────────────────────────────────── */}
      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="mb-3 text-sm font-medium text-neutral-300">
          Monthly goals · {month}
        </h2>
        <div className="space-y-3">
          {clients.map((c) => {
            const g = goalFor(c.id);
            return (
              <form
                key={c.id}
                action={setMonthlyGoal}
                className="flex flex-wrap items-end gap-3"
              >
                <input type="hidden" name="clientId" value={c.id} />
                <input type="hidden" name="month" value={month} />
                <input type="hidden" name="currency" value={c.reportingCurrency} />
                <div className="w-32 text-sm">{c.name}</div>
                <label className="text-xs text-neutral-400">
                  Revenue goal ({c.reportingCurrency})
                  <input
                    name="revenueGoal"
                    type="number"
                    step="any"
                    defaultValue={g ? Number(g.revenue_goal) : 0}
                    className={`mt-1 block w-36 ${inputCls}`}
                  />
                </label>
                <label className="text-xs text-neutral-400">
                  Calls goal
                  <input
                    name="callsGoal"
                    type="number"
                    defaultValue={g ? g.calls_goal : 0}
                    className={`mt-1 block w-24 ${inputCls}`}
                  />
                </label>
                <button className={btnCls}>Save</button>
              </form>
            );
          })}
        </div>
      </section>

      {/* ── Memberships ──────────────────────────────────────────────── */}
      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="mb-3 text-sm font-medium text-neutral-300">
          User ↔ client assignments
        </h2>

        <table className="mb-4 w-full text-left text-sm">
          <thead className="text-xs uppercase text-neutral-500">
            <tr>
              <th className="py-1">User</th>
              <th className="py-1">Client</th>
              <th className="py-1">Role</th>
              <th className="py-1 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {memberships.map((m) => (
              <tr key={m.id} className="border-t border-neutral-800">
                <td className="py-1.5">{userLabel(m.userId)}</td>
                <td className="py-1.5">{clientName(m.clientId)}</td>
                <td className="py-1.5">{m.role}</td>
                <td className="py-1.5 text-right">
                  <form action={removeMembership}>
                    <input type="hidden" name="id" value={m.id} />
                    <button className="text-xs text-red-400 hover:text-red-300">
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <form action={assignMembership} className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-neutral-400">
            User
            <select name="userId" className={`mt-1 block ${inputCls}`} required>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName ?? u.email}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-neutral-400">
            Client
            <select name="clientId" className={`mt-1 block ${inputCls}`} required>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-neutral-400">
            Role
            <select name="role" className={`mt-1 block ${inputCls}`}>
              <option value="closer">closer</option>
              <option value="setter">setter</option>
              <option value="client">client</option>
            </select>
          </label>
          <button className={btnCls}>Assign</button>
        </form>
      </section>

      {/* ── Connect ad account ───────────────────────────────────────── */}
      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="mb-1 text-sm font-medium text-neutral-300">
          Connect ad account
        </h2>
        <p className="mb-3 text-xs text-neutral-500">
          Writes <code>ad_connections</code> only. No real Meta call yet — the
          token is stored as a secret reference (e.g. <code>env:META_TOKEN_ACME</code>),
          never plaintext. See docs/INTEGRATIONS.md to go live.
        </p>

        <table className="mb-4 w-full text-left text-sm">
          <thead className="text-xs uppercase text-neutral-500">
            <tr>
              <th className="py-1">Client</th>
              <th className="py-1">Ad account</th>
              <th className="py-1">Token ref</th>
              <th className="py-1">Last synced</th>
            </tr>
          </thead>
          <tbody>
            {connections.map((a) => (
              <tr key={`${a.clientId}:${a.adAccountId}`} className="border-t border-neutral-800">
                <td className="py-1.5">{clientName(a.clientId)}</td>
                <td className="py-1.5">{a.adAccountId}</td>
                <td className="py-1.5 text-neutral-400">{a.accessTokenRef ?? "—"}</td>
                <td className="py-1.5 text-neutral-400">
                  {a.lastSyncedAt ? new Date(a.lastSyncedAt).toLocaleString() : "Never"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <form action={connectAdAccount} className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-neutral-400">
            Client
            <select name="clientId" className={`mt-1 block ${inputCls}`} required>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-neutral-400">
            Ad account id
            <input name="adAccountId" placeholder="act_1001" className={`mt-1 block ${inputCls}`} required />
          </label>
          <label className="text-xs text-neutral-400">
            Access token ref
            <input name="accessTokenRef" placeholder="env:META_TOKEN_ACME" className={`mt-1 block w-52 ${inputCls}`} />
          </label>
          <button className={btnCls}>Connect</button>
        </form>
      </section>
    </div>
  );
}
