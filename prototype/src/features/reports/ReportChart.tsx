import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { REPORT_MEASURES } from "../../shell/routes";
import { measureValue, type Report } from "./engine";
import { fmtMeasure } from "./PivotTable";

const COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#ec4899", "#84cc16", "#64748b", "#f97316", "#06b6d4"];
const TOP = 15;

export function ReportChart({ report }: { report: Report }) {
  const m = report.measures[0];
  const stacked = !!report.col && m !== "marginPct";
  const { data, series } = useMemo(() => {
    const groups = report.rows.length ? report.root.children.slice(0, TOP) : [];
    const series = stacked ? report.colKeys : [{ key: "_v", label: REPORT_MEASURES[m] }];
    const data = groups.map((g) => {
      const row: Record<string, string | number | undefined> = { name: g.label };
      if (stacked) for (const c of report.colKeys) row[c.key] = measureValue(g.cols.get(c.key) ?? { income: 0, cost: 0, planIncome: 0, invoiced: 0, closedIncome: 0, closedCost: 0, ids: new Set() }, m);
      else row._v = measureValue(g.acc, m);
      return row;
    });
    return { data, series };
  }, [report, m, stacked]);

  if (!data.length) return <div className="py-8 text-center text-sm text-slate-400">Немає даних для діаграми (потрібен хоча б один вимір у рядках)</div>;
  const fmt = (v: unknown) => fmtMeasure(m, typeof v === "number" ? v : undefined);

  return (
    <div>
      <div className="mb-1 text-xs text-slate-500">
        {REPORT_MEASURES[m]} · {report.root.children.length > TOP ? `топ-${TOP} з ${report.root.children.length}` : "перший рівень групування"}
      </div>
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34 + 70)}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" tickFormatter={(v: number) => (m === "marginPct" ? fmtMeasure(m, v) : Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)} млн` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)} тис` : String(v))} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 12 }} interval={0} />
          <Tooltip formatter={(v) => fmt(v)} />
          {stacked && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} stackId={stacked ? "a" : undefined} fill={COLORS[i % COLORS.length]} radius={stacked ? 0 : [0, 4, 4, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
