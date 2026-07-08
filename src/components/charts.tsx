"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ComposedChart,
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
  closed: "#34D399",
  rescheduled: "#FBBF24",
  showed_not_closed: "#FB7185",
  no_show: "#646E86",
};

/**
 * Closed deals (bars, right axis) + revenue (line, left axis) over a window.
 * The two-axis view shows deal volume and value together.
 */
export function DealsRevenueChart({
  data,
}: {
  data: { date: string; deals: number; revenue: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="dealRev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis yAxisId="rev" tick={AXIS} tickLine={false} axisLine={false} width={48} />
        <YAxis yAxisId="deals" orientation="right" tick={AXIS} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP} labelStyle={{ color: "#9AA3B8" }} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Legend wrapperStyle={{ fontSize: 11, color: "#9AA3B8" }} />
        <Bar yAxisId="deals" dataKey="deals" name="Deals closed" fill="#34D399" radius={[3, 3, 0, 0]} maxBarSize={10} opacity={0.8} />
        <Area yAxisId="rev" type="monotone" dataKey="revenue" name="Revenue" stroke="#3B82F6" strokeWidth={2} fill="url(#dealRev)" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

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

/** 30-day activity heatmap (e.g. Setter dashboard) — one cell per day, darker = busier. */
export function Heatmap({ data }: { data: { date: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex flex-wrap gap-1">
      {data.map((d) => {
        const intensity = d.value / max;
        const bg =
          d.value === 0
            ? "bg-surface-sunken"
            : intensity > 0.75
              ? "bg-brand"
              : intensity > 0.5
                ? "bg-brand/70"
                : intensity > 0.25
                  ? "bg-brand/40"
                  : "bg-brand/20";
        return (
          <div
            key={d.date}
            title={`${d.date}: ${d.value}`}
            className={`h-4 w-4 rounded-sm ${bg}`}
          />
        );
      })}
    </div>
  );
}

/** Tiny inline trend line for KPI cards — no axes, grid, or tooltip. */
export function Sparkline({ data, color = "#3B82F6" }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return <div className="h-11" />;
  const chartData = data.map((v, i) => ({ i, v }));
  const id = `spark-${color.replace("#", "")}`;
  return (
    <ResponsiveContainer width="100%" height={44}>
      <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${id})`} dot={false} isAnimationActive={false} />
      </AreaChart>
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
