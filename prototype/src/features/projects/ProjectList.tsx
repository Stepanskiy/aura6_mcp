import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "../../store";
import { fmtMoney0, fmtPct, margin, totals, type Totals } from "../../domain/calc";
import type { Project } from "../../domain/types";
import { Button, Empty, Input, Money, Page, Select, Stat, Table, clsx } from "../../ui";
import { resolveHint, useInvoiced, useRefs } from "../../shell/hooks";
import { StatusBadge, period } from "./common";

interface Row {
  p: Project;
  t: Totals;
  client: string;
  brand: string;
  direction: string;
  manager: string;
  closedPct: number;
}

type SortKey = "code" | "name" | "client" | "brand" | "direction" | "manager" | "period" | "status" | "income" | "cost" | "marginPct" | "invoiced" | "closedPct";

export function ProjectList() {
  const s = useStore();
  const refs = useRefs();
  const invoiced = useInvoiced();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "code", dir: 1 });

  const q = sp.get("q") ?? "";
  const clientObj = resolveHint(s.clients, sp.get("client"));
  const brandPool = clientObj ? s.brands.filter((b) => b.clientId === clientObj.id) : s.brands;
  const brandObj = resolveHint(brandPool, sp.get("brand"));
  const direction = sp.get("direction") ?? "";
  const manager = sp.get("manager") ?? "";
  const status = sp.get("status") ?? "";
  const year = Number(sp.get("year")) || 0;

  const years = useMemo(() => [...new Set(s.projects.map((p) => p.year))].sort((a, b) => b - a), [s.projects]);

  function set(patch: Record<string, string>) {
    const n = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v) n.set(k, v);
      else n.delete(k);
    }
    setSp(n, { replace: true });
  }

  const byProject = useMemo(() => {
    const m = new Map<string, typeof s.works>();
    for (const w of s.works) {
      const a = m.get(w.projectId);
      if (a) a.push(w);
      else m.set(w.projectId, [w]);
    }
    return m;
  }, [s.works]);

  const rows: Row[] = useMemo(
    () =>
      s.projects.map((p) => {
        const t = totals(byProject.get(p.id) ?? [], invoiced);
        return {
          p,
          t,
          client: refs.clients.get(p.clientId)?.name ?? "",
          brand: (p.brandId && refs.brands.get(p.brandId)?.name) || "",
          direction: (p.directionId && refs.directions.get(p.directionId)?.name) || "",
          manager: (p.managerId && refs.managers.get(p.managerId)?.name) || "",
          closedPct: t.income ? t.closedIncome / t.income : 0,
        };
      }),
    [s.projects, byProject, invoiced, refs],
  );

  const filtered = rows.filter((r) => {
    const ql = q.trim().toLowerCase();
    if (ql && !r.p.code.toLowerCase().includes(ql) && !r.p.name.toLowerCase().includes(ql)) return false;
    if (clientObj && r.p.clientId !== clientObj.id) return false;
    if (brandObj && r.p.brandId !== brandObj.id) return false;
    if (direction && r.p.directionId !== direction) return false;
    if (manager && r.p.managerId !== manager) return false;
    if (year && r.p.year !== year) return false;
    if (status && r.p.status !== status) return false;
    return true;
  });

  const value = (r: Row, k: SortKey): string | number => {
    switch (k) {
      case "code": return r.p.code;
      case "name": return r.p.name;
      case "period": return r.p.startDate ?? "";
      case "status": return r.p.status;
      case "income": return r.t.income;
      case "cost": return r.t.cost;
      case "marginPct": return r.t.marginPct ?? -1;
      case "invoiced": return r.t.invoiced;
      case "closedPct": return r.closedPct;
      default: return r[k];
    }
  };
  const sorted = [...filtered].sort((a, b) => {
    const x = value(a, sort.key), y = value(b, sort.key);
    return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "uk")) * sort.dir;
  });

  const all = totals(filtered.flatMap((r) => byProject.get(r.p.id) ?? []), invoiced);
  const m = margin(all.income, all.cost);

  const th = (k: SortKey, label: string, right?: boolean) => (
    <th
      className={clsx("cursor-pointer select-none whitespace-nowrap hover:text-slate-800", right && "text-right")}
      onClick={() => setSort((o) => ({ key: k, dir: o.key === k ? (o.dir === 1 ? -1 : 1) : 1 }))}
    >
      {label}
      {sort.key === k && <span className="ml-1 text-indigo-600">{sort.dir === 1 ? "▲" : "▼"}</span>}
    </th>
  );

  return (
    <Page
      title="Проєкти"
      subtitle={`${filtered.length} з ${s.projects.length}`}
      actions={<Button variant="primary" onClick={() => nav("/projects/new")}>＋ Новий проєкт</Button>}
    >
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Проєктів" value={filtered.length} />
        <Stat label="Дохід, грн" value={fmtMoney0(all.income)} />
        <Stat label="Маржа, грн" value={fmtMoney0(m.value)} sub={fmtPct(m.pct)} />
        <Stat label="Не виставлено, грн" value={fmtMoney0(all.uninvoiced)} sub={`виставлено ${fmtMoney0(all.invoiced)}`} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-4 xl:grid-cols-7">
        <Input placeholder="Пошук: код або назва" value={q} onChange={(e) => set({ q: e.target.value })} />
        <Select value={clientObj?.id ?? ""} onChange={(e) => set({ client: s.clients.find((c) => c.id === e.target.value)?.name ?? "", brand: "" })}>
          <option value="">Усі клієнти</option>
          {s.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select value={brandObj?.id ?? ""} onChange={(e) => set({ brand: s.brands.find((b) => b.id === e.target.value)?.name ?? "" })}>
          <option value="">Усі бренди</option>
          {brandPool.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <Select value={direction} onChange={(e) => set({ direction: e.target.value })}>
          <option value="">Усі напрями</option>
          {s.directions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
        <Select value={manager} onChange={(e) => set({ manager: e.target.value })}>
          <option value="">Усі менеджери</option>
          {s.managers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
        <Select value={year || ""} onChange={(e) => set({ year: e.target.value })}>
          <option value="">Усі роки</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
        <Select value={status} onChange={(e) => set({ status: e.target.value })}>
          <option value="">Усі статуси</option>
          <option value="draft">Чернетка</option>
          <option value="active">Активний</option>
          <option value="closed">Закритий</option>
        </Select>
      </div>

      {sorted.length === 0 ? (
        <Empty>Проєктів за цими умовами немає</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              {th("code", "Код")}{th("name", "Назва")}{th("client", "Клієнт")}{th("brand", "Бренд")}{th("direction", "Напрям")}
              {th("manager", "Менеджер")}{th("period", "Період")}{th("status", "Статус")}
              {th("income", "Дохід", true)}{th("cost", "Затрата", true)}{th("marginPct", "Маржа %", true)}{th("invoiced", "Виставлено", true)}{th("closedPct", "Закрито", true)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.p.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap font-medium"><Link className="text-indigo-600 hover:underline" to={`/projects/${r.p.code}`}>{r.p.code}</Link></td>
                <td>{r.p.name}</td>
                <td>{r.client}</td>
                <td>{r.brand}</td>
                <td>{r.direction}</td>
                <td>{r.manager}</td>
                <td className="whitespace-nowrap text-slate-500">{period(r.p.startDate, r.p.endDate)}</td>
                <td><StatusBadge status={r.p.status} /></td>
                <td className="text-right"><Money value={r.t.income} whole /></td>
                <td className="text-right"><Money value={r.t.cost} whole /></td>
                <td className="text-right tabular-nums">{fmtPct(r.t.marginPct)}</td>
                <td className="text-right"><Money value={r.t.invoiced} whole /></td>
                <td className="text-right tabular-nums">{fmtPct(r.closedPct)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-semibold">
              <td colSpan={8}>Разом ({sorted.length})</td>
              <td className="text-right"><Money value={all.income} whole /></td>
              <td className="text-right"><Money value={all.cost} whole /></td>
              <td className="text-right tabular-nums">{fmtPct(m.pct)}</td>
              <td className="text-right"><Money value={all.invoiced} whole /></td>
              <td className="text-right tabular-nums">{fmtPct(all.income ? all.closedIncome / all.income : undefined)}</td>
            </tr>
          </tfoot>
        </Table>
      )}
    </Page>
  );
}
