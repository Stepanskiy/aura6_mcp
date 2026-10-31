// Агрегація звітів. Чиста логіка без React: факти (робота × часовий кошик) → дерево рядків × колонки.
import type { Carrier, Client, Brand, Contractor, Direction, Format, Manager, PlanVersion, Project, Work, WorkType, ID } from "../../domain/types";
import { latestVersion, margin, overlaps, round2 } from "../../domain/calc";
import type { ReportDimension, ReportMeasure } from "../../shell/routes";

export const TIME_DIMS: ReportDimension[] = ["month", "quarter", "year"];
const isTime = (d: ReportDimension) => TIME_DIMS.includes(d);

export interface Filters {
  client?: ID;
  brand?: ID;
  direction?: ID;
  mediaType?: string;
  contractor?: ID;
  manager?: ID;
  status?: string;
  closed?: "closed" | "open";
  /** Код проєкту. */
  project?: string;
}

export interface ReportConfig {
  from?: string;
  to?: string;
  rows: ReportDimension[];
  col?: ReportDimension;
  measures: ReportMeasure[];
  prorate: boolean;
  filters: Filters;
  preset?: string;
}

export interface EngineCtx {
  works: Work[];
  projects: Map<ID, Project>;
  clients: Map<ID, Client>;
  brands: Map<ID, Brand>;
  contractors: Map<ID, Contractor>;
  carriers: Map<ID, Carrier>;
  formats: Map<ID, Format>;
  directions: Map<ID, Direction>;
  workTypes: Map<ID, WorkType>;
  managers: Map<ID, Manager>;
  /** workId → дохід у останній версії плану свого проєкту. */
  plan: Map<ID, number>;
  invoiced: Map<ID, number>;
}

export function buildPlanIncome(versions: PlanVersion[], projectIds: ID[]): Map<ID, number> {
  const m = new Map<ID, number>();
  for (const pid of projectIds) {
    const v = latestVersion(versions, pid);
    if (v) for (const w of v.works) m.set(w.id, w.income);
  }
  return m;
}

// ---------- дати ----------
const dayNum = (iso: string) => Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5);
const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS = ["січ", "лют", "бер", "кві", "тра", "чер", "лип", "сер", "вер", "жов", "лис", "гру"];

interface Bucket { key: string; s: number; e: number }

function bucketsOf(dim: ReportDimension, a: number, b: number): Bucket[] {
  const unit = dim === "month" ? 1 : dim === "quarter" ? 3 : 12;
  const out: Bucket[] = [];
  const d = new Date(a * 864e5);
  let y = d.getUTCFullYear();
  let m = dim === "month" ? d.getUTCMonth() : dim === "quarter" ? Math.floor(d.getUTCMonth() / 3) * 3 : 0;
  for (let guard = 0; guard < 600; guard++) {
    const s = Date.UTC(y, m, 1) / 864e5;
    if (s > b) break;
    const e = Date.UTC(y, m + unit, 1) / 864e5 - 1;
    const key = dim === "month" ? `${y}-${pad(m + 1)}` : dim === "quarter" ? `${y}-Q${m / 3 + 1}` : `${y}`;
    out.push({ key, s: Math.max(s, a), e: Math.min(e, b) });
    const nd = new Date(Date.UTC(y, m + unit, 1));
    y = nd.getUTCFullYear();
    m = nd.getUTCMonth();
  }
  return out;
}

function timeLabel(dim: ReportDimension, key: string): string {
  if (dim === "month") return `${MONTHS[+key.slice(5, 7) - 1]} ${key.slice(0, 4)}`;
  if (dim === "quarter") return `${key.slice(5)} ${key.slice(0, 4)}`;
  return key;
}

const STATUS: Record<string, string> = { draft: "Чернетка", active: "Активний", closed: "Закритий" };

// ---------- значення вимірів ----------
interface DV { key: string; label: string }
const NONE: DV = { key: "", label: "— не вказано —" };

export function mediaOf(w: Work, ctx: EngineCtx): string {
  const car = w.carrierId ? ctx.carriers.get(w.carrierId) : undefined;
  if (car) return car.mediaType;
  const wt = ctx.workTypes.get(w.workTypeId);
  if (wt?.mediaType) return wt.mediaType;
  const f = w.formatId ? ctx.formats.get(w.formatId) : undefined;
  if (f) return f.mediaType;
  if (wt?.kind === "production") return "Production";
  if (wt?.kind === "agency") return "Agency";
  return "";
}

export function contractorOf(w: Work, ctx: EngineCtx): ID | undefined {
  return w.contractorId ?? (w.carrierId ? ctx.carriers.get(w.carrierId)?.contractorId : undefined);
}

function ref<T extends { id: ID; name: string }>(m: Map<ID, T>, id: ID | undefined): DV {
  if (!id) return NONE;
  const x = m.get(id);
  return x ? { key: id, label: x.name } : NONE;
}

function dimValue(dim: ReportDimension, w: Work, ctx: EngineCtx): DV {
  const p = ctx.projects.get(w.projectId);
  switch (dim) {
    case "client": return ref(ctx.clients, p?.clientId);
    case "brand": return ref(ctx.brands, p?.brandId);
    case "project": return p ? { key: p.id, label: `${p.code} · ${p.name}` } : NONE;
    case "direction": return ref(ctx.directions, p?.directionId);
    case "manager": return ref(ctx.managers, p?.managerId);
    case "workType": return ref(ctx.workTypes, w.workTypeId);
    case "mediaType": { const m = mediaOf(w, ctx); return m ? { key: m, label: m } : NONE; }
    case "carrier": return ref(ctx.carriers, w.carrierId);
    case "format": return ref(ctx.formats, w.formatId);
    case "contractor": return ref(ctx.contractors, contractorOf(w, ctx));
    case "status": return p ? { key: p.status, label: STATUS[p.status] ?? p.status } : NONE;
    default: return NONE;
  }
}

// ---------- акумулятори ----------
export interface Acc {
  income: number; cost: number; planIncome: number; invoiced: number; closedIncome: number; closedCost: number;
  ids: Set<ID>;
}
const newAcc = (): Acc => ({ income: 0, cost: 0, planIncome: 0, invoiced: 0, closedIncome: 0, closedCost: 0, ids: new Set() });

export interface Fact {
  work: Work;
  /** Частка роботи, що потрапила у цей кошик (1 без розподілу). */
  w: number;
  income: number; cost: number; planIncome: number; invoiced: number;
  dims: Partial<Record<ReportDimension, DV>>;
}

function addFact(a: Acc, f: Fact) {
  a.income += f.income;
  a.cost += f.cost;
  a.planIncome += f.planIncome;
  a.invoiced += f.invoiced;
  if (f.work.closed) { a.closedIncome += f.income; a.closedCost += f.cost; }
  a.ids.add(f.work.id);
}

export function measureValue(a: Acc, m: ReportMeasure): number | undefined {
  switch (m) {
    case "income": return a.income;
    case "cost": return a.cost;
    case "margin": return a.income - a.cost;
    case "marginPct": return margin(a.income, a.cost).pct;
    case "planIncome": return a.planIncome;
    case "deltaIncome": return a.income - a.planIncome;
    case "invoiced": return a.invoiced;
    case "uninvoiced": return a.income - a.invoiced;
    case "closedIncome": return a.closedIncome;
    case "closedCost": return a.closedCost;
    case "works": return a.ids.size;
  }
}

export const isMoneyMeasure = (m: ReportMeasure) => m !== "marginPct" && m !== "works";

export interface Node {
  id: string;
  level: number; // 0 = корінь (всього)
  dim?: ReportDimension;
  key: string;
  label: string;
  acc: Acc;
  cols: Map<string, Acc>;
  children: Node[];
  /** Факти — тільки у листках. */
  facts: Fact[];
  leaf: boolean;
}

export interface Report {
  rows: ReportDimension[];
  col?: ReportDimension;
  colKeys: { key: string; label: string }[];
  measures: ReportMeasure[];
  root: Node;
  worksCount: number;
}

function passes(w: Work, ctx: EngineCtx, f: Filters): boolean {
  const p = ctx.projects.get(w.projectId);
  if (!p) return false;
  if (f.project && p.code !== f.project) return false;
  if (f.client && p.clientId !== f.client) return false;
  if (f.brand && p.brandId !== f.brand) return false;
  if (f.direction && p.directionId !== f.direction) return false;
  if (f.manager && p.managerId !== f.manager) return false;
  if (f.status && p.status !== f.status) return false;
  if (f.contractor && contractorOf(w, ctx) !== f.contractor) return false;
  if (f.mediaType && mediaOf(w, ctx) !== f.mediaType) return false;
  if (f.closed === "closed" && !w.closed) return false;
  if (f.closed === "open" && w.closed) return false;
  return true;
}

export function buildFacts(ctx: EngineCtx, cfg: ReportConfig): Fact[] {
  const used = [...cfg.rows, ...(cfg.col ? [cfg.col] : [])];
  const plain = used.filter((d) => !isTime(d));
  const timeDims = used.filter(isTime);
  const facts: Fact[] = [];
  const lo = cfg.from ? dayNum(cfg.from) : -Infinity;
  const hi = cfg.to ? dayNum(cfg.to) : Infinity;

  for (const work of ctx.works) {
    if (!overlaps(work, cfg.from || undefined, cfg.to || undefined)) continue;
    if (!passes(work, ctx, cfg.filters)) continue;
    const ws = dayNum(work.periodStart);
    const we = Math.max(ws, dayNum(work.periodEnd));
    const total = we - ws + 1;
    const base: Fact["dims"] = {};
    for (const d of plain) base[d] = dimValue(d, work, ctx);
    const planInc = ctx.plan.get(work.id) ?? 0;
    const inv = ctx.invoiced.get(work.id) ?? 0;
    const mk = (w: number, dims: Fact["dims"]) =>
      facts.push({ work, w, income: work.income * w, cost: work.cost * w, planIncome: planInc * w, invoiced: inv * w, dims });

    if (!cfg.prorate) {
      const dims = { ...base };
      for (const d of timeDims) {
        const b = bucketsOf(d, ws, ws)[0];
        dims[d] = { key: b.key, label: timeLabel(d, b.key) };
      }
      mk(1, dims);
      continue;
    }
    const a0 = Math.max(ws, lo);
    const b0 = Math.min(we, hi);
    if (a0 > b0) continue;
    let combos: { dims: Fact["dims"]; s: number; e: number }[] = [{ dims: base, s: a0, e: b0 }];
    for (const d of timeDims) {
      const next: typeof combos = [];
      for (const c of combos) {
        for (const b of bucketsOf(d, c.s, c.e)) {
          next.push({ dims: { ...c.dims, [d]: { key: b.key, label: timeLabel(d, b.key) } }, s: b.s, e: b.e });
        }
      }
      combos = next;
    }
    for (const c of combos) mk((c.e - c.s + 1) / total, c.dims);
  }
  return facts;
}

export function runReport(ctx: EngineCtx, cfg: ReportConfig): Report {
  const facts = buildFacts(ctx, cfg);
  const mkNode = (id: string, level: number, dim: ReportDimension | undefined, key: string, label: string, leaf: boolean): Node => ({
    id, level, dim, key, label, acc: newAcc(), cols: new Map(), children: [], facts: [], leaf,
  });
  const root = mkNode("root", 0, undefined, "", "Всього", cfg.rows.length === 0);
  const index = new Map<string, Node>();
  const colMap = new Map<string, string>();

  for (const f of facts) {
    const ck = cfg.col ? f.dims[cfg.col]!.key : "";
    if (cfg.col) colMap.set(ck, f.dims[cfg.col]!.label);
    const touch = (n: Node) => {
      addFact(n.acc, f);
      if (cfg.col) {
        let c = n.cols.get(ck);
        if (!c) n.cols.set(ck, (c = newAcc()));
        addFact(c, f);
      }
    };
    touch(root);
    let parent = root;
    let path = "";
    cfg.rows.forEach((d, i) => {
      const v = f.dims[d]!;
      path += "/" + v.key;
      let n = index.get(path);
      if (!n) {
        n = mkNode(path, i + 1, d, v.key, v.label, i === cfg.rows.length - 1);
        index.set(path, n);
        parent.children.push(n);
      }
      touch(n);
      parent = n;
    });
    parent.facts.push(f);
  }

  const first = cfg.measures[0] ?? "income";
  const sortNode = (n: Node) => {
    if (n.children.length) {
      const d = n.children[0].dim!;
      if (isTime(d)) n.children.sort((a, b) => a.key.localeCompare(b.key));
      else n.children.sort((a, b) => (measureValue(b.acc, first) ?? -Infinity) - (measureValue(a.acc, first) ?? -Infinity) || a.label.localeCompare(b.label, "uk"));
      n.children.forEach(sortNode);
    }
  };
  sortNode(root);

  const colKeys = [...colMap.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => (cfg.col && isTime(cfg.col) ? a.key.localeCompare(b.key) : a.label.localeCompare(b.label, "uk")));

  return { rows: cfg.rows, col: cfg.col, colKeys, measures: cfg.measures, root, worksCount: root.acc.ids.size };
}

// ---------- плоска таблиця ----------
/** Видимі рядки дерева з урахуванням згорнутих груп. */
export function flatten(root: Node, collapsed?: Set<string>): { node: Node; depth: number }[] {
  const out: { node: Node; depth: number }[] = [];
  const walk = (n: Node) => {
    for (const c of n.children) {
      out.push({ node: c, depth: c.level - 1 });
      if (!collapsed || !collapsed.has(c.id)) walk(c);
    }
  };
  walk(root);
  return out;
}

/** Таблиця для експорту: усі рядки, групові — як підсумки. */
export function flatTable(rep: Report, dimNames: Record<string, string>, measureNames: Record<string, string>): (string | number)[][] {
  const head: (string | number)[] = rep.rows.map((d) => dimNames[d]);
  if (!rep.rows.length) head.push("Рядок");
  const colGroups = rep.col ? [...rep.colKeys.map((c) => c.label), "Разом"] : [""];
  for (const g of colGroups) for (const m of rep.measures) head.push(g ? `${g} · ${measureNames[m]}` : measureNames[m]);
  const val = (a: Acc | undefined, m: ReportMeasure): string | number => {
    if (!a) return m === "marginPct" ? "" : 0;
    const v = measureValue(a, m);
    if (v === undefined) return "";
    return m === "marginPct" ? Math.round(v * 1000) / 10 : m === "works" ? v : round2(v);
  };
  const line = (n: Node, labels: (string | number)[]) => {
    const r = [...labels];
    if (rep.col) for (const c of rep.colKeys) for (const m of rep.measures) r.push(val(n.cols.get(c.key), m));
    for (const m of rep.measures) r.push(val(n.acc, m));
    return r;
  };
  const out: (string | number)[][] = [head];
  const walk = (n: Node, anc: Node[]) => {
    for (const c of n.children) {
      const chain = [...anc, c];
      const labels: (string | number)[] = chain.map((x) => x.label);
      while (labels.length < rep.rows.length) labels.push("");
      if (!c.leaf) labels[c.level - 1] = `Разом: ${c.label}`;
      out.push(line(c, labels));
      walk(c, chain);
    }
  };
  walk(rep.root, []);
  const tl: (string | number)[] = rep.rows.length ? rep.rows.map((_, i) => (i === 0 ? "Всього" : "")) : ["Всього"];
  out.push(line(rep.root, tl));
  return out;
}
