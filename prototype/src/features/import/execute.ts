// Виконання плану імпорту через дії сховища. Правила запису (історія, версії, перевірки) — у store.
import type { ID, RefKind, Refs } from "../../domain/types";
import type { ApplyResult, Store, WorkChange } from "../../store";
import { refsInUse, type BudgetPlan, type FinalPlan, type NewRef } from "./plan";

type Actions = Pick<Store, "upsertRef" | "createProject" | "applyWorkChanges">;

export interface ProjectResult {
  code: string;
  name: string;
  created: boolean;
  added: number;
  updated: number;
  autoVersion?: string;
  errors: string[];
}

export interface ImportResult {
  mode: "budget" | "final";
  createdRefs: NewRef[];
  projects: ProjectResult[];
  errors: string[];
}

export function executeBudget(plan: BudgetPlan, a: Actions): ImportResult {
  const result: ImportResult = { mode: "budget", createdRefs: [], projects: [], errors: [] };
  for (const ref of refsInUse(plan)) {
    a.upsertRef(ref.kind as RefKind, ref.item as unknown as Refs[RefKind][number]);
    result.createdRefs.push(ref);
  }
  for (const p of plan.projects) {
    if (p.errors.length) {
      result.projects.push({ code: p.code, name: p.name, created: false, added: 0, updated: 0, errors: p.errors });
      continue;
    }
    const changes: WorkChange[] = [];
    for (const r of p.rows) {
      if (r.status === "changed" && r.workId && r.patch) changes.push({ op: "update", id: r.workId, patch: r.patch });
    }
    let projectId: ID | undefined = p.projectId;
    let created = false;
    try {
      if (!projectId && p.header) {
        projectId = a.createProject(p.header, "import").id;
        created = true;
      }
    } catch (e) {
      result.projects.push({ code: p.code, name: p.name, created: false, added: 0, updated: 0, errors: [e instanceof Error ? e.message : String(e)] });
      continue;
    }
    if (!projectId) continue;
    for (const r of p.rows) if (r.status === "new") changes.push({ op: "add", work: { ...r.work, projectId } });
    const res: ApplyResult | undefined = changes.length ? a.applyWorkChanges(projectId, changes, "import") : undefined;
    result.projects.push({
      code: p.code,
      name: p.name,
      created,
      added: res?.added.length ?? 0,
      updated: res?.updated.length ?? 0,
      autoVersion: res?.autoVersion ? `${res.autoVersion.name} (v${res.autoVersion.number})` : undefined,
      errors: res?.errors ?? [],
    });
  }
  return result;
}

export function executeFinal(plan: FinalPlan, a: Actions): ImportResult {
  const result: ImportResult = { mode: "final", createdRefs: [], projects: [], errors: [] };
  for (const p of plan.projects) {
    const changes: WorkChange[] = p.rows.filter((r) => r.patch && r.work).map((r) => ({ op: "update" as const, id: r.work!.id, patch: r.patch! }));
    const res = a.applyWorkChanges(p.projectId, changes, "final-import");
    result.projects.push({
      code: p.code,
      name: p.name,
      created: false,
      added: 0,
      updated: res.updated.length,
      autoVersion: res.autoVersion ? `${res.autoVersion.name} (v${res.autoVersion.number})` : undefined,
      errors: res.errors,
    });
  }
  return result;
}
