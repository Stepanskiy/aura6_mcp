// Конфігурація звіту: пресети, швидкі періоди, обмін з URL.
import { REPORT_DIMENSIONS, REPORT_MEASURES, type ReportDimension, type ReportMeasure } from "../../shell/routes";
import type { Filters, ReportConfig } from "./engine";
import { resolveHint } from "../../shell/hooks";
import { today } from "../../domain/calc";

export interface Preset {
  id: string;
  title: string;
  rows: ReportDimension[];
  col?: ReportDimension;
  measures: ReportMeasure[];
  prorate?: boolean;
}

export const PRESETS: Preset[] = [
  { id: "margin-by-client", title: "Маржа за клієнтами", rows: ["client", "brand"], measures: ["income", "cost", "margin", "marginPct"] },
  { id: "media-by-month", title: "Медіа по місяцях", rows: ["mediaType", "carrier"], col: "month", measures: ["income"], prorate: true },
  { id: "contractors", title: "Підрядники", rows: ["contractor", "carrier"], measures: ["cost", "works"] },
  { id: "plan-vs-current", title: "План і поточний стан", rows: ["client", "project"], measures: ["planIncome", "income", "deltaIncome"] },
  { id: "uninvoiced", title: "Не виставлено", rows: ["client", "project"], measures: ["income", "invoiced", "uninvoiced"] },
  { id: "managers", title: "Менеджери", rows: ["manager"], measures: ["income", "margin", "marginPct"] },
];

export const MAX_ROWS = 3;

export function configOfPreset(p: Preset, base?: Pick<ReportConfig, "from" | "to" | "filters">): ReportConfig {
  return {
    from: base?.from, to: base?.to, filters: base?.filters ?? {},
    rows: p.rows, col: p.col, measures: p.measures, prorate: !!p.prorate, preset: p.id,
  };
}

// ---------- швидкі періоди ----------
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const now = () => { const d = new Date(today()); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; };

export const QUICK_PERIODS: { id: string; title: string; range: () => { from?: string; to?: string } }[] = [
  { id: "month", title: "Цей місяць", range: () => { const { y, m } = now(); return { from: iso(y, m, 1), to: iso(y, m, lastDay(y, m)) }; } },
  { id: "prev", title: "Минулий місяць", range: () => { let { y, m } = now(); m--; if (m < 0) { m = 11; y--; } return { from: iso(y, m, 1), to: iso(y, m, lastDay(y, m)) }; } },
  { id: "quarter", title: "Квартал", range: () => { const { y, m } = now(); const q = Math.floor(m / 3) * 3; return { from: iso(y, q, 1), to: iso(y, q + 2, lastDay(y, q + 2)) }; } },
  { id: "y2025", title: "Рік 2025", range: () => ({ from: "2025-01-01", to: "2025-12-31" }) },
  { id: "y2026", title: "Рік 2026", range: () => ({ from: "2026-01-01", to: "2026-12-31" }) },
  { id: "all", title: "Весь час", range: () => ({}) },
];

// ---------- URL ----------
export interface Lookups {
  clients: { id: string; name: string }[];
  brands: { id: string; name: string }[];
  directions: { id: string; name: string }[];
  contractors: { id: string; name: string }[];
  managers: { id: string; name: string }[];
}

export const MEDIA_TYPES = ["TV", "Digital", "OOH", "Radio", "Press", "Indoor", "Cinema", "Production", "Agency"];

const list = (s: string | null) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const isDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Параметри URL → конфігурація. Без параметрів — пресет «Маржа за клієнтами». Явні параметри перекривають пресет. */
export function parseConfig(sp: URLSearchParams, lk: Lookups): ReportConfig {
  const preset = PRESETS.find((p) => p.id === sp.get("preset")) ?? (sp.has("rows") || sp.has("measures") ? undefined : PRESETS[0]);
  const cfg: ReportConfig = preset
    ? configOfPreset(preset)
    : { rows: [], measures: ["income"], prorate: false, filters: {} };

  const from = sp.get("from"), to = sp.get("to");
  cfg.from = isDate(from) ? from : undefined;
  cfg.to = isDate(to) ? to : undefined;

  if (sp.has("rows")) {
    const rows = list(sp.get("rows")).filter((d): d is ReportDimension => d in REPORT_DIMENSIONS);
    cfg.rows = [...new Set(rows)].slice(0, MAX_ROWS);
  }
  if (sp.has("cols")) {
    const c = sp.get("cols");
    cfg.col = c && c in REPORT_DIMENSIONS ? (c as ReportDimension) : undefined;
  }
  if (cfg.col) cfg.rows = cfg.rows.filter((d) => d !== cfg.col);
  if (sp.has("measures")) {
    const ms = list(sp.get("measures")).filter((m): m is ReportMeasure => m in REPORT_MEASURES);
    if (ms.length) cfg.measures = [...new Set(ms)];
  }
  if (sp.has("prorate")) cfg.prorate = sp.get("prorate") === "1";
  else if (!preset) cfg.prorate = !!cfg.col && ["month", "quarter", "year"].includes(cfg.col);

  const pick = (items: { id: string; name: string }[], v: string | null) =>
    v ? (items.find((x) => x.id === v)?.id ?? resolveHint(items, v)?.id) : undefined;
  const f: Filters = {};
  f.client = pick(lk.clients, sp.get("client"));
  f.brand = pick(lk.brands, sp.get("brand"));
  f.direction = pick(lk.directions, sp.get("direction"));
  f.contractor = pick(lk.contractors, sp.get("contractor"));
  f.manager = pick(lk.managers, sp.get("manager"));
  const mt = sp.get("media");
  f.mediaType = mt && MEDIA_TYPES.includes(mt) ? mt : undefined;
  const ps = sp.get("pstatus");
  f.status = ps === "draft" || ps === "active" || ps === "closed" ? ps : undefined;
  const cl = sp.get("closed");
  f.closed = cl === "closed" || cl === "open" ? cl : undefined;
  f.project = sp.get("project")?.trim().toUpperCase() || undefined;
  cfg.filters = f;
  return cfg;
}

export function serializeConfig(c: ReportConfig): URLSearchParams {
  const q = new URLSearchParams();
  if (c.preset) q.set("preset", c.preset);
  if (c.from) q.set("from", c.from);
  if (c.to) q.set("to", c.to);
  q.set("rows", c.rows.join(","));
  if (c.col) q.set("cols", c.col);
  q.set("measures", c.measures.join(","));
  if (c.prorate) q.set("prorate", "1");
  const f = c.filters;
  if (f.client) q.set("client", f.client);
  if (f.brand) q.set("brand", f.brand);
  if (f.direction) q.set("direction", f.direction);
  if (f.mediaType) q.set("media", f.mediaType);
  if (f.contractor) q.set("contractor", f.contractor);
  if (f.manager) q.set("manager", f.manager);
  if (f.status) q.set("pstatus", f.status);
  if (f.closed) q.set("closed", f.closed);
  if (f.project) q.set("project", f.project);
  return q;
}
