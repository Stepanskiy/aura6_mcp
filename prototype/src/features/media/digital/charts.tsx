import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtDate, fmtMoney0 } from "../../../domain/calc";
import { CHART_GRID, CHART_PLAN, CHART_SERIES } from "../util";
import { fmtCompact } from "./model";

const INK = "#475569";
const tick = { fill: INK, fontSize: 11 };

export interface PacingPoint {
  d: string;
  fact?: number;
  plan?: number;
}

interface TipProps {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; payload?: { name?: string } }[];
  label?: string;
  title?: (l: string | undefined) => string;
  unit?: string;
}

function Tip({ active, payload, label, title, unit }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-violet-100 bg-white px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-slate-800">{title ? title(label) : label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-slate-700">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums">{fmtMoney0(p.value)}{unit ?? ""}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { name: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-4 text-xs text-slate-700">
      {items.map((i) => (
        <span key={i.name} className="flex items-center gap-1.5">
          <svg width="22" height="8" aria-hidden>
            <line x1="0" x2="22" y1="4" y2="4" stroke={i.color} strokeWidth="2" strokeDasharray={i.dashed ? "5 3" : undefined} />
          </svg>
          {i.name}
        </span>
      ))}
    </div>
  );
}

export function PacingChart({ data, hasFact }: { data: PacingPoint[]; hasFact: boolean }) {
  return (
    <div>
      <Legend items={[...(hasFact ? [{ name: "Факт: покази за день", color: CHART_SERIES[0] }] : []), { name: "План: рівномірний темп", color: CHART_PLAN, dashed: true }]} />
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CHART_GRID} vertical={false} />
            <XAxis dataKey="d" tick={tick} tickLine={false} axisLine={{ stroke: CHART_GRID }} tickFormatter={(v: string) => v.slice(8) + "." + v.slice(5, 7)} minTickGap={36} />
            <YAxis tick={tick} tickLine={false} axisLine={false} width={72} tickFormatter={fmtCompact} />
            <Tooltip content={<Tip title={(l) => fmtDate(l)} />} cursor={{ stroke: "#94a3b8", strokeWidth: 1 }} />
            <Line name="План" type="monotone" dataKey="plan" stroke={CHART_PLAN} strokeWidth={2} strokeDasharray="5 3" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            {hasFact && <Line name="Факт" type="monotone" dataKey="fact" stroke={CHART_SERIES[0]} strokeWidth={2} dot={data.filter((x) => x.fact !== undefined).length < 3} activeDot={{ r: 4 }} isAnimationActive={false} />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export interface SpendBar {
  name: string;
  value: number;
  color: string;
}

export function SpendChart({ data, label }: { data: SpendBar[]; label: string }) {
  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART_GRID} vertical={false} />
          <XAxis dataKey="name" tick={tick} tickLine={false} axisLine={{ stroke: CHART_GRID }} />
          <YAxis tick={tick} tickLine={false} axisLine={false} width={72} tickFormatter={fmtCompact} />
          <Tooltip content={<Tip unit=" грн" />} cursor={{ fill: "rgba(148,163,184,0.12)" }} />
          <Bar name={label} dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
