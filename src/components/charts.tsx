"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS = { stroke: "#6C6C74", fontSize: 11 };
const GRID = "rgba(255,255,255,0.06)";
const TOOLTIP = {
  background: "#17181C",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 10,
  fontSize: 12,
  boxShadow: "0 16px 40px -12px rgba(0,0,0,0.65)",
};

function shortDate(d: string) {
  return d?.slice(5); // MM-DD
}

export function RevenueTrendChart({
  data,
}: {
  data: { date: string; revenue: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} />
        <Tooltip contentStyle={TOOLTIP} labelStyle={{ color: "#9AA3B8" }} cursor={{ stroke: GRID }} />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#3B82F6"
          strokeWidth={2}
          fill="url(#revFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

const PIE_COLORS: Record<string, string> = {
  closed: "#3B82F6",
  rescheduled: "#60A5FA",
  lost: "#FB7185",
  no_show: "#646E86",
};

export function OutcomePie({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return <p className="py-14 text-center text-sm text-ink-faint">No calls yet.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={54}
          outerRadius={92}
          paddingAngle={2}
          stroke="none"
        >
          {data.map((d) => (
            <Cell key={d.name} fill={PIE_COLORS[d.name] ?? "#6C6C74"} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Two-series area chart (e.g. revenue vs cash collected). */
export function DualAreaChart({
  data,
  keys,
}: {
  data: { date: string; [k: string]: number | string }[];
  keys: { key: string; label: string; color: string }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          {keys.map((k) => (
            <linearGradient key={k.key} id={`fill-${k.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={k.color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={k.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} />
        <Tooltip contentStyle={TOOLTIP} labelStyle={{ color: "#9AA3B8" }} cursor={{ stroke: GRID }} />
        <Legend wrapperStyle={{ fontSize: 11, color: "#9AA3B8" }} />
        {keys.map((k) => (
          <Area
            key={k.key}
            type="monotone"
            dataKey={k.key}
            name={k.label}
            stroke={k.color}
            strokeWidth={2}
            fill={`url(#fill-${k.key})`}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bar chart for category breakdowns (revenue by source, spend by campaign). */
export function HBarChart({
  data,
  color = "#3B82F6",
  height = 220,
}: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
}) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-ink-faint">No data.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="label" tick={AXIS} tickLine={false} axisLine={false} width={96} />
        <Tooltip contentStyle={TOOLTIP} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Lightweight CSS conversion funnel with step-to-step conversion %. */
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(...steps.map((s) => s.value), 1);
  return (
    <div className="space-y-2 py-2">
      {steps.map((s, i) => {
        const widthPct = Math.max(6, (s.value / max) * 100);
        const conv =
          i > 0 && steps[i - 1].value > 0
            ? Math.round((s.value / steps[i - 1].value) * 100)
            : null;
        return (
          <div key={s.label} className="flex items-center gap-3">
            <div className="w-24 shrink-0 text-right text-xs text-ink-soft">{s.label}</div>
            <div className="flex-1">
              <div
                className="flex h-9 items-center justify-end rounded-md bg-gradient-to-r from-brand/50 to-brand px-2 text-xs font-medium text-white transition-all"
                style={{ width: `${widthPct}%` }}
              >
                {s.value.toLocaleString()}
              </div>
            </div>
            <div className="w-10 shrink-0 text-xs text-ink-faint">
              {conv !== null ? `${conv}%` : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SeriesBarChart({
  data,
  dataKey,
  color = "#3B82F6",
}: {
  data: { date: string; [k: string]: number | string }[];
  dataKey: string;
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} />
        <Tooltip contentStyle={TOOLTIP} labelStyle={{ color: "#A0A0A8" }} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
