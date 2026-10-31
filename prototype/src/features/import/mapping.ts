// Відображення колонок: евристика за назвами заголовків, перевірка, шаблони форматів.
import type { ImportField, ImportTemplate, SheetMapping } from "../../domain/types";
import { normName } from "../../domain/calc";
import { FIELDS, FIELD_BY_ID, fieldLabel, requiredFields, tokens, type ImportMode } from "./fields";
import { cellText, gridWidth, headerSignature, parseAmount, type Grid } from "./parse";

export type MappingSource = "template" | "llm" | "heuristic";

/** Наскільки назва колонки схожа на поле (0 — не схожа). */
function keywordScore(header: string, kw: string): number {
  if (!header) return 0;
  if (header === kw) return 100 + kw.length;
  if (kw.length <= 4 && !kw.includes(" ")) return tokens(header).includes(kw) ? kw.length + 1 : 0;
  return header.includes(kw) ? kw.length : 0;
}

export function guessField(headerText: string): { field: ImportField; score: number } {
  const h = normName(headerText);
  let best: { field: ImportField; score: number } = { field: "ignore", score: 0 };
  for (const f of FIELDS) {
    for (const kw of f.keywords) {
      const s = keywordScore(h, kw);
      if (s > best.score) best = { field: f.field, score: s };
    }
  }
  return best;
}

/** Рядок заголовків: серед перших 30 — той, де найбільше клітинок схожі на назви полів. */
export function guessHeaderRow(grid: Grid): number {
  let best = 0, bestScore = -1;
  const limit = Math.min(grid.length, 30);
  for (let r = 0; r < limit; r++) {
    const row = grid[r] ?? [];
    let score = 0, texts = 0;
    for (const c of row) {
      const t = cellText(c);
      if (!t || typeof c === "number") continue;
      texts++;
      if (guessField(t).score > 0) score += 2;
    }
    if (texts >= 2) score += 1;
    if (score > bestScore) {
      best = r;
      bestScore = score;
    }
  }
  return best;
}

const CODE_RE = /^[A-ZА-ЯІЇЄҐ]{2,5}-\d{2,}$/i;

/** Евристика: заголовки → поля; конфлікти розвʼязуються на користь кращого збігу. */
export function heuristicMapping(grid: Grid, sheetName: string): SheetMapping {
  const headerRow = guessHeaderRow(grid);
  const width = gridWidth(grid);
  const header = grid[headerRow] ?? [];
  const guesses = Array.from({ length: width }, (_, i) => ({ i, ...guessField(cellText(header[i])) }));

  // Одне поле — одна колонка (крім multi): лишаємо найкращий збіг.
  const taken = new Map<ImportField, number>();
  for (const g of [...guesses].sort((a, b) => b.score - a.score)) {
    if (g.field === "ignore") continue;
    if (FIELD_BY_ID.get(g.field)?.multi) continue;
    if (taken.has(g.field)) g.field = "ignore";
    else taken.set(g.field, g.i);
  }

  // Колонка зі значеннями на кшталт KST-0012 — код проєкту, навіть якщо заголовок незвичний.
  const sample = grid.slice(headerRow + 1, headerRow + 40);
  if (!taken.has("projectCode")) {
    for (let i = 0; i < width; i++) {
      const vals = sample.map((r) => cellText(r?.[i])).filter(Boolean);
      if (vals.length >= 2 && vals.filter((v) => CODE_RE.test(v)).length / vals.length > 0.6) {
        guesses[i].field = "projectCode";
        break;
      }
    }
  }
  // Якщо «Медіа» і «Вид робіт» обидва впізнано як workType — друга лишається ignore (вище), це нормально.

  const columns: Record<number, ImportField> = {};
  for (const g of guesses) columns[g.i] = g.field;

  let firstDataRow = headerRow + 1;
  while (firstDataRow < grid.length && (grid[firstDataRow] ?? []).every((c) => !cellText(c))) firstDataRow++;

  return { sheetName, headerRow, firstDataRow, columns, skipRowPatterns: [] };
}

export interface MappingIssues {
  errors: string[];
  warnings: string[];
}

/** Перевірка відображення: індекси в межах аркуша, обовʼязкові поля режиму, період. */
export function validateMapping(m: SheetMapping, grid: Grid, mode: ImportMode): MappingIssues {
  const errors: string[] = [];
  const warnings: string[] = [];
  const width = gridWidth(grid);
  if (!Number.isInteger(m.headerRow) || m.headerRow < 0 || m.headerRow >= grid.length) errors.push(`Рядок заголовків ${m.headerRow + 1} поза межами аркуша`);
  if (!Number.isInteger(m.firstDataRow) || m.firstDataRow <= m.headerRow || m.firstDataRow >= grid.length) errors.push(`Перший рядок даних ${m.firstDataRow + 1} має бути після заголовків і в межах аркуша`);
  const used = new Map<ImportField, number[]>();
  for (const [k, f] of Object.entries(m.columns)) {
    const i = Number(k);
    if (!Number.isInteger(i) || i < 0 || i >= width) errors.push(`Колонка ${i + 1} поза межами аркуша (${width} колонок)`);
    if (!FIELD_BY_ID.has(f)) errors.push(`Невідоме поле «${f}» у колонці ${i + 1}`);
    if (f !== "ignore") used.set(f, [...(used.get(f) ?? []), i]);
  }
  const req = requiredFields(mode);
  for (const f of req.all) if (!used.has(f)) errors.push(`Не вказано колонку «${fieldLabel(f)}»`);
  if (req.anyOf && !req.anyOf.some((f) => used.has(f))) errors.push(`Потрібна хоча б одна з колонок: ${req.anyOf.map(fieldLabel).join(" або ")}`);
  if (!used.has("month") && !used.has("periodStart") && !used.has("periodEnd")) errors.push("Не вказано період: колонка «Місяць» або «Початок»");
  for (const [f, idx] of used) {
    if (idx.length > 1 && !FIELD_BY_ID.get(f)?.multi) {
      if (f === "income" || f === "cost") warnings.push(`«${fieldLabel(f)}» з ${idx.length} колонок — значення буде складено`);
      else warnings.push(`«${fieldLabel(f)}» з ${idx.length} колонок — тексти буде обʼєднано`);
    }
  }
  if (mode === "budget" && !used.has("carrier") && !used.has("workType")) warnings.push("Немає колонок «Носій» і «Вид робіт» — роботи буде важко відрізнити одну від одної");
  if (mode === "final" && !used.has("carrier")) warnings.push("Немає колонки «Носій» — зіставлення тільки за кодом проєкту і місяцем");
  // Колонки сум мають містити числа.
  for (const f of ["income", "cost"] as const) {
    for (const i of used.get(f) ?? []) {
      const vals = grid.slice(m.firstDataRow, m.firstDataRow + 30).map((r) => r?.[i]).filter((c) => cellText(c));
      const nums = vals.filter((c) => parseAmount(c) !== undefined).length;
      if (vals.length >= 3 && nums / vals.length < 0.5) warnings.push(`У колонці ${i + 1} («${fieldLabel(f)}») мало чисел — перевірте відповідність`);
    }
  }
  return { errors, warnings };
}

/** Шаблон, підпис якого збігається з рядком заголовків цього аркуша. */
export function findTemplate(templates: ImportTemplate[], grid: Grid): ImportTemplate | undefined {
  for (const t of [...templates].reverse()) {
    const sig = headerSignature(grid, t.mapping.headerRow);
    if (sig && sig === t.signature) return t;
  }
  return undefined;
}

/** Колонки масивом [{index, field}] (формат відповіді моделі) → Record. */
export function columnsFromList(width: number, list: { index: number; field: ImportField }[]): Record<number, ImportField> {
  const out: Record<number, ImportField> = {};
  for (let i = 0; i < width; i++) out[i] = "ignore";
  for (const c of list) if (Number.isInteger(c.index) && c.index >= 0 && c.index < width) out[c.index] = c.field;
  return out;
}
