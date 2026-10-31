// Запити до моделі: тексти, JSON-схеми і перевірка відповідей. Чистий модуль.
// Модель бачить тільки зразок структури (перші рядки, обрізані клітинки) і назви довідників — не весь файл.
import type { ImportField, SheetMapping } from "../../domain/types";
import { FIELDS, DICT_KINDS, DICT_LABEL, requiredFields, type DictKind, type ImportMode } from "./fields";
import { cellText, gridWidth, type Grid } from "./parse";
import { columnsFromList, validateMapping } from "./mapping";

export const SAMPLE_ROWS = 30;
export const CELL_MAX = 40;

export interface Prompt {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
}

// ───────────── 1. Структура аркуша ─────────────

const FIELD_ENUM = FIELDS.map((f) => f.field);

export const MAPPING_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["headerRow", "firstDataRow", "columns", "skipRowPatterns", "notes"],
  properties: {
    headerRow: { type: "integer", description: "індекс рядка заголовків (з 0)" },
    firstDataRow: { type: "integer", description: "індекс першого рядка даних (з 0)" },
    columns: {
      type: "array",
      description: "поле для кожної колонки з заголовком",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "field"],
        properties: {
          index: { type: "integer", description: "індекс колонки (з 0)" },
          field: { type: "string", enum: FIELD_ENUM },
        },
      },
    },
    skipRowPatterns: { type: "array", items: { type: "string" }, description: "підрядки службових рядків, які треба пропустити (підсумки, заголовки груп)" },
    notes: { type: "string", description: "коротке пояснення структури українською, 1–2 речення" },
  },
};

export interface MappingResponse {
  headerRow: number;
  firstDataRow: number;
  columns: { index: number; field: ImportField }[];
  skipRowPatterns: string[];
  notes: string;
}

const trunc = (s: string) => (s.length > CELL_MAX ? s.slice(0, CELL_MAX - 1) + "…" : s);

/** Зразок аркуша для моделі: тільки непорожні клітинки, з індексами. */
export function sheetSample(grid: Grid, rows = SAMPLE_ROWS): string {
  const lines: string[] = [];
  for (let r = 0; r < Math.min(grid.length, rows); r++) {
    const cells = (grid[r] ?? [])
      .map((c, i) => [i, cellText(c)] as const)
      .filter(([, t]) => t)
      .map(([i, t]) => `c${i}=${JSON.stringify(trunc(t))}`);
    lines.push(`r${r}: ${cells.length ? cells.join(" ") : "(порожній)"}`);
  }
  return lines.join("\n");
}

export function buildMappingPrompt(grid: Grid, sheetName: string, mode: ImportMode): Prompt {
  const req = requiredFields(mode);
  const reqText = [...req.all, ...(req.anyOf ? [`${req.anyOf.join(" або ")}`] : [])].join(", ");
  const fieldList = FIELDS.map((f) => `- ${f.field} — ${f.description}`).join("\n");
  const system = [
    "Ти аналізуєш структуру Excel-таблиці для системи управлінського обліку рекламної агенції.",
    "Тобі дають тільки перші рядки аркуша. Визнач: рядок заголовків, перший рядок даних і яке поле системи відповідає кожній колонці.",
    "Не переписуй, не обчислюй і не виправляй дані — потрібна тільки структура; дані за нею прочитає програма.",
    "Індекси рядків (r) і колонок (c) рахуються з 0 точно як у зразку. Над заголовками можуть бути рядки з назвою звіту — це не дані.",
    "Кожне поле, крім description і ignore, признач не більше ніж одній колонці. Колонки, що не підходять, — ignore.",
    "Якщо колонка містить вид медіа (ТБ, Digital, OOH…), а окремого виду робіт немає — це workType.",
    "Якщо є і дата початку, і місяць — признач periodStart/periodEnd, а month тільки коли окремих дат немає.",
    "skipRowPatterns — короткі підрядки службових рядків у зоні даних (підсумки «Разом», «Всього», заголовки груп), які треба пропустити. Не додавай підрядки, що трапляються у звичайних рядках даних.",
  ].join("\n");
  const user = [
    `Аркуш: «${sheetName}». Усього рядків: ${grid.length}, колонок: ${gridWidth(grid)}. Показано перші ${Math.min(grid.length, SAMPLE_ROWS)}, клітинки обрізано до ${CELL_MAX} символів.`,
    `Що імпортуємо: ${mode === "budget" ? "бюджети проєктів (медіаплани)" : "фінальні суми по роботах проєктів"}.`,
    `Обовʼязкові поля: ${reqText}, а також період (month або periodStart).`,
    "",
    "Поля системи:",
    fieldList,
    "",
    "Зразок:",
    sheetSample(grid),
  ].join("\n");
  return { system, user, schemaName: "sheet_mapping", schema: MAPPING_SCHEMA };
}

/** Перевірити відповідь моделі і перетворити на SheetMapping. Помилки — причина перейти на ручне відображення. */
export function mappingFromResponse(resp: MappingResponse, grid: Grid, sheetName: string, mode: ImportMode): { mapping?: SheetMapping; errors: string[] } {
  const errors: string[] = [];
  if (!resp || typeof resp !== "object") return { errors: ["Відповідь не є обʼєктом"] };
  if (!Array.isArray(resp.columns)) return { errors: ["Немає списку колонок"] };
  const width = gridWidth(grid);
  for (const c of resp.columns) {
    if (!Number.isInteger(c.index) || c.index < 0 || c.index >= width) errors.push(`Індекс колонки ${c.index} поза межами (0…${width - 1})`);
    if (!FIELD_ENUM.includes(c.field)) errors.push(`Невідоме поле «${c.field}»`);
  }
  const mapping: SheetMapping = {
    sheetName,
    headerRow: resp.headerRow,
    firstDataRow: resp.firstDataRow,
    columns: columnsFromList(width, resp.columns.filter((c) => FIELD_ENUM.includes(c.field))),
    skipRowPatterns: Array.isArray(resp.skipRowPatterns) ? resp.skipRowPatterns.filter((s) => typeof s === "string" && s.trim().length >= 3).slice(0, 10) : [],
  };
  const v = validateMapping(mapping, grid, mode);
  errors.push(...v.errors);
  return errors.length ? { errors } : { mapping, errors };
}

// ───────────── 2. Довідники ─────────────

export interface ResolveRequestKind {
  kind: DictKind;
  candidates: { id: string; name: string }[];
  values: string[];
}

export const MAX_CANDIDATES = 300;

export const RESOLVE_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "value", "match", "confidence"],
        properties: {
          kind: { type: "string", enum: DICT_KINDS },
          value: { type: "string", description: "значення з файлу без змін" },
          match: { type: "string", description: "id наявного запису або \"new\"" },
          confidence: { type: "number", description: "впевненість 0…1" },
        },
      },
    },
  },
};

export interface ResolveResponse {
  items: { kind: DictKind; value: string; match: string; confidence: number }[];
}

export function buildResolvePrompt(kinds: ResolveRequestKind[]): Prompt {
  const system = [
    "Ти зіставляєш значення з Excel-файлу із записами довідників системи обліку рекламної агенції.",
    "Для кожного значення поверни id наявного запису, якщо це той самий обʼєкт: інше написання, скорочення, транслітерація, регістр, лапки, зайві слова (ТОВ, ТБ, канал).",
    "Якщо відповідного запису немає — поверни match = \"new\". Не вигадуй id: тільки id зі списку кандидатів того самого довідника.",
    "Схожа назва іншого обʼєкта — це не збіг (наприклад, «1+1» і «2+2» — різні канали). Якщо сумніваєшся — \"new\" або низька confidence.",
    "Поверни рівно один елемент на кожне значення.",
  ].join("\n");
  const payload = kinds.map((k) => ({
    kind: k.kind,
    title: DICT_LABEL[k.kind],
    candidates: k.candidates.slice(0, MAX_CANDIDATES),
    values: k.values,
  }));
  const user = `Довідники і значення для зіставлення (JSON):\n${JSON.stringify(payload, null, 1)}`;
  return { system, user, schemaName: "dictionary_resolution", schema: RESOLVE_SCHEMA };
}

/** Відповідь моделі → тільки валідні пропозиції (id існує в кандидатах того довідника). */
export function resolutionsFromResponse(resp: ResolveResponse, kinds: ResolveRequestKind[]): { kind: DictKind; value: string; match: string | "new"; confidence: number }[] {
  if (!resp || !Array.isArray(resp.items)) return [];
  const byKind = new Map(kinds.map((k) => [k.kind, { ids: new Set(k.candidates.map((c) => c.id)), values: new Set(k.values) }]));
  const out: { kind: DictKind; value: string; match: string | "new"; confidence: number }[] = [];
  for (const it of resp.items) {
    const k = byKind.get(it.kind);
    if (!k || !k.values.has(it.value)) continue;
    const match = it.match === "new" || k.ids.has(it.match) ? it.match : "new";
    const confidence = typeof it.confidence === "number" ? Math.max(0, Math.min(1, it.confidence)) : 0.5;
    out.push({ kind: it.kind, value: it.value, match, confidence });
  }
  return out;
}
