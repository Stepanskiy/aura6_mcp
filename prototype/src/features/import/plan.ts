// План застосування імпорту: що буде створено / оновлено. Чисті функції над станом —
// той самий код потім виконує зміни, тому попередній перегляд і результат не розходяться.
import type { Carrier, Client, DataState, Format, ID, MediaType, Project, RefKind, Work, WorkType } from "../../domain/types";
import type { WorkPatch } from "../../store";
import { invoicedByWork, isSignificantChange, latestVersion, round2 } from "../../domain/calc";
import { DICT_REF, MEDIA_LABEL, inferWorkKind, type DictKind } from "./fields";
import type { ParsedRow } from "./parse";
import { resolvedId, rowKey, type Resolution, type ResolveItem } from "./resolve";

export type PlanState = Pick<DataState, "clients" | "brands" | "directions" | "managers" | "workTypes" | "carriers" | "formats" | "contractors" | "projects" | "works" | "versions" | "invoices">;

export interface NewRef {
  kind: RefKind;
  item: { id: ID; name: string } & Record<string, unknown>;
}

const monthKey = (iso: string) => iso.slice(0, 7);

const UA_MONTHS = ["січ", "лют", "бер", "квіт", "трав", "черв", "лип", "серп", "вер", "жовт", "лист", "груд"];

export function periodLabel(from: string, to: string): string {
  const fy = from.slice(0, 4), ty = to.slice(0, 4);
  const fm = UA_MONTHS[+from.slice(5, 7) - 1], tm = UA_MONTHS[+to.slice(5, 7) - 1];
  if (monthKey(from) === monthKey(to)) return `${fm} ${fy}`;
  return fy === ty ? `${fm}–${tm} ${fy}` : `${fm} ${fy} – ${tm} ${ty}`;
}

/** Довідники разом із тими, що буде створено: для назв у попередньому перегляді. */
class RefIndex {
  private names = new Map<ID, string>();
  carriers: Map<ID, Pick<Carrier, "id" | "name" | "mediaType">>;
  workTypes: Map<ID, Pick<WorkType, "id" | "name" | "kind" | "mediaType">>;
  newRefs = new Map<ID, NewRef>();

  private res: Resolution;

  constructor(s: PlanState, res: Resolution) {
    this.res = res;
    for (const k of ["clients", "brands", "directions", "managers", "workTypes", "carriers", "formats", "contractors"] as const)
      for (const x of s[k] as { id: ID; name: string }[]) this.names.set(x.id, x.name);
    this.carriers = new Map(s.carriers.map((c) => [c.id, c]));
    this.workTypes = new Map(s.workTypes.map((w) => [w.id, w]));
    for (const items of Object.values(res)) for (const it of Object.values(items!)) if (it.matchId === "new") this.names.set(it.newId, it.value);
  }

  name(id: ID | undefined): string | undefined {
    return id ? this.names.get(id) : undefined;
  }

  item(kind: DictKind, row: ParsedRow): ResolveItem | undefined {
    const key = rowKey(row, kind);
    return key ? this.res[kind]?.[key] : undefined;
  }

  /** Зареєструвати запис довідника, що буде створено (якщо значення розвʼязано як «новий»). */
  use(kind: DictKind, row: ParsedRow, extra: Record<string, unknown> = {}): ID | undefined {
    const id = resolvedId(this.res, kind, row);
    const it = this.item(kind, row);
    if (id && it?.matchId === "new" && !this.newRefs.has(id)) {
      const base = { id, name: it.value };
      let item: NewRef["item"];
      switch (kind) {
        case "client": item = { ...base, prefix: it.prefix ?? "NEW" } satisfies Client; break;
        case "carrier": item = { ...base, mediaType: it.mediaType ?? "TV", ...extra }; break;
        case "format": item = { ...base, mediaType: it.mediaType ?? "TV" } satisfies Format; break;
        case "workType": item = { ...base, kind: inferWorkKind(it.value, it.mediaType), mediaType: it.mediaType }; break;
        default: item = { ...base, ...extra };
      }
      this.newRefs.set(id, { kind: DICT_REF[kind], item });
      this.names.set(id, it.value);
      if (kind === "carrier") this.carriers.set(id, item as unknown as Carrier);
      if (kind === "workType") this.workTypes.set(id, item as unknown as WorkType);
    }
    return id;
  }

  /** Вид робіт за замовчуванням для медіа: наявний «Розміщення …» або новий. */
  defaultWorkType(media: MediaType | undefined): ID {
    const all = [...this.workTypes.values()];
    const found =
      (media && (all.find((w) => w.mediaType === media && w.kind === inferWorkKind(undefined, media)) ?? all.find((w) => w.mediaType === media))) ||
      (!media ? all.find((w) => w.kind === "placement") : undefined);
    if (found) return found.id;
    const id = `wt-imp-${media ?? "any"}`;
    if (!this.newRefs.has(id)) {
      const name = media ? `Розміщення ${MEDIA_LABEL[media]}` : "Розміщення";
      const item = { id, name, kind: inferWorkKind(undefined, media), mediaType: media };
      this.newRefs.set(id, { kind: "workTypes", item });
      this.workTypes.set(id, item);
      this.names.set(id, name);
    }
    return id;
  }

  mediaOfCarrier(id: ID | undefined): MediaType | undefined {
    return id ? this.carriers.get(id)?.mediaType : undefined;
  }
}

// ───────────── Бюджети ─────────────

export type BudgetRowStatus = "new" | "changed" | "same" | "closed" | "error";

export interface BudgetRowPlan {
  row: ParsedRow;
  status: BudgetRowStatus;
  workId?: ID;
  before?: { income: number; cost: number };
  income: number;
  cost: number;
  work: Omit<Work, "id" | "projectId" | "closed">;
  patch?: WorkPatch;
  labels: { workType?: string; carrier?: string; format?: string; contractor?: string };
  message?: string;
}

export interface BudgetProjectPlan {
  code: string;
  exists: boolean;
  projectId?: ID;
  header?: Omit<Project, "id" | "createdAt">;
  name: string;
  clientName?: string;
  brandName?: string;
  rows: BudgetRowPlan[];
  /** Роботи проєкту, яких немає у файлі: не видаляються. */
  missing: { work: Work; label: string }[];
  before: { income: number; cost: number };
  after: { income: number; cost: number };
  versionHint?: string;
  errors: string[];
}

export interface BudgetPlan {
  projects: BudgetProjectPlan[];
  newRefs: NewRef[];
  counts: { newProjects: number; updatedProjects: number; add: number; change: number; same: number; closed: number; errors: number; income: number; cost: number };
}

const sum = (ws: { income: number; cost: number }[]) => ({ income: round2(ws.reduce((s, w) => s + w.income, 0)), cost: round2(ws.reduce((s, w) => s + w.cost, 0)) });

export function workKey(w: { workTypeId: ID; carrierId?: ID; formatId?: ID; periodStart: string }): string {
  return `${w.workTypeId}|${w.carrierId ?? ""}|${w.formatId ?? ""}|${monthKey(w.periodStart)}`;
}

function versionHint(s: PlanState, projectId: ID | undefined, projected: { income: number; cost: number }[], thresholdPct: number, source: "import" | "final-import"): string | undefined {
  const base = projectId ? latestVersion(s.versions, projectId) : undefined;
  if (!base) return source === "import" && projected.length ? "Буде зафіксовано версію плану «План (імпорт)» v1" : undefined;
  const sig = isSignificantChange(base, projected as Work[], thresholdPct);
  return sig.significant ? `Буде створено версію плану v${base.number + 1} (авто): ${sig.reason}` : undefined;
}

export function buildBudgetPlan(rows: ParsedRow[], res: Resolution, s: PlanState, thresholdPct: number): BudgetPlan {
  const idx = new RefIndex(s, res);
  const invoiced = invoicedByWork(s.invoices);
  const groups = new Map<string, ParsedRow[]>();
  for (const r of rows) {
    const code = r.text.projectCode!;
    groups.set(code, [...(groups.get(code) ?? []), r]);
  }

  const projects: BudgetProjectPlan[] = [];
  for (const [code, grows] of groups) {
    const project = s.projects.find((p) => p.code.toUpperCase() === code.toUpperCase());
    const plan: BudgetProjectPlan = { code: project?.code ?? code, exists: !!project, projectId: project?.id, name: project?.name ?? "", rows: [], missing: [], before: { income: 0, cost: 0 }, after: { income: 0, cost: 0 }, errors: [] };
    const existing = project ? s.works.filter((w) => w.projectId === project.id) : [];
    plan.before = sum(existing);

    // Шапка нового проєкту.
    if (!project) {
      const first = <K extends DictKind>(k: K) => grows.find((r) => rowKey(r, k));
      const cRow = first("client");
      const clientId = cRow ? idx.use("client", cRow) : undefined;
      if (!clientId) plan.errors.push(`Не визначено клієнта: немає колонки «Клієнт», а префікс коду ${code} не збігся з жодним клієнтом`);
      const bRow = first("brand");
      const brandId = bRow && clientId ? idx.use("brand", bRow, { clientId }) : undefined;
      const dRow = first("direction"), mRow = first("manager");
      const directionId = dRow ? idx.use("direction", dRow) : undefined;
      const managerId = mRow ? idx.use("manager", mRow) : undefined;
      const starts = grows.map((r) => r.periodStart!).sort();
      const ends = grows.map((r) => r.periodEnd!).sort();
      plan.clientName = idx.name(clientId);
      plan.brandName = idx.name(brandId);
      const medias = [...new Set(grows.map((r) => idx.mediaOfCarrier(resolvedId(res, "carrier", r)) ?? idx.item("workType", r)?.mediaType).filter(Boolean) as MediaType[])];
      const gen = `${plan.brandName ?? plan.clientName ?? code} — ${medias.length ? medias.map((m) => MEDIA_LABEL[m]).join(", ") : "Медіа"}, ${periodLabel(starts[0], ends[ends.length - 1])}`;
      plan.name = grows.find((r) => r.text.projectName)?.text.projectName ?? gen;
      if (clientId)
        plan.header = {
          code, name: plan.name, clientId, brandId, directionId, managerId,
          year: Number(starts[0].slice(0, 4)), startDate: starts[0], endDate: ends[ends.length - 1], status: "active",
        };
    } else {
      plan.clientName = idx.name(project.clientId);
      plan.brandName = idx.name(project.brandId);
    }

    // Рядки → роботи.
    const queues = new Map<string, Work[]>();
    for (const w of existing) queues.set(workKey(w), [...(queues.get(workKey(w)) ?? []), w]);
    const matched = new Set<ID>();
    const skipProject = plan.errors.length > 0;

    for (const r of grows) {
      const carrierId = idx.use("carrier", r, r.text.contractor ? { contractorId: resolvedId(res, "contractor", r) } : {});
      const formatId = idx.use("format", r);
      const contractorId = idx.use("contractor", r);
      const media = idx.item("workType", r)?.mediaType ?? idx.mediaOfCarrier(carrierId);
      const workTypeId = idx.use("workType", r) ?? idx.defaultWorkType(media);
      const income = r.income ?? 0, cost = r.cost ?? 0;
      const work: BudgetRowPlan["work"] = {
        workTypeId, carrierId, formatId, contractorId, periodStart: r.periodStart!, periodEnd: r.periodEnd!,
        description: r.text.description, income, cost,
      };
      const labels = { workType: idx.name(workTypeId), carrier: idx.name(carrierId), format: idx.name(formatId), contractor: idx.name(contractorId) };
      const q = queues.get(workKey(work));
      const ex = q?.shift();
      if (!ex) {
        plan.rows.push({ row: r, status: skipProject ? "error" : "new", income, cost, work, labels, message: skipProject ? "проєкт не буде створено" : undefined });
        continue;
      }
      matched.add(ex.id);
      const patch: WorkPatch = {};
      if (r.income !== undefined && round2(r.income) !== ex.income) patch.income = round2(r.income);
      if (r.cost !== undefined && round2(r.cost) !== ex.cost) patch.cost = round2(r.cost);
      if (r.periodEnd && r.periodEnd !== ex.periodEnd) patch.periodEnd = r.periodEnd;
      if (r.periodStart && r.periodStart !== ex.periodStart) patch.periodStart = r.periodStart;
      if (contractorId && contractorId !== ex.contractorId) patch.contractorId = contractorId;
      if (r.text.description && r.text.description !== ex.description) patch.description = r.text.description;
      const before = { income: ex.income, cost: ex.cost };
      const after = { income: patch.income ?? ex.income, cost: patch.cost ?? ex.cost };
      const changed = Object.keys(patch).length > 0;
      if (ex.closed && changed) {
        plan.rows.push({ row: r, status: "closed", workId: ex.id, before, income: ex.income, cost: ex.cost, work, labels, message: `робота закрита («сума фінальна») — не змінюється; у файлі: дохід ${r.income ?? "—"}, затрата ${r.cost ?? "—"}` });
      } else if (changed && (invoiced.get(ex.id) ?? 0) > after.income + 0.001) {
        plan.rows.push({ row: r, status: "error", workId: ex.id, before, income: after.income, cost: after.cost, work, labels, message: `дохід менший за виставлене в рахунках (${invoiced.get(ex.id)})` });
      } else {
        plan.rows.push({ row: r, status: changed ? "changed" : "same", workId: ex.id, before, income: after.income, cost: after.cost, work, patch: changed ? patch : undefined, labels });
      }
    }
    plan.missing = existing
      .filter((w) => !matched.has(w.id))
      .map((w) => ({ work: w, label: [idx.name(w.workTypeId), idx.name(w.carrierId), idx.name(w.formatId), w.description].filter(Boolean).join(" · ") || w.id }));

    // Прогноз сум і версії.
    const applied = plan.rows.filter((x) => x.status === "new" || x.status === "changed");
    const projected = [
      ...existing.map((w) => {
        const p = plan.rows.find((x) => x.workId === w.id && x.status === "changed");
        return p ? { income: p.income, cost: p.cost } : { income: w.income, cost: w.cost };
      }),
      ...plan.rows.filter((x) => x.status === "new").map((x) => ({ income: x.income, cost: x.cost })),
    ];
    plan.after = skipProject ? plan.before : sum(projected);
    if (!skipProject && applied.length) plan.versionHint = versionHint(s, project?.id, projected, thresholdPct, "import");
    projects.push(plan);
  }

  projects.sort((a, b) => Number(a.exists) - Number(b.exists) || a.code.localeCompare(b.code));
  const all = projects.flatMap((p) => p.rows);
  return {
    projects,
    newRefs: [...idx.newRefs.values()],
    counts: {
      newProjects: projects.filter((p) => !p.exists && !p.errors.length).length,
      updatedProjects: projects.filter((p) => p.exists && p.rows.some((r) => r.status === "new" || r.status === "changed")).length,
      add: all.filter((r) => r.status === "new").length,
      change: all.filter((r) => r.status === "changed").length,
      same: all.filter((r) => r.status === "same").length,
      closed: all.filter((r) => r.status === "closed").length,
      errors: all.filter((r) => r.status === "error").length + projects.filter((p) => p.errors.length).length,
      income: round2(all.reduce((s, r) => s + (r.row.income ?? 0), 0)),
      cost: round2(all.reduce((s, r) => s + (r.row.cost ?? 0), 0)),
    },
  };
}

/** Тільки ті нові записи довідників, що потрібні рядкам, які реально застосовуються. */
export function refsInUse(plan: BudgetPlan): NewRef[] {
  const used = new Set<ID>();
  for (const p of plan.projects) {
    if (p.errors.length) continue;
    if (p.header) for (const id of [p.header.clientId, p.header.brandId, p.header.directionId, p.header.managerId]) if (id) used.add(id);
    for (const r of p.rows) {
      if (r.status !== "new" && r.status !== "changed") continue;
      for (const id of [r.work.workTypeId, r.work.carrierId, r.work.formatId, r.work.contractorId]) if (id) used.add(id);
    }
  }
  // Носій тягне свого підрядника.
  for (const n of plan.newRefs) if (n.kind === "carriers" && used.has(n.item.id) && typeof n.item.contractorId === "string") used.add(n.item.contractorId);
  const order: RefKind[] = ["clients", "brands", "directions", "managers", "contractors", "workTypes", "carriers", "formats"];
  return plan.newRefs.filter((n) => used.has(n.item.id)).sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}

// ───────────── Фінальні суми ─────────────

export type FinalRowStatus = "matched" | "closed" | "no-project" | "unmatched" | "ambiguous" | "duplicate" | "error";

export const FINAL_STATUS_LABEL: Record<FinalRowStatus, string> = {
  matched: "Зіставлено",
  closed: "Закрита",
  "no-project": "Немає проєкту",
  unmatched: "Не знайдено",
  ambiguous: "Неоднозначно",
  duplicate: "Повтор",
  error: "Помилка",
};

export interface FinalRowPlan {
  row: ParsedRow;
  code: string;
  projectId?: ID;
  work?: Work;
  status: FinalRowStatus;
  planIncome?: number;
  planCost?: number;
  income?: number;
  cost?: number;
  patch?: WorkPatch;
  matchedBy?: "full" | "carrier-month" | "month";
  labels: { workType?: string; carrier?: string; format?: string };
  message?: string;
}

export interface FinalProjectPlan {
  code: string;
  projectId: ID;
  name: string;
  rows: FinalRowPlan[];
  versionHint?: string;
}

export interface FinalPlan {
  rows: FinalRowPlan[];
  projects: FinalProjectPlan[];
  counts: { matched: number; closed: number; unmatched: number; planIncome: number; finalIncome: number; planCost: number; finalCost: number };
}

export function buildFinalPlan(rows: ParsedRow[], res: Resolution, s: PlanState, thresholdPct: number, now: string): FinalPlan {
  const idx = new RefIndex(s, res);
  const invoiced = invoicedByWork(s.invoices);
  const used = new Set<ID>();
  const out: FinalRowPlan[] = [];

  for (const r of rows) {
    const code = r.text.projectCode!;
    const project = s.projects.find((p) => p.code.toUpperCase() === code.toUpperCase());
    const carrierId = resolvedId(res, "carrier", r);
    const formatId = resolvedId(res, "format", r);
    const workTypeId = resolvedId(res, "workType", r);
    const labels = { carrier: r.text.carrier, format: r.text.format, workType: r.text.workType };
    const base: FinalRowPlan = { row: r, code: project?.code ?? code, projectId: project?.id, status: "unmatched", income: r.income, cost: r.cost, labels };
    if (!project) {
      out.push({ ...base, status: "no-project", message: `проєкту ${code} немає — фінальні суми завантажуються тільки в наявні проєкти` });
      continue;
    }
    if (r.text.carrier && !carrierId) {
      out.push({ ...base, message: `носій «${r.text.carrier}» не знайдено в довіднику` });
      continue;
    }
    const month = monthKey(r.periodStart!);
    const all = s.works.filter((w) => w.projectId === project.id && monthKey(w.periodStart) === month && (!carrierId || w.carrierId === carrierId));
    const free = all.filter((w) => !used.has(w.id));
    const pick = (ws: Work[]): Work[] => {
      if (ws.length <= 1 || !workTypeId) return ws;
      const f = ws.filter((w) => w.workTypeId === workTypeId);
      return f.length ? f : ws;
    };
    let cand = formatId ? pick(free.filter((w) => w.formatId === formatId)) : pick(free);
    let matchedBy: FinalRowPlan["matchedBy"] = carrierId ? (formatId ? "full" : "carrier-month") : "month";
    if (!cand.length && formatId) {
      cand = pick(free);
      matchedBy = carrierId ? "carrier-month" : "month";
    }
    if (cand.length !== 1) {
      if (!cand.length && all.length) out.push({ ...base, status: "duplicate", message: "робота вже зіставлена з іншим рядком файлу" });
      else if (!cand.length) out.push({ ...base, message: `у проєкті немає роботи${r.text.carrier ? ` «${r.text.carrier}»` : ""} за ${periodLabel(r.periodStart!, r.periodStart!)}` });
      else out.push({ ...base, status: "ambiguous", message: `підходить ${cand.length} роботи — уточніть формат або вид робіт у файлі` });
      continue;
    }
    const w = cand[0];
    used.add(w.id);
    const lab = { carrier: idx.name(w.carrierId) ?? labels.carrier, format: idx.name(w.formatId) ?? labels.format, workType: idx.name(w.workTypeId) ?? labels.workType };
    const fin = { income: r.income ?? w.income, cost: r.cost ?? w.cost };
    const common = { ...base, work: w, planIncome: w.income, planCost: w.cost, income: fin.income, cost: fin.cost, matchedBy, labels: lab };
    if (w.closed) {
      out.push({ ...common, status: "closed", message: "робота вже закрита («сума фінальна») — пропущено" });
      continue;
    }
    if ((invoiced.get(w.id) ?? 0) > fin.income + 0.001) {
      out.push({ ...common, status: "error", message: `фінальний дохід менший за виставлене в рахунках (${invoiced.get(w.id)})` });
      continue;
    }
    const patch: WorkPatch = { finalLoadedAt: now };
    if (r.income !== undefined) patch.income = round2(r.income);
    if (r.cost !== undefined) patch.cost = round2(r.cost);
    out.push({ ...common, status: "matched", patch });
  }

  const byProject = new Map<ID, FinalRowPlan[]>();
  for (const r of out) if (r.status === "matched") byProject.set(r.projectId!, [...(byProject.get(r.projectId!) ?? []), r]);
  const projects: FinalProjectPlan[] = [...byProject].map(([pid, prs]) => {
    const p = s.projects.find((x) => x.id === pid)!;
    const projected = s.works.filter((w) => w.projectId === pid).map((w) => {
      const m = prs.find((x) => x.work?.id === w.id);
      return m ? { income: m.income!, cost: m.cost! } : { income: w.income, cost: w.cost };
    });
    return { code: p.code, projectId: pid, name: p.name, rows: prs, versionHint: versionHint(s, pid, projected, thresholdPct, "final-import") };
  });
  projects.sort((a, b) => a.code.localeCompare(b.code));
  const m = out.filter((r) => r.status === "matched");
  return {
    rows: out,
    projects,
    counts: {
      matched: m.length,
      closed: out.filter((r) => r.status === "closed").length,
      unmatched: out.filter((r) => r.status !== "matched" && r.status !== "closed").length,
      planIncome: round2(m.reduce((s, r) => s + (r.planIncome ?? 0), 0)),
      finalIncome: round2(m.reduce((s, r) => s + (r.income ?? 0), 0)),
      planCost: round2(m.reduce((s, r) => s + (r.planCost ?? 0), 0)),
      finalCost: round2(m.reduce((s, r) => s + (r.cost ?? 0), 0)),
    },
  };
}

