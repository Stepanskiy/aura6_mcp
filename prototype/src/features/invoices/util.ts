// Спільні допоміжні функції модуля рахунків.
import { round2, VAT_RATE, today } from "../../domain/calc";
import type { Invoice, Project, Work, Brand, WorkType, Carrier, Format, Contractor, Client, Manager } from "../../domain/types";

export const NO_BRAND = "Без бренду";

export function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Попередній календарний місяць відносно сьогодні. */
export function prevMonthRange(): { from: string; to: string } {
  const t = today();
  let y = Number(t.slice(0, 4));
  let m = Number(t.slice(5, 7)) - 1;
  if (m === 0) { m = 12; y -= 1; }
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` };
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function period(a: string, b: string): string {
  const f = (s: string) => s.slice(8, 10) + "." + s.slice(5, 7) + "." + s.slice(0, 4);
  return a === b ? f(a) : `${f(a)} – ${f(b)}`;
}

export function vatOf(net: number) {
  return round2(net * VAT_RATE);
}

export interface Dict {
  clients: Map<string, Client>;
  brands: Map<string, Brand>;
  contractors: Map<string, Contractor>;
  carriers: Map<string, Carrier>;
  formats: Map<string, Format>;
  workTypes: Map<string, WorkType>;
  managers: Map<string, Manager>;
  projects: Map<string, Project>;
}

export interface Row {
  workId: string;
  amount: number;
  work: Work;
  project: Project;
  brandName: string;
  workType?: WorkType;
  carrier?: Carrier;
  format?: Format;
  contractor?: Contractor;
  /** Затрата підрядника, пропорційна виставленій частці роботи. */
  costShare: number;
}

export function workTitle(r: { workType?: WorkType; carrier?: Carrier; format?: Format; work: Work }): string {
  const parts = [r.workType?.name, r.carrier?.name, r.format?.name].filter(Boolean);
  return parts.join(", ") + (r.work.description ? ` — ${r.work.description}` : "");
}

export function invoiceRows(inv: Invoice, d: Dict, works: Map<string, Work>): Row[] {
  const rows: Row[] = [];
  for (const l of inv.lines) {
    const work = works.get(l.workId);
    const project = work && d.projects.get(work.projectId);
    if (!work || !project) continue;
    rows.push({
      workId: l.workId,
      amount: l.amount,
      work,
      project,
      brandName: (project.brandId && d.brands.get(project.brandId)?.name) || NO_BRAND,
      workType: d.workTypes.get(work.workTypeId),
      carrier: work.carrierId ? d.carriers.get(work.carrierId) : undefined,
      format: work.formatId ? d.formats.get(work.formatId) : undefined,
      contractor: work.contractorId ? d.contractors.get(work.contractorId) : undefined,
      costShare: work.income ? round2((work.cost * l.amount) / work.income) : 0,
    });
  }
  return rows;
}

export interface ProjectGroup { project: Project; rows: Row[]; sum: number }
export interface BrandGroup { brand: string; projects: ProjectGroup[]; sum: number }

export function groupRows<T extends { brandName: string; project: Project; amount: number }>(rows: T[]) {
  const brands = new Map<string, Map<string, { project: Project; rows: T[]; sum: number }>>();
  for (const r of rows) {
    let b = brands.get(r.brandName);
    if (!b) brands.set(r.brandName, (b = new Map()));
    let p = b.get(r.project.id);
    if (!p) b.set(r.project.id, (p = { project: r.project, rows: [], sum: 0 }));
    p.rows.push(r);
    p.sum = round2(p.sum + r.amount);
  }
  return [...brands.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "uk"))
    .map(([brand, ps]) => {
      const projects = [...ps.values()].sort((a, b) => a.project.code.localeCompare(b.project.code));
      return { brand, projects, sum: round2(projects.reduce((s, p) => s + p.sum, 0)) };
    });
}

export function sumAmount(rows: { amount: number }[]): number {
  return round2(rows.reduce((s, r) => s + r.amount, 0));
}

export function invoiceNet(inv: Invoice): number {
  return round2(inv.lines.reduce((s, l) => s + l.amount, 0));
}

export const CONTRACT_LABEL = { commission: "Комісійний", regular: "Звичайний" } as const;
