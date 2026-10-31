import { useMemo, useState } from "react";
import { Button, clsx } from "../../ui";
import { fmtMoney0, fmtPct } from "../../domain/calc";
import { REPORT_DIMENSIONS, REPORT_MEASURES, type ReportMeasure } from "../../shell/routes";
import { flatten, isMoneyMeasure, measureValue, type Acc, type Node, type Report } from "./engine";

export function fmtMeasure(m: ReportMeasure, v: number | undefined): string {
  if (v === undefined) return "—";
  if (m === "marginPct") return fmtPct(v);
  if (m === "works") return String(v);
  return fmtMoney0(v);
}

function Cell({ m, acc, bold }: { m: ReportMeasure; acc?: Acc; bold?: boolean }) {
  const v = acc ? measureValue(acc, m) : undefined;
  const zero = !acc || (v === 0 && m !== "works") || (m === "works" && !v);
  const neg = typeof v === "number" && v < -0.005 && m !== "works";
  const pos = m === "deltaIncome" && typeof v === "number" && v > 0.005;
  return (
    <td className={clsx("whitespace-nowrap text-right tabular-nums", bold && "font-semibold", neg && "text-red-600", pos && "text-emerald-600", zero && "text-slate-300")}>
      {zero && isMoneyMeasure(m) ? "–" : fmtMeasure(m, v)}
    </td>
  );
}

export function PivotTable({ report, onDrill }: { report: Report; onDrill: (n: Node) => void }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const rows = useMemo(() => flatten(report.root, collapsed), [report, collapsed]);
  const groups = report.col ? [...report.colKeys.map((c) => ({ key: c.key, label: c.label })), { key: "", label: "Разом" }] : [{ key: "", label: "" }];
  const multi = !!report.col;
  const allGroupIds = useMemo(() => {
    const ids: string[] = [];
    const walk = (n: Node) => n.children.forEach((c) => { if (!c.leaf) ids.push(c.id); walk(c); });
    walk(report.root);
    return ids;
  }, [report]);
  const toggle = (id: string) => setCollapsed((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const accOf = (n: Node, g: string) => (multi && g ? n.cols.get(g) : n.acc);
  const headLabel = report.rows.length ? report.rows.map((d) => REPORT_DIMENSIONS[d]).join(" → ") : "Показник";
  const renderCells = (n: Node, bold?: boolean) =>
    groups.map((g) => report.measures.map((m) => <Cell key={g.key + m} m={m} acc={accOf(n, g.key)} bold={bold} />));

  return (
    <div>
      {allGroupIds.length > 0 && (
        <div className="mb-2 flex gap-2">
          <Button variant="ghost" onClick={() => setCollapsed(new Set())}>Розгорнути все</Button>
          <Button variant="ghost" onClick={() => setCollapsed(new Set(allGroupIds))}>Згорнути все</Button>
        </div>
      )}
      <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 shadow-[0_1px_0_#e2e8f0]">
            <tr>
              <th rowSpan={multi && report.measures.length > 1 ? 2 : 1} className="sticky left-0 z-20 min-w-64 bg-slate-50 px-3 py-2 text-left">{headLabel}</th>
              {groups.map((g) => (
                <th key={g.key + "g"} colSpan={report.measures.length} className={clsx("px-3 py-2 text-right", multi && "border-l border-slate-200 text-center", g.key === "" && multi && "bg-slate-100")}>
                  {multi ? g.label : report.measures.length === 1 ? REPORT_MEASURES[report.measures[0]] : null}
                </th>
              ))}
            </tr>
            {(multi ? report.measures.length > 1 : report.measures.length > 1) && (
              <tr>
                {multi ? null : null}
                {groups.map((g) => report.measures.map((m) => (
                  <th key={g.key + m} className={clsx("whitespace-nowrap px-3 py-1.5 text-right", multi && m === report.measures[0] && "border-l border-slate-200")}>{REPORT_MEASURES[m]}</th>
                )))}
              </tr>
            )}
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={1 + groups.length * report.measures.length} className="px-3 py-8 text-center text-slate-400">За обраними умовами робіт немає</td></tr>
            )}
            {rows.map(({ node, depth }) => {
              const group = !node.leaf;
              return (
                <tr
                  key={node.id}
                  onClick={() => (group ? toggle(node.id) : onDrill(node))}
                  className={clsx("cursor-pointer border-t border-slate-100 hover:bg-indigo-50/60", group && depth === 0 ? "bg-slate-50 font-semibold" : group ? "bg-slate-50/50 font-medium" : "")}
                >
                  <td className="sticky left-0 z-[1] bg-inherit px-3 py-1.5" style={{ paddingLeft: 12 + depth * 20 }}>
                    <span className="inline-flex items-center gap-1.5">
                      {group ? <span className="w-3 text-xs text-slate-400">{collapsed.has(node.id) ? "▸" : "▾"}</span> : <span className="w-3" />}
                      <span>{node.label}</span>
                      {!group && <span className="text-xs text-indigo-400 opacity-0 group-hover:opacity-100">↗</span>}
                    </span>
                  </td>
                  {renderCells(node, group && depth === 0)}
                </tr>
              );
            })}
            <tr className="sticky bottom-0 border-t-2 border-slate-300 bg-slate-100 font-semibold" onClick={report.root.leaf ? () => onDrill(report.root) : undefined}>
              <td className="sticky left-0 bg-slate-100 px-3 py-2">Всього · робіт {report.worksCount}</td>
              {renderCells(report.root, true)}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-xs text-slate-400">Клік по групі згортає її, по кінцевому рядку — відкриває перелік робіт.</div>
    </div>
  );
}
