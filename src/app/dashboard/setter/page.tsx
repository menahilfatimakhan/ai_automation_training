import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { isClientViewer } from "@/lib/access";
import { resolveClientScope } from "@/lib/data/client-scope";
import { loadSetterActivity } from "@/lib/data/dashboards";
import { loadNotifications } from "@/lib/data/notifications";
import { AiPanel } from "@/components/AiPanel";
import { computeSetterKpis } from "@/lib/kpi/engine";
import { daysAgoIso, todayIso, formatPercent, formatNumber } from "@/lib/format";
import { LogDayForm } from "@/components/LogDayForm";
import { SeriesBarChart } from "@/components/charts";
import { ClientSwitcher } from "@/components/ClientSwitcher";

export default async function SetterDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");

  const { client } = await searchParams;
  const { active, options } = await resolveClientScope(ctx, client);
  if (!active) return <p className="text-ink-soft">No client available.</p>;

  const rows = await loadSetterActivity(active.id, daysAgoIso(29), todayIso());
  const kpis = computeSetterKpis(rows);
  const trend = rows.map((r) => ({ date: r.date, callsBooked: r.callsBooked }));
  const notifications = await loadNotifications(active.id);
  const readOnly = !ctx.isAdmin && isClientViewer(ctx, active.id);

  const cards = [
    { label: "Conversations", value: formatNumber(kpis.conversations) },
    { label: "Replies", value: formatNumber(kpis.replies) },
    { label: "Proposals", value: formatNumber(kpis.proposals) },
    { label: "Calls booked", value: formatNumber(kpis.callsBooked) },
    { label: "Reply rate", value: formatPercent(kpis.replyRate) },
    { label: "Proposal rate", value: formatPercent(kpis.proposalRate) },
    { label: "Booking rate", value: formatPercent(kpis.bookingRate) },
  ];

  const recent = [...rows].reverse().slice(0, 7);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Setter dashboard</h1>
          <p className="text-sm text-ink-soft">{active.name} · last 30 days</p>
        </div>
        <ClientSwitcher options={options} activeId={active.id} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {cards.map((c) => (
          <div
            key={c.label}
            className="card p-3"
          >
            <div className="text-xs text-ink-soft">{c.label}</div>
            <div className="mt-1 text-lg font-semibold">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-medium text-ink-soft">Log a day</h2>
          <LogDayForm clientId={active.id} />
        </section>

        <section className="card p-4">
          <h2 className="mb-3 text-sm font-medium text-ink-soft">
            Calls booked (trend)
          </h2>
          <SeriesBarChart data={trend} dataKey="callsBooked" color="#3b82f6" />
        </section>
      </div>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-medium text-ink-soft">
          Recent days (editable — re-log a date to update it)
        </h2>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-ink-faint">
            <tr>
              <th className="py-1">Date</th>
              <th className="py-1">Conv.</th>
              <th className="py-1">Replies</th>
              <th className="py-1">Proposals</th>
              <th className="py-1">Booked</th>
              <th className="py-1">Follow-ups</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="py-1.5">{r.date}</td>
                <td className="py-1.5">{r.conversations}</td>
                <td className="py-1.5">{r.replies}</td>
                <td className="py-1.5">{r.proposals}</td>
                <td className="py-1.5">{r.callsBooked}</td>
                <td className="py-1.5">{r.followUps}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <AiPanel clientId={active.id} notifications={notifications} readOnly={readOnly} />
    </div>
  );
}
