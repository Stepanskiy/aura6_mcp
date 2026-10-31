// Єдине сховище демо-прототипу (localStorage). Тут живуть усі правила запису:
// історія змін, автоматичні версії плану, заборона видаляти виставлені роботи.
// Модулі читають стан через useStore і змінюють його тільки через ці дії.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ChangeEntry,
  ChangeSource,
  DataState,
  ID,
  ImportTemplate,
  Invoice,
  PlanVersion,
  Project,
  RefKind,
  Refs,
  Settings,
  Work,
} from "./domain/types";
import { invoicedByWork, isSignificantChange, latestVersion, newId, nowIso, round2, snapshotOf } from "./domain/calc";
import { createSeed } from "./data/seed";

export type WorkPatch = Partial<Omit<Work, "id" | "projectId">>;

/** Одна зміна у пакеті змін медіаплану (редагування таблиці, імпорт). */
export type WorkChange =
  | { op: "add"; work: Omit<Work, "id" | "closed"> & { id?: ID; closed?: boolean } }
  | { op: "update"; id: ID; patch: WorkPatch }
  | { op: "delete"; id: ID };

export interface ApplyResult {
  batchId: ID;
  added: ID[];
  updated: ID[];
  deleted: ID[];
  /** Створена автоматично версія плану, якщо зміна суттєва. */
  autoVersion?: PlanVersion;
  errors: string[];
}

interface Session {
  user: string | null;
}

interface Actions {
  login(name: string): void;
  logout(): void;
  updateSettings(patch: Partial<Settings>): void;
  resetDemoData(): void;

  /** Додати або оновити запис довідника. Повертає id. */
  upsertRef<K extends RefKind>(kind: K, item: Refs[K][number]): ID;

  createProject(p: Omit<Project, "id" | "createdAt" | "status"> & { status?: Project["status"] }, source?: ChangeSource): Project;
  updateProject(id: ID, patch: Partial<Omit<Project, "id">>, source?: ChangeSource): void;
  /** Копія проєкту з роботами (без закриття). Повертає новий проєкт. */
  copyProject(id: ID, overrides: Partial<Omit<Project, "id">> & { code: string }): Project;
  deleteProject(id: ID): { ok: boolean; error?: string };

  /** Пакет змін робіт одного проєкту: історія, перевірки, автоматична версія за порогом. */
  applyWorkChanges(projectId: ID, changes: WorkChange[], source: ChangeSource): ApplyResult;
  setWorkClosed(ids: ID[], closed: boolean): void;

  /** Зафіксувати поточний медіаплан як версію плану. */
  fixPlanVersion(projectId: ID, name?: string, auto?: boolean, reason?: string): PlanVersion;

  /** Створити або замінити рахунок. Перевіряє, що рядки не перевищують невиставлений залишок. */
  saveInvoice(inv: Omit<Invoice, "id" | "createdAt"> & { id?: ID }): { ok: true; invoice: Invoice } | { ok: false; errors: string[] };
  deleteInvoice(id: ID): void;

  saveTemplate(t: Omit<ImportTemplate, "id" | "createdAt">): ImportTemplate;
}

export type Store = DataState & { session: Session; settings: Settings } & Actions;

const DEFAULT_SETTINGS: Settings = {
  openRouterKey: "",
  model: "qwen/qwen3-30b-a3b",
  autoVersionThresholdPct: 10,
  agencyName: "Демо Медіа Агенція",
};

function emptyData(): DataState {
  return {
    clients: [], brands: [], contractors: [], carriers: [], formats: [], directions: [], workTypes: [], managers: [],
    projects: [], works: [], versions: [], history: [], invoices: [], templates: [],
  };
}

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      const user = () => get().session.user ?? "система";
      const log = (entries: Omit<ChangeEntry, "id" | "at" | "user">[]) => {
        if (!entries.length) return;
        const at = nowIso();
        const u = user();
        set((s) => ({ history: [...s.history, ...entries.map((e) => ({ ...e, id: newId("h"), at, user: u }))] }));
      };

      return {
        ...emptyData(),
        ...createSeed(),
        session: { user: null },
        settings: DEFAULT_SETTINGS,

        login: (name) => set({ session: { user: name.trim() || "Гість" } }),
        logout: () => set({ session: { user: null } }),
        updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
        resetDemoData: () => {
          // Запамʼятовані зіставлення імпорту (features/import/aliases.ts) скидаються разом з даними.
          try { localStorage.removeItem("aura6-import-aliases"); } catch { /* немає localStorage */ }
          set({ ...emptyData(), ...createSeed() });
        },

        upsertRef: (kind, item) => {
          const list = get()[kind] as { id: ID }[];
          const id = item.id || newId(kind.slice(0, 2));
          const next = { ...item, id };
          const exists = list.some((x) => x.id === id);
          set({ [kind]: exists ? list.map((x) => (x.id === id ? next : x)) : [...list, next] } as Partial<Store>);
          return id;
        },

        createProject: (p, source = "manual") => {
          if (get().projects.some((x) => x.code === p.code)) throw new Error(`Проєкт з кодом ${p.code} вже існує`);
          const project: Project = { status: "active", ...p, id: newId("p"), createdAt: nowIso() };
          set((s) => ({ projects: [...s.projects, project] }));
          log([{ projectId: project.id, action: "project-create", after: project.code, source }]);
          return project;
        },

        updateProject: (id, patch, source = "manual") => {
          const before = get().projects.find((p) => p.id === id);
          if (!before) return;
          set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
          log(
            Object.entries(patch)
              .filter(([k, v]) => (before as unknown as Record<string, unknown>)[k] !== v)
              .map(([k, v]) => ({ projectId: id, action: "project-update" as const, field: k, before: (before as unknown as Record<string, unknown>)[k], after: v, source })),
          );
        },

        copyProject: (id, overrides) => {
          const src = get().projects.find((p) => p.id === id);
          if (!src) throw new Error("Проєкт не знайдено");
          const { id: _id, createdAt: _c, ...rest } = src;
          const project = get().createProject({ ...rest, ...overrides, status: "draft" });
          const works = get().works.filter((w) => w.projectId === id);
          get().applyWorkChanges(
            project.id,
            works.map(({ id: _w, projectId: _p, closed: _cl, closedAt: _ca, finalLoadedAt: _f, ...w }) => ({ op: "add" as const, work: { ...w, projectId: project.id } })),
            "manual",
          );
          return project;
        },

        deleteProject: (id) => {
          const inv = invoicedByWork(get().invoices);
          if (get().works.some((w) => w.projectId === id && (inv.get(w.id) ?? 0) > 0))
            return { ok: false, error: "По проєкту є виставлені рахунки — видалення неможливе" };
          set((s) => ({
            projects: s.projects.filter((p) => p.id !== id),
            works: s.works.filter((w) => w.projectId !== id),
            versions: s.versions.filter((v) => v.projectId !== id),
          }));
          return { ok: true };
        },

        applyWorkChanges: (projectId, changes, source) => {
          const batchId = newId("b");
          const res: ApplyResult = { batchId, added: [], updated: [], deleted: [], errors: [] };
          const inv = invoicedByWork(get().invoices);
          let works = [...get().works];
          const entries: Omit<ChangeEntry, "id" | "at" | "user">[] = [];

          for (const ch of changes) {
            if (ch.op === "add") {
              const w: Work = { closed: false, ...ch.work, id: ch.work.id ?? newId("w"), projectId, income: round2(ch.work.income), cost: round2(ch.work.cost) };
              works.push(w);
              res.added.push(w.id);
              entries.push({ projectId, workId: w.id, action: "create", after: snapshotOf(w), source, batchId });
            } else if (ch.op === "update") {
              const i = works.findIndex((w) => w.id === ch.id && w.projectId === projectId);
              if (i < 0) { res.errors.push(`Роботу ${ch.id} не знайдено`); continue; }
              const before = works[i];
              const patch = { ...ch.patch };
              if (patch.income !== undefined) patch.income = round2(patch.income);
              if (patch.cost !== undefined) patch.cost = round2(patch.cost);
              const billed = inv.get(before.id) ?? 0;
              if (patch.income !== undefined && patch.income < billed) {
                res.errors.push(`Робота ${before.description ?? before.id}: дохід ${patch.income} менший за виставлене ${billed}`);
                continue;
              }
              const after = { ...before, ...patch };
              works[i] = after;
              let changed = false;
              for (const [k, v] of Object.entries(patch)) {
                const old = (before as unknown as Record<string, unknown>)[k];
                if (old !== v) {
                  changed = true;
                  entries.push({ projectId, workId: before.id, action: "update", field: k, before: old, after: v, source, batchId });
                }
              }
              if (changed) res.updated.push(before.id);
            } else {
              const w = works.find((x) => x.id === ch.id && x.projectId === projectId);
              if (!w) continue;
              if ((inv.get(w.id) ?? 0) > 0) { res.errors.push(`Робота ${w.description ?? w.id} вже виставлена в рахунку — видалення неможливе`); continue; }
              works = works.filter((x) => x.id !== ch.id);
              res.deleted.push(ch.id);
              entries.push({ projectId, workId: ch.id, action: "delete", before: snapshotOf(w), source, batchId });
            }
          }

          set({ works });
          log(entries);

          const pw = works.filter((w) => w.projectId === projectId);
          const base = latestVersion(get().versions, projectId);
          if (!base && source !== "seed" && pw.length && (source === "import")) {
            // Перший імпорт бюджету в порожній проєкт фіксується як план v1.
            res.autoVersion = get().fixPlanVersion(projectId, "План (імпорт)", true, "Перше завантаження бюджету");
          } else if (base) {
            const sig = isSignificantChange(base, pw, get().settings.autoVersionThresholdPct);
            if (sig.significant) res.autoVersion = get().fixPlanVersion(projectId, undefined, true, sig.reason);
          }
          return res;
        },

        setWorkClosed: (ids, closed) => {
          const set_ = new Set(ids);
          const at = nowIso();
          const entries: Omit<ChangeEntry, "id" | "at" | "user">[] = [];
          set((s) => ({
            works: s.works.map((w) => {
              if (!set_.has(w.id) || w.closed === closed) return w;
              entries.push({ projectId: w.projectId, workId: w.id, action: closed ? "close" : "reopen", source: "manual" });
              return { ...w, closed, closedAt: closed ? at : undefined };
            }),
          }));
          log(entries);
        },

        fixPlanVersion: (projectId, name, auto = false, reason) => {
          const number = (latestVersion(get().versions, projectId)?.number ?? 0) + 1;
          const v: PlanVersion = {
            id: newId("v"),
            projectId,
            number,
            name: name ?? (auto ? `Версія ${number} (авто)` : `Версія ${number}`),
            createdAt: nowIso(),
            auto,
            reason,
            works: get().works.filter((w) => w.projectId === projectId).map(snapshotOf),
          };
          set((s) => ({ versions: [...s.versions, v] }));
          log([{ projectId, action: "version", after: v.name, field: reason, source: auto ? "import" : "manual" }]);
          return v;
        },

        saveInvoice: (inv) => {
          const errors: string[] = [];
          const s = get();
          const billed = invoicedByWork(s.invoices, inv.id);
          const works = new Map(s.works.map((w) => [w.id, w]));
          if (!inv.lines.length) errors.push("У рахунку немає рядків");
          for (const l of inv.lines) {
            const w = works.get(l.workId);
            if (!w) { errors.push(`Роботу ${l.workId} не знайдено`); continue; }
            const p = s.projects.find((x) => x.id === w.projectId);
            if (p && p.clientId !== inv.clientId) errors.push(`Робота проєкту ${p.code} належить іншому клієнту`);
            if (l.amount <= 0) errors.push(`Сума рядка має бути більшою за нуль (${p?.code ?? ""})`);
            const rest = round2(w.income - (billed.get(w.id) ?? 0));
            if (l.amount > rest + 0.001) errors.push(`${p?.code ?? ""}: сума ${l.amount} більша за невиставлений залишок ${rest}`);
          }
          if (s.invoices.some((x) => x.number === inv.number && x.id !== inv.id)) errors.push(`Рахунок з номером ${inv.number} вже існує`);
          if (errors.length) return { ok: false, errors };
          const invoice: Invoice = { ...inv, id: inv.id ?? newId("i"), createdAt: s.invoices.find((x) => x.id === inv.id)?.createdAt ?? nowIso(), lines: inv.lines.map((l) => ({ ...l, amount: round2(l.amount) })) };
          set((st) => ({ invoices: st.invoices.some((x) => x.id === invoice.id) ? st.invoices.map((x) => (x.id === invoice.id ? invoice : x)) : [...st.invoices, invoice] }));
          return { ok: true, invoice };
        },

        deleteInvoice: (id) => set((s) => ({ invoices: s.invoices.filter((i) => i.id !== id) })),

        saveTemplate: (t) => {
          const tpl: ImportTemplate = { ...t, id: newId("t"), createdAt: nowIso() };
          set((s) => ({ templates: [...s.templates.filter((x) => x.signature !== t.signature), tpl] }));
          return tpl;
        },
      };
    },
    { name: "aura6-demo", version: 1 },
  ),
);

/** Поточний користувач для підписів у документах. */
export const currentUser = () => useStore.getState().session.user ?? "система";
