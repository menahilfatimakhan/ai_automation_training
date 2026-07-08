import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { loadAdminData } from "@/lib/data/admin";
import { monthStartIso } from "@/lib/format";
import { METRIC_KEYS } from "@/domain/metrics";
import {
  assignMembership,
  connectAdAccount,
  deleteAlertThreshold,
  removeMembership,
  setAlertThreshold,
  setMonthlyGoal,
  updateAiPersona,
  updateClientSettings,
} from "@/app/dashboard/admin/actions";
import { ActionForm } from "@/components/ActionForm";

const DASHBOARDS = ["master", "sales", "ads", "setter"] as const;
const ALERT_METRIC_KEYS = [
  METRIC_KEYS.closeRate,
  METRIC_KEYS.showUpRate,
  METRIC_KEYS.roasRev,
  METRIC_KEYS.roasCash,
  METRIC_KEYS.cashUpfrontPct,
  METRIC_KEYS.pifPct,
];

const inputCls =
  "rounded border border-line bg-surface-sunken px-2 py-1 text-sm outline-none focus:border-brand";
const btnCls =
  "rounded bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark";

export default async function AdminPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  if (!ctx.isAdmin) redirect("/dashboard");

  const { clients, users, memberships, goals, connections, settings, personas, thresholds } =
    await loadAdminData();
  const month = monthStartIso();
  const goalFor = (clientId: string) =>
    goals.find((g) => g.client_id === clientId && g.month === month);
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? id;
  const userLabel = (id: string) => {
    const u = users.find((x) => x.id === id);
    return u ? (u.fullName ?? u.email) : id;
  };
  const settingsFor = (clientId: string) => settings.find((s) => s.clientId === clientId);
  const personaFor = (clientId: string, dashboard: string) =>
    personas.find((p) => p.clientId === clientId && p.dashboard === dashboard)?.persona ?? "";

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Admin settings</h1>

      {/* ── Monthly goals ─────────────────────────────────────────────── */}
      <section className="card p-4">
        <h2 className="mb-3 text-sm font-medium text-ink-soft">
          Monthly goals · {month}
        </h2>
        <div className="space-y-3">
          {clients.map((c) => {
            const g = goalFor(c.id);
            return (
              <ActionForm
                key={c.id}
                action={setMonthlyGoal}
                success={`Goal saved for ${c.name}`}
                className="flex flex-wrap items-end gap-3"
              >
                <input type="hidden" name="clientId" value={c.id} />
                <input type="hidden" name="month" value={month} />
                <input type="hidden" name="currency" value={c.reportingCurrency} />
                <div className="w-32 text-sm">{c.name}</div>
                <label className="text-xs text-ink-soft">
                  Revenue goal ({c.reportingCurrency})
                  <input
                    name="revenueGoal"
                    type="number"
                    step="any"
                    defaultValue={g ? Number(g.revenue_goal) : 0}
                    className={`mt-1 block w-36 ${inputCls}`}
                  />
                </label>
                <label className="text-xs text-ink-soft">
                  Calls goal
                  <input
                    name="callsGoal"
                    type="number"
                    defaultValue={g ? g.calls_goal : 0}
                    className={`mt-1 block w-24 ${inputCls}`}
                  />
                </label>
                <button className={btnCls}>Save</button>
              </ActionForm>
            );
          })}
        </div>
      </section>

      {/* ── Memberships ──────────────────────────────────────────────── */}
      <section className="card p-4">
        <h2 className="mb-3 text-sm font-medium text-ink-soft">
          User ↔ client assignments
        </h2>

        <table className="mb-4 w-full text-left text-sm">
          <thead className="text-xs uppercase text-ink-faint">
            <tr>
              <th className="py-1">User</th>
              <th className="py-1">Client</th>
              <th className="py-1">Role</th>
              <th className="py-1 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {memberships.map((m) => (
              <tr key={m.id} className="border-t border-line">
                <td className="py-1.5">{userLabel(m.userId)}</td>
                <td className="py-1.5">{clientName(m.clientId)}</td>
                <td className="py-1.5">{m.role}</td>
                <td className="py-1.5 text-right">
                  <form action={removeMembership}>
                    <input type="hidden" name="id" value={m.id} />
                    <button className="text-xs text-accent-rose hover:text-accent-rose">
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <form action={assignMembership} className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-ink-soft">
            User
            <select name="userId" className={`mt-1 block ${inputCls}`} required>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName ?? u.email}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-ink-soft">
            Client
            <select name="clientId" className={`mt-1 block ${inputCls}`} required>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-ink-soft">
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
      <section className="card p-4">
        <h2 className="mb-1 text-sm font-medium text-ink-soft">
          Connect ad account
        </h2>
        <p className="mb-3 text-xs text-ink-faint">
          Writes <code>ad_connections</code> only. No real Meta call yet — the
          token is stored as a secret reference (e.g. <code>env:META_TOKEN_ACME</code>),
          never plaintext. See docs/INTEGRATIONS.md to go live.
        </p>

        <table className="mb-4 w-full text-left text-sm">
          <thead className="text-xs uppercase text-ink-faint">
            <tr>
              <th className="py-1">Client</th>
              <th className="py-1">Ad account</th>
              <th className="py-1">Token ref</th>
              <th className="py-1">Last synced</th>
            </tr>
          </thead>
          <tbody>
            {connections.map((a) => (
              <tr key={`${a.clientId}:${a.adAccountId}`} className="border-t border-line">
                <td className="py-1.5">{clientName(a.clientId)}</td>
                <td className="py-1.5">{a.adAccountId}</td>
                <td className="py-1.5 text-ink-soft">{a.accessTokenRef ?? "—"}</td>
                <td className="py-1.5 text-ink-soft">
                  {a.lastSyncedAt ? new Date(a.lastSyncedAt).toLocaleString() : "Never"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <form action={connectAdAccount} className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-ink-soft">
            Client
            <select name="clientId" className={`mt-1 block ${inputCls}`} required>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-ink-soft">
            Ad account id
            <input name="adAccountId" placeholder="act_1001" className={`mt-1 block ${inputCls}`} required />
          </label>
          <label className="text-xs text-ink-soft">
            Access token ref
            <input name="accessTokenRef" placeholder="env:META_TOKEN_ACME" className={`mt-1 block w-52 ${inputCls}`} />
          </label>
          <button className={btnCls}>Connect</button>
        </form>
      </section>

      {/* ── Slack / notification settings ────────────────────────────── */}
      <section className="card p-4">
        <h2 className="mb-1 text-sm font-medium text-ink-soft">
          Slack &amp; notification settings
        </h2>
        <p className="mb-3 text-xs text-ink-faint">
          Channel + schedule config only here — delivery goes through the
          Notifier port (console/db today; Slack once <code>SLACK_BOT_TOKEN</code> is set).
        </p>
        <div className="space-y-4">
          {clients.map((c) => {
            const s = settingsFor(c.id);
            return (
              <ActionForm
                key={c.id}
                action={updateClientSettings}
                success={`Settings saved for ${c.name}`}
                className="rounded border border-line p-3"
              >
                <input type="hidden" name="clientId" value={c.id} />
                <div className="mb-2 flex flex-wrap items-end gap-3">
                  <div className="w-40 text-sm font-medium">{c.name}</div>
                  <label className="text-xs text-ink-soft">
                    Slack channel ID
                    <input
                      name="slackChannelId"
                      defaultValue={s?.slackChannelId ?? ""}
                      placeholder="C0123456789"
                      className={`mt-1 block w-40 ${inputCls}`}
                    />
                  </label>
                  <label className="text-xs text-ink-soft">
                    Timezone
                    <input
                      name="timezone"
                      defaultValue={s?.timezone ?? "UTC"}
                      placeholder="Europe/Copenhagen"
                      className={`mt-1 block w-36 ${inputCls}`}
                    />
                  </label>
                  <label className="text-xs text-ink-soft">
                    Daily target hour (0-23)
                    <input
                      name="dailyTargetHour"
                      type="number"
                      min={0}
                      max={23}
                      defaultValue={s?.dailyTargetHour ?? 8}
                      className={`mt-1 block w-20 ${inputCls}`}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" name="slackEnabled" defaultChecked={s?.slackEnabled ?? false} />
                    Slack enabled
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" name="notifyDailyTargets" defaultChecked={s?.notifyDailyTargets ?? true} />
                    Daily targets
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" name="notifyEodReport" defaultChecked={s?.notifyEodReport ?? true} />
                    EOD report
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" name="notifyWeeklyReport" defaultChecked={s?.notifyWeeklyReport ?? true} />
                    Weekly report
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" name="notifyMonthlyReport" defaultChecked={s?.notifyMonthlyReport ?? true} />
                    Monthly report
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" name="notifyLossDebrief" defaultChecked={s?.notifyLossDebrief ?? true} />
                    Loss debrief
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" name="notifyAnomalyAlerts" defaultChecked={s?.notifyAnomalyAlerts ?? true} />
                    Anomaly alerts
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" name="notifyShameFame" defaultChecked={s?.notifyShameFame ?? false} />
                    Shame/fame
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" name="notifyStreaks" defaultChecked={s?.notifyStreaks ?? false} />
                    Streaks
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" name="notifyBigDeals" defaultChecked={s?.notifyBigDeals ?? true} />
                    Big deals
                  </label>
                </div>
                <button className={`${btnCls} mt-3`}>Save</button>
              </ActionForm>
            );
          })}
        </div>
      </section>

      {/* ── AI coaching persona per dashboard ────────────────────────── */}
      <section className="card p-4">
        <h2 className="mb-1 text-sm font-medium text-ink-soft">
          AI coaching personality
        </h2>
        <p className="mb-3 text-xs text-ink-faint">
          Optional per-dashboard tone/instructions appended to the AI system
          prompt. Leave blank to use the default coaching voice.
        </p>
        <div className="space-y-4">
          {clients.map((c) => (
            <div key={c.id} className="rounded border border-line p-3">
              <div className="mb-2 text-sm font-medium">{c.name}</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {DASHBOARDS.map((d) => (
                  <ActionForm
                    key={d}
                    action={updateAiPersona}
                    success={`${d} persona saved for ${c.name}`}
                    className="flex flex-col gap-1"
                  >
                    <input type="hidden" name="clientId" value={c.id} />
                    <input type="hidden" name="dashboard" value={d} />
                    <label className="text-xs capitalize text-ink-soft">{d}</label>
                    <textarea
                      name="persona"
                      rows={2}
                      defaultValue={personaFor(c.id, d)}
                      placeholder="e.g. Direct, no-nonsense, sports-coach tone"
                      className={`${inputCls} w-full`}
                    />
                    <button className="self-start text-xs font-medium text-brand hover:underline">
                      Save
                    </button>
                  </ActionForm>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Alert thresholds ─────────────────────────────────────────── */}
      <section className="card p-4">
        <h2 className="mb-1 text-sm font-medium text-ink-soft">Alert thresholds</h2>
        <p className="mb-3 text-xs text-ink-faint">
          Warn/critical below a fixed value for a KPI. Separate from the
          anomaly detector's 28-day rolling comparison (Step 7).
        </p>

        <table className="mb-4 w-full text-left text-sm">
          <thead className="text-xs uppercase text-ink-faint">
            <tr>
              <th className="py-1">Client</th>
              <th className="py-1">Metric</th>
              <th className="py-1">Warn below</th>
              <th className="py-1">Critical below</th>
              <th className="py-1 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {thresholds.map((t) => (
              <tr key={t.id} className="border-t border-line">
                <td className="py-1.5">{clientName(t.clientId)}</td>
                <td className="py-1.5">{t.metricKey}</td>
                <td className="py-1.5">{t.warnBelow ?? "—"}</td>
                <td className="py-1.5">{t.criticalBelow ?? "—"}</td>
                <td className="py-1.5 text-right">
                  <form action={deleteAlertThreshold}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="text-xs text-accent-rose hover:text-accent-rose">Remove</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <form action={setAlertThreshold} className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-ink-soft">
            Client
            <select name="clientId" className={`mt-1 block ${inputCls}`} required>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-ink-soft">
            Metric
            <select name="metricKey" className={`mt-1 block ${inputCls}`} required>
              {ALERT_METRIC_KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-ink-soft">
            Warn below
            <input name="warnBelow" type="number" step="any" className={`mt-1 block w-28 ${inputCls}`} />
          </label>
          <label className="text-xs text-ink-soft">
            Critical below
            <input name="criticalBelow" type="number" step="any" className={`mt-1 block w-28 ${inputCls}`} />
          </label>
          <button className={btnCls}>Save</button>
        </form>
      </section>
    </div>
  );
}
