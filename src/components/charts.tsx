"use client";

import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS = { stroke: "#525252", fontSize: 11 };
const GRID = "#262626";

export function RevenueTrendChart({
  data,
}: {
  data: { date: string; revenue: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} width={48} />
        <Tooltip
          contentStyle={{ background: "#0a0a0a", border: "1px solid #262626", fontSize: 12 }}
          labelStyle={{ color: "#a3a3a3" }}
        />
        <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

const PIE_COLORS: Record<string, string> = {
  closed: "#10b981",
  rescheduled: "#3b82f6",
  lost: "#ef4444",
  no_show: "#a3a3a3",
};

export function OutcomePie({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return <p className="py-12 text-center text-sm text-neutral-500">No calls yet.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={88}>
          {data.map((d) => (
            <Cell key={d.name} fill={PIE_COLORS[d.name] ?? "#737373"} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: "#0a0a0a", border: "1px solid #262626", fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function SeriesBarChart({
  data,
  dataKey,
  color = "#10b981",
}: {
  data: { date: string; [k: string]: number | string }[];
  dataKey: string;
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} width={48} />
        <Tooltip
          contentStyle={{ background: "#0a0a0a", border: "1px solid #262626", fontSize: 12 }}
          labelStyle={{ color: "#a3a3a3" }}
        />
        <Bar dataKey={dataKey} fill={color} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
