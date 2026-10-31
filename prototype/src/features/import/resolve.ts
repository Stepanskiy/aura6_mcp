// Розвʼязання значень довідників: точний збіг → (модель) → вибір користувача / «Створити новий».
import type { DataState, MediaType } from "../../domain/types";
import { newId, normName } from "../../domain/calc";
import { inferMedia, inferWorkKind, tokens, type DictKind, type ImportMode } from "./fields";
import type { ParsedRow } from "./parse";
import type { ResolveRequestKind } from "./prompts";

export type ResolveVia = "exact" | "alias" | "prefix" | "media" | "llm" | "manual" | "default";

/** Запамʼятовані відповідності «значення з файлу → запис довідника» (з попередніх імпортів). */
export type Aliases = Partial<Record<DictKind, Record<string, string>>>;

export interface ResolveItem {
  kind: DictKind;
  /** Нормалізоване значення — ключ. */
  key: string;
  /** Значення як у файлі (перше входження). */
  value: string;
  count: number;
  /** id наявного запису; "new" — створити (бюджет); "" — не зіставлено (фінальні суми). */
  matchId: string;
  via: ResolveVia;
  confidence?: number;
  /** Заздалегідь виданий id для створення запису — стабільний між рендерами. */
  newId: string;
  /** Для носіїв / форматів / видів робіт, що створюються. */
  mediaType?: MediaType;
  /** Клієнт: значення взято з префікса коду проєкту, а не з колонки. */
  fromPrefix?: boolean;
  /** Клієнт: префікс для кодів проєктів. */
  prefix?: string;
  /** Бренд: ключ клієнта (перше входження). */
  clientKey?: string;
}

export type Resolution = Partial<Record<DictKind, Record<string, ResolveItem>>>;

type Refs = Pick<DataState, "clients" | "brands" | "directions" | "managers" | "workTypes" | "carriers" | "formats" | "contractors" | "projects">;

export const codePrefix = (code: string | undefined) => code?.match(/^([A-ZА-ЯІЇЄҐ]{2,5})-/i)?.[1].toUpperCase();

const TRANSLIT: Record<string, string> = {
  а: "A", б: "B", в: "V", г: "H", ґ: "G", д: "D", е: "E", є: "E", ж: "Z", з: "Z", и: "Y", і: "I", ї: "I", й: "Y", к: "K", л: "L", м: "M", н: "N", о: "O", п: "P", р: "R", с: "S", т: "T", у: "U", ф: "F", х: "K", ц: "C", ч: "C", ш: "S", щ: "S", ю: "U", я: "Y", ы: "Y", э: "E", ё: "E",
};

export function makePrefix(name: string): string {
  const LEGAL = new Set(["тов", "пат", "прат", "ат", "llc", "ltd", "тзов", "фоп", "ооо"]);
  const clean = name.toLowerCase().split(/[\s«»"']+/).filter((w) => w && !LEGAL.has(w)).join("");
  const letters = [...clean].map((ch) => (/[a-z]/.test(ch) ? ch.toUpperCase() : TRANSLIT[ch] ?? "")).join("");
  return (letters.slice(0, 3) || "NEW").padEnd(3, "X");
}

/** Ключ значення рядка для довідника. Клієнт без колонки — з префікса коду. */
export function rowKey(row: ParsedRow, kind: DictKind): string | undefined {
  const v = row.text[kind];
  if (v) return normName(v);
  if (kind === "client") {
    const p = codePrefix(row.text.projectCode);
    return p ? normName(p) : undefined;
  }
  return undefined;
}

function candidates(refs: Refs, kind: DictKind): { id: string; name: string }[] {
  switch (kind) {
    case "client": return refs.clients.map((c) => ({ id: c.id, name: c.name }));
    case "brand": return refs.brands.map((b) => ({ id: b.id, name: `${b.name}${refs.clients.find((c) => c.id === b.clientId) ? ` (${refs.clients.find((c) => c.id === b.clientId)!.name})` : ""}` }));
    case "direction": return refs.directions;
    case "manager": return refs.managers;
    case "workType": return refs.workTypes.map((w) => ({ id: w.id, name: w.name }));
    case "carrier": return refs.carriers.map((c) => ({ id: c.id, name: c.name }));
    case "format": return refs.formats.map((f) => ({ id: f.id, name: f.name }));
    case "contractor": return refs.contractors;
  }
}

/** Варіанти вибору в таблиці розвʼязання (без «(клієнт)» у бренді — показується окремо). */
export function options(refs: Refs, kind: DictKind): { id: string; name: string }[] {
  return candidates(refs, kind).sort((a, b) => a.name.localeCompare(b.name, "uk"));
}

function mostCommon<T>(xs: (T | undefined)[]): T | undefined {
  const m = new Map<T, number>();
  for (const x of xs) if (x !== undefined) m.set(x, (m.get(x) ?? 0) + 1);
  let best: T | undefined, n = 0;
  for (const [k, v] of m) if (v > n) { best = k; n = v; }
  return best;
}

/** Які довідники розвʼязуються в режимі і для яких рядків. */
export function kindsFor(mode: ImportMode): DictKind[] {
  return mode === "budget" ? ["client", "brand", "direction", "manager", "workType", "carrier", "format", "contractor"] : ["workType", "carrier", "format"];
}

const HEADER_KINDS: DictKind[] = ["client", "brand", "direction", "manager"];

/** Зібрати унікальні значення і знайти точні збіги. */
export function collectResolution(rows: ParsedRow[], mode: ImportMode, refs: Refs, aliases: Aliases = {}): Resolution {
  const existingCodes = new Set(refs.projects.map((p) => p.code.toUpperCase()));
  const res: Resolution = {};
  const ctx = new Map<string, { media: (MediaType | undefined)[]; prefixes: (string | undefined)[]; clientKeys: (string | undefined)[] }>();

  const wtByName = new Map(refs.workTypes.map((w) => [normName(w.name), w]));
  const carrierByName = new Map(refs.carriers.map((c) => [normName(c.name), c]));

  for (const row of rows) {
    const code = row.text.projectCode?.toUpperCase();
    const isNewProject = !code || !existingCodes.has(code);
    if (mode === "final" && isNewProject) continue;
    const wtText = row.text.workType;
    const rowMedia = inferMedia(wtText) ?? (wtText ? wtByName.get(normName(wtText))?.mediaType : undefined) ?? (row.text.carrier ? carrierByName.get(normName(row.text.carrier))?.mediaType : undefined) ?? inferMedia(row.text.format);
    for (const kind of kindsFor(mode)) {
      if (HEADER_KINDS.includes(kind) && !isNewProject) continue;
      const key = rowKey(row, kind);
      if (!key) continue;
      const bucket = (res[kind] ??= {});
      let it = bucket[key];
      if (!it) {
        const fromPrefix = kind === "client" && !row.text.client;
        it = bucket[key] = {
          kind, key, value: fromPrefix ? codePrefix(row.text.projectCode)! : row.text[kind]!, count: 0,
          matchId: mode === "budget" ? "new" : "", via: "default", newId: newId(kind.slice(0, 2)), fromPrefix,
        };
      }
      it.count++;
      const c = ctx.get(kind + "|" + key) ?? { media: [], prefixes: [], clientKeys: [] };
      c.media.push(kind === "carrier" ? inferMedia(it.value) ?? rowMedia : kind === "format" ? inferMedia(it.value) ?? rowMedia : rowMedia);
      c.prefixes.push(codePrefix(code));
      c.clientKeys.push(rowKey(row, "client"));
      ctx.set(kind + "|" + key, c);
    }
  }

  // Точні збіги і контекст для створення.
  for (const kind of Object.keys(res) as DictKind[]) {
    for (const it of Object.values(res[kind]!)) {
      const c = ctx.get(kind + "|" + it.key)!;
      if (kind === "client") {
        it.prefix = it.fromPrefix ? it.value.toUpperCase() : mostCommon(c.prefixes) ?? makePrefix(it.value);
        // Префікс коду проєкту (KST-0012 → KST) однозначно вказує на клієнта, навіть якщо назва в файлі інша.
        const byPrefix = refs.clients.find((x) => x.prefix.toUpperCase() === (it.prefix ?? "").toUpperCase());
        const byName = refs.clients.find((x) => normName(x.name) === it.key);
        if (byName) Object.assign(it, { matchId: byName.id, via: "exact" });
        else if (byPrefix) Object.assign(it, { matchId: byPrefix.id, via: "prefix" });
      } else if (kind === "brand") {
        it.clientKey = mostCommon(c.clientKeys);
        const same = refs.brands.filter((b) => normName(b.name) === it.key);
        const clientId = it.clientKey ? res.client?.[it.clientKey]?.matchId : undefined;
        const pick = same.find((b) => b.clientId === clientId) ?? same[0];
        if (pick) Object.assign(it, { matchId: pick.id, via: "exact" });
      } else if (kind === "workType") {
        const exact = refs.workTypes.find((w) => normName(w.name) === it.key);
        const media = inferMedia(it.value);
        it.mediaType = media ?? mostCommon(c.media);
        if (exact) Object.assign(it, { matchId: exact.id, via: "exact" });
        else if (media && tokens(it.value).length <= 2) {
          // «ТБ», «Digital», «OOH» — це вид медіа, а не назва виду робіт.
          const kind = inferWorkKind(it.value, media);
          const wt = refs.workTypes.find((w) => w.mediaType === media && w.kind === kind) ?? refs.workTypes.find((w) => w.mediaType === media);
          if (wt) Object.assign(it, { matchId: wt.id, via: "media" });
        }
      } else {
        const list = candidates(refs, kind);
        const exact = list.find((x) => normName(x.name) === it.key);
        if (exact) Object.assign(it, { matchId: exact.id, via: "exact" });
        if (kind === "carrier" || kind === "format") it.mediaType = mostCommon(c.media) ?? "TV";
      }
      // Відповідність, яку модель або користувач уже підтвердили в попередньому імпорті.
      const alias = aliases[kind]?.[it.key];
      if (it.via === "default" && alias && candidates(refs, kind).some((x) => x.id === alias)) Object.assign(it, { matchId: alias, via: "alias" });
    }
  }
  return res;
}

export function resolutionItems(res: Resolution): ResolveItem[] {
  return (Object.keys(res) as DictKind[]).flatMap((k) => Object.values(res[k]!));
}

/** Значення для моделі: тільки нерозвʼязані (за замовчуванням), по всіх довідниках разом. */
export function unresolvedRequest(res: Resolution, refs: Refs): ResolveRequestKind[] {
  const out: ResolveRequestKind[] = [];
  for (const kind of Object.keys(res) as DictKind[]) {
    const values = Object.values(res[kind]!).filter((it) => it.via === "default").map((it) => it.value);
    const cands = candidates(refs, kind);
    if (values.length && cands.length) out.push({ kind, candidates: cands, values });
  }
  return out;
}

/** Застосувати пропозиції моделі до нерозвʼязаних значень (ручний вибір не перезаписується). */
export function applyLlmSuggestions(res: Resolution, items: { kind: DictKind; value: string; match: string; confidence: number }[], mode: ImportMode): Resolution {
  const next: Resolution = {};
  for (const k of Object.keys(res) as DictKind[]) next[k] = Object.fromEntries(Object.entries(res[k]!).map(([key, it]) => [key, { ...it }]));
  for (const s of items) {
    const it = next[s.kind]?.[normName(s.value)];
    if (!it || it.via !== "default") continue;
    if (s.match === "new") {
      it.via = "llm";
      it.matchId = mode === "budget" ? "new" : "";
    } else {
      it.via = "llm";
      it.matchId = s.match;
    }
    it.confidence = s.confidence;
  }
  return next;
}

/** id запису для значення рядка: наявний, заздалегідь виданий для нового, або undefined. */
export function resolvedId(res: Resolution, kind: DictKind, row: ParsedRow): string | undefined {
  const key = rowKey(row, kind);
  if (!key) return undefined;
  const it = res[kind]?.[key];
  if (!it || !it.matchId) return undefined;
  return it.matchId === "new" ? it.newId : it.matchId;
}

export function resolveCounts(res: Resolution) {
  const items = resolutionItems(res);
  return {
    total: items.length,
    exact: items.filter((i) => i.via === "exact" || i.via === "alias" || i.via === "prefix" || i.via === "media").length,
    llm: items.filter((i) => i.via === "llm").length,
    manual: items.filter((i) => i.via === "manual").length,
    create: items.filter((i) => i.matchId === "new").length,
    unmatched: items.filter((i) => !i.matchId).length,
    pending: items.filter((i) => i.via === "default").length,
  };
}

/** Нові запамʼятовувані відповідності: підтверджені моделлю або вибрані вручну наявні записи. */
export function aliasesFrom(res: Resolution): Aliases {
  const out: Aliases = {};
  for (const it of resolutionItems(res)) {
    if ((it.via === "llm" || it.via === "manual") && it.matchId && it.matchId !== "new" && !it.fromPrefix) (out[it.kind] ??= {})[it.key] = it.matchId;
  }
  return out;
}
