// Чисті функції над даними. Без побічних ефектів, щоб їх можна було перенести на сервер.
import type { DataState, ID, Invoice, PlanVersion, Project, Work, WorkSnapshot } from "./types";

export const VAT_RATE = 0.2;

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function newId(prefix = ""): ID {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nowIso(): string {
  return new Date().toISOString();
}

const uah = new Intl.NumberFormat("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const uah0 = new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 });

/** 1 234 567,89 */
export function fmtMoney(n: number | undefined): string {
  return uah.format(n ?? 0);
}

/** 1 234 568 — для звітів і підсумків. */
export function fmtMoney0(n: number | undefined): string {
  return uah0.format(n ?? 0);
}

export function fmtPct(n: number | undefined): string {
  if (n === undefined || !isFinite(n)) return "—";
  return (n * 100).toFixed(1).replace(".", ",") + "%";
}

export function fmtDate(iso: string | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

export function margin(income: number, cost: number) {
  const value = round2(income - cost);
  return { value, pct: income ? value / income : undefined };
}

/** Перетин періоду роботи з періодом [from, to]. */
export function overlaps(w: Pick<Work, "periodStart" | "periodEnd">, from?: string, to?: string): boolean {
  if (from && w.periodEnd < from) return false;
  if (to && w.periodStart > to) return false;
  return true;
}

/** Виставлено по кожній роботі (сума рядків рахунків). */
export function invoicedByWork(invoices: Invoice[], exceptInvoiceId?: ID): Map<ID, number> {
  const m = new Map<ID, number>();
  for (const inv of invoices) {
    if (inv.id === exceptInvoiceId) continue;
    for (const l of inv.lines) m.set(l.workId, round2((m.get(l.workId) ?? 0) + l.amount));
  }
  return m;
}

/** Невиставлений залишок роботи. */
export function uninvoiced(work: Work, invoiced: Map<ID, number>): number {
  return round2(work.income - (invoiced.get(work.id) ?? 0));
}

export function projectWorks(state: Pick<DataState, "works">, projectId: ID): Work[] {
  return state.works.filter((w) => w.projectId === projectId);
}

export interface Totals {
  income: number;
  cost: number;
  margin: number;
  marginPct?: number;
  closedIncome: number;
  closedCost: number;
  invoiced: number;
  uninvoiced: number;
}

export function totals(works: Work[], invoiced: Map<ID, number>): Totals {
  let income = 0, cost = 0, closedIncome = 0, closedCost = 0, inv = 0;
  for (const w of works) {
    income += w.income;
    cost += w.cost;
    if (w.closed) {
      closedIncome += w.income;
      closedCost += w.cost;
    }
    inv += invoiced.get(w.id) ?? 0;
  }
  const m = margin(income, cost);
  return {
    income: round2(income),
    cost: round2(cost),
    margin: m.value,
    marginPct: m.pct,
    closedIncome: round2(closedIncome),
    closedCost: round2(closedCost),
    invoiced: round2(inv),
    uninvoiced: round2(income - inv),
  };
}

export function snapshotOf(w: Work): WorkSnapshot {
  const { id, workTypeId, carrierId, formatId, contractorId, periodStart, periodEnd, description, income, cost } = w;
  return { id, workTypeId, carrierId, formatId, contractorId, periodStart, periodEnd, description, income, cost };
}

export function latestVersion(versions: PlanVersion[], projectId: ID): PlanVersion | undefined {
  return versions.filter((v) => v.projectId === projectId).sort((a, b) => b.number - a.number)[0];
}

/**
 * Чи суттєва зміна відносно останньої версії плану:
 * зміна суми доходів або суми витрат проєкту більша за поріг (%).
 */
export function isSignificantChange(base: PlanVersion | undefined, works: Work[], thresholdPct: number): { significant: boolean; reason?: string } {
  if (!base) return { significant: false };
  const bi = base.works.reduce((s, w) => s + w.income, 0);
  const bc = base.works.reduce((s, w) => s + w.cost, 0);
  const ci = works.reduce((s, w) => s + w.income, 0);
  const cc = works.reduce((s, w) => s + w.cost, 0);
  const di = bi ? Math.abs(ci - bi) / bi : ci ? 1 : 0;
  const dc = bc ? Math.abs(cc - bc) / bc : cc ? 1 : 0;
  const t = thresholdPct / 100;
  if (di > t) return { significant: true, reason: `Дохід змінився на ${fmtPct(di)} (поріг ${thresholdPct}%)` };
  if (dc > t) return { significant: true, reason: `Затрати змінились на ${fmtPct(dc)} (поріг ${thresholdPct}%)` };
  return { significant: false };
}

export interface WorkDiff {
  workId: ID;
  kind: "added" | "removed" | "changed" | "same";
  base?: WorkSnapshot;
  current?: WorkSnapshot;
  dIncome: number;
  dCost: number;
}

/** Порівняння версії плану з поточним медіапланом або з іншою версією. */
export function diffWorks(base: WorkSnapshot[], current: WorkSnapshot[]): WorkDiff[] {
  const b = new Map(base.map((w) => [w.id, w]));
  const c = new Map(current.map((w) => [w.id, w]));
  const out: WorkDiff[] = [];
  for (const [id, cw] of c) {
    const bw = b.get(id);
    if (!bw) out.push({ workId: id, kind: "added", current: cw, dIncome: cw.income, dCost: cw.cost });
    else {
      const same = JSON.stringify(bw) === JSON.stringify(cw);
      out.push({ workId: id, kind: same ? "same" : "changed", base: bw, current: cw, dIncome: round2(cw.income - bw.income), dCost: round2(cw.cost - bw.cost) });
    }
  }
  for (const [id, bw] of b) if (!c.has(id)) out.push({ workId: id, kind: "removed", base: bw, dIncome: -bw.income, dCost: -bw.cost });
  return out;
}

/** Наступний код проєкту для клієнта: KST-0013. */
export function nextProjectCode(projects: Project[], prefix: string): string {
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;
  for (const p of projects) {
    const m = p.code.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

/** Наступний номер рахунку: РК-2026-0042. */
export function nextInvoiceNumber(invoices: Invoice[], year = new Date().getFullYear()): string {
  const re = new RegExp(`^РК-${year}-(\\d+)$`);
  let max = 0;
  for (const i of invoices) {
    const m = i.number.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `РК-${year}-${String(max + 1).padStart(4, "0")}`;
}

export function byId<T extends { id: ID }>(items: T[]): Map<ID, T> {
  return new Map(items.map((x) => [x.id, x]));
}

/** Нормалізація назви для зіставлення з довідниками: регістр, пробіли, лапки. */
export function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[«»"'`’ʼ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
