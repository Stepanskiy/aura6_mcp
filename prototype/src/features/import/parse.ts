// Детермінований розбір рядків аркуша за відображенням колонок (SheetMapping).
// Модель сюди не потрапляє: суми, дати й місяці читає тільки цей код.
import type { ImportField, SheetMapping } from "../../domain/types";
import { normName, round2 } from "../../domain/calc";

export type Cell = string | number | boolean | Date | null | undefined;
export type Grid = Cell[][];

export interface SheetData {
  name: string;
  rows: Grid;
}

// ───────────── клітинки ─────────────

export function cellText(c: Cell): string {
  if (c === null || c === undefined) return "";
  if (c instanceof Date) return dateToIso(c) ?? "";
  return String(c).replace(/\s+/g, " ").trim();
}

export function isBlank(c: Cell): boolean {
  return cellText(c) === "";
}

export function gridWidth(grid: Grid): number {
  let w = 0;
  for (const r of grid) if (r && r.length > w) w = r.length;
  return w;
}

// ───────────── суми ─────────────

/**
 * Сума з числа або рядка: «1 234 567,89», «1,234,567.89», «1.234.567,89», «(1 200)», «12 000 грн».
 * undefined — якщо клітинка порожня або це не число.
 */
export function parseAmount(c: Cell): number | undefined {
  if (typeof c === "number") return isFinite(c) ? round2(c) : undefined;
  if (typeof c === "boolean" || c instanceof Date) return undefined;
  let s = cellText(c);
  if (!s || s === "-" || s === "—" || s === "–") return undefined;
  let neg = false;
  // \s у JS охоплює й нерозривні пробіли (U+00A0, U+202F), якими Excel розділяє тисячі.
  s = s.replace(/[\s']/g, "").replace(/(грн|uah|₴|usd|eur|\$|€)\.?/gi, "");
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-") || s.startsWith("−")) {
    neg = !neg;
    s = s.slice(1);
  }
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return undefined;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    const dec = lastComma > lastDot ? "," : ".";
    const thou = dec === "," ? "." : ",";
    s = s.split(thou).join("").replace(dec, ".");
  } else if (lastComma >= 0) {
    s = (s.match(/,/g)!.length > 1 ? s.split(",").join("") : s.replace(",", "."));
  } else if (lastDot >= 0 && s.match(/\./g)!.length > 1) {
    s = s.split(".").join("");
  }
  const n = Number(s);
  if (!isFinite(n)) return undefined;
  return round2(neg ? -n : n);
}

// ───────────── дати ─────────────

const pad = (n: number) => String(n).padStart(2, "0");

export function isoDate(y: number, m: number, d: number): string | undefined {
  if (!(y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return undefined;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return undefined;
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function monthBounds(y: number, m: number): { start: string; end: string } {
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(last)}` };
}

export function endOfMonth(iso: string): string {
  return monthBounds(Number(iso.slice(0, 4)), Number(iso.slice(5, 7))).end;
}

/**
 * Дата з клітинки Excel (cellDates) → ISO за місцевим «настінним» часом, округлено до найближчого дня:
 * SheetJS може дати 23:59:59 попереднього дня або 02:00 через часовий пояс.
 */
export function dateToIso(d: Date): string | undefined {
  if (isNaN(d.getTime())) return undefined;
  const wall = d.getTime() - d.getTimezoneOffset() * 60000;
  const day = new Date(Math.round(wall / 86400000) * 86400000);
  return isoDate(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate());
}

/** Excel serial (1900 date system) → ISO. Дробова частина (час) відкидається з округленням. */
export function serialToIso(n: number): string | undefined {
  if (!(n > 20000 && n < 80000)) return undefined;
  const dt = new Date((Math.round(n) - 25569) * 86400000);
  return isoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

const year4 = (y: number) => (y < 100 ? 2000 + y : y);

/** Дата з Excel serial, ISO, dd.mm.yyyy, dd/mm/yy. */
export function parseDate(c: Cell): string | undefined {
  if (typeof c === "number") return serialToIso(c);
  if (c instanceof Date) return dateToIso(c);
  const s = cellText(c);
  if (!s) return undefined;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return isoDate(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (m) return isoDate(year4(+m[3]), +m[2], +m[1]);
  if (/^\d+(\.\d+)?$/.test(s)) return serialToIso(Number(s));
  return undefined;
}

/** Основи назв місяців: укр., рос., англ. Порядок важливий — довші й специфічніші першими. */
const MONTH_STEMS: [string, number][] = [
  ["січ", 1], ["лют", 2], ["бер", 3], ["квіт", 4], ["трав", 5], ["черв", 6], ["лип", 7], ["серп", 8], ["вер", 9], ["жовт", 10], ["лист", 11], ["груд", 12],
  ["янв", 1], ["фев", 2], ["мар", 3], ["апр", 4], ["мая", 5], ["май", 5], ["июн", 6], ["июл", 7], ["авг", 8], ["сен", 9], ["окт", 10], ["ноя", 11], ["дек", 12],
  ["jan", 1], ["feb", 2], ["mar", 3], ["apr", 4], ["may", 5], ["jun", 6], ["jul", 7], ["aug", 8], ["sep", 9], ["oct", 10], ["nov", 11], ["dec", 12],
];

function monthByWord(w: string): number | undefined {
  const t = w.toLowerCase();
  for (const [stem, n] of MONTH_STEMS) if (t.startsWith(stem)) return n;
  return undefined;
}

/**
 * Місяць → межі місяця. Приймає: Excel serial / дату (місяць дати), «2027-02», «2027.02», «02.2027», «2/2027»,
 * «лют.27», «лют 2027», «березень 2027», «Feb-27», «February 2027», «2027 березень».
 */
export function parseMonth(c: Cell): { start: string; end: string } | undefined {
  if (typeof c === "number" || c instanceof Date) {
    const d = parseDate(c);
    return d ? monthBounds(+d.slice(0, 4), +d.slice(5, 7)) : undefined;
  }
  const s = cellText(c).toLowerCase();
  if (!s) return undefined;
  const ok = (y: number, m: number) => (y >= 1990 && y <= 2100 && m >= 1 && m <= 12 ? monthBounds(y, m) : undefined);
  let m = s.match(/^(\d{4})[-./](\d{1,2})$/);
  if (m) return ok(+m[1], +m[2]);
  m = s.match(/^(\d{1,2})[-./](\d{4}|\d{2})$/);
  if (m) return ok(year4(+m[2]), +m[1]);
  const full = parseDate(s);
  if (full) return monthBounds(+full.slice(0, 4), +full.slice(5, 7));
  // Слова: «лют.27», «березень 2027», «feb-27», «2027 березень»
  const words = s.match(/[a-zа-яіїєґё]+/gi);
  const nums = s.match(/\d+/g);
  if (words && nums && nums.length === 1) {
    for (const w of words) {
      const mn = monthByWord(w);
      if (mn) {
        const y = +nums[0];
        if (nums[0].length === 2 || nums[0].length === 4) return ok(year4(y), mn);
      }
    }
  }
  return undefined;
}

// ───────────── рядки ─────────────

const SUBTOTAL_WORDS = new Set(["разом", "всього", "усього", "итого", "всего", "підсумок", "підсумки", "итог", "total", "subtotal", "totals"]);

/** Схоже на рядок підсумку: «Разом», «ВСЬОГО по проєкту», «Итого:», «Grand total». */
export function isSubtotalText(text: string): boolean {
  //  у JS не працює з кирилицею — ділимо на слова вручну.
  const words = text.toLowerCase().split(/[^0-9a-zа-яіїєґё]+/i).filter(Boolean);
  if (!words.length) return false;
  if (SUBTOTAL_WORDS.has(words[0])) return true;
  if (words[0] === "grand" && words[1] === "total") return true;
  return words.length <= 3 && SUBTOTAL_WORDS.has(words[words.length - 1]);
}

/** Нормалізовані заголовки через «|» — підпис формату файлу для шаблонів. */
export function headerSignature(grid: Grid, headerRow: number): string {
  const row = grid[headerRow] ?? [];
  const cells = row.map((c) => normName(cellText(c)));
  while (cells.length && !cells[cells.length - 1]) cells.pop();
  return cells.join("|");
}

export type TextField = Exclude<ImportField, "periodStart" | "periodEnd" | "month" | "income" | "cost" | "ignore">;

export const TEXT_FIELDS: TextField[] = ["projectCode", "projectName", "client", "brand", "direction", "manager", "workType", "carrier", "format", "contractor", "description"];

export interface ParsedRow {
  /** Індекс рядка в аркуші (з 0); у UI показується +1, як у Excel. */
  rowIndex: number;
  text: Partial<Record<TextField, string>>;
  periodStart?: string;
  periodEnd?: string;
  income?: number;
  cost?: number;
  warnings: string[];
}

export type SkipReason = "empty" | "subtotal" | "pattern" | "header" | "no-code" | "no-amount" | "no-period";

export const SKIP_LABEL: Record<SkipReason, string> = {
  empty: "порожній",
  subtotal: "підсумок",
  pattern: "за шаблоном пропуску",
  header: "повтор заголовка",
  "no-code": "немає коду проєкту",
  "no-amount": "немає сум",
  "no-period": "не визначено період",
};

export interface SkippedRow {
  rowIndex: number;
  reason: SkipReason;
  text: string;
}

export interface ExtractResult {
  rows: ParsedRow[];
  skipped: SkippedRow[];
}

const INHERIT: TextField[] = ["projectCode", "projectName", "client", "brand", "direction", "manager"];

/**
 * Застосувати відображення до всіх рядків аркуша.
 * Пропускає порожні рядки, підсумки, рядки за skipRowPatterns, повтори заголовка.
 * Код проєкту (і шапку) успадковує з рядка вище, якщо клітинку обʼєднано — лише для рядків, що мають носій / формат / вид робіт / опис.
 */
export function extractRows(grid: Grid, mapping: SheetMapping): ExtractResult {
  const rows: ParsedRow[] = [];
  const skipped: SkippedRow[] = [];
  const cols = Object.entries(mapping.columns)
    .map(([i, f]) => [Number(i), f] as [number, ImportField])
    .filter(([, f]) => f !== "ignore");
  const patterns = mapping.skipRowPatterns.map((p) => p.toLowerCase().trim()).filter(Boolean);
  const header = headerSignature(grid, mapping.headerRow);
  const hasCode = cols.some(([, f]) => f === "projectCode");
  let prev: ParsedRow | undefined;

  for (let r = Math.max(0, mapping.firstDataRow); r < grid.length; r++) {
    const row = grid[r] ?? [];
    const texts = row.map(cellText);
    const joined = texts.filter(Boolean).join(" · ");
    if (!joined) {
      skipped.push({ rowIndex: r, reason: "empty", text: "" });
      continue;
    }
    const lower = texts.map((t) => t.toLowerCase());
    if (patterns.length && lower.some((t) => t && patterns.some((p) => t.includes(p)))) {
      skipped.push({ rowIndex: r, reason: "pattern", text: joined });
      continue;
    }
    if (texts.some((t) => t && isSubtotalText(t))) {
      skipped.push({ rowIndex: r, reason: "subtotal", text: joined });
      continue;
    }
    if (header && headerSignature(grid, r) === header) {
      skipped.push({ rowIndex: r, reason: "header", text: joined });
      continue;
    }

    const pr: ParsedRow = { rowIndex: r, text: {}, warnings: [] };
    let month: { start: string; end: string } | undefined;
    for (const [i, f] of cols) {
      const c = row[i];
      if (isBlank(c)) continue;
      switch (f) {
        case "income":
        case "cost": {
          const v = parseAmount(c);
          if (v === undefined) pr.warnings.push(`«${cellText(c)}» у колонці ${i + 1} не схоже на суму`);
          else pr[f] = round2((pr[f] ?? 0) + v);
          break;
        }
        case "periodStart":
        case "periodEnd": {
          const d = parseDate(c);
          if (!d) pr.warnings.push(`«${cellText(c)}» не схоже на дату`);
          else pr[f] = d;
          break;
        }
        case "month": {
          const mm = parseMonth(c);
          if (!mm) pr.warnings.push(`«${cellText(c)}» не схоже на місяць`);
          else month = mm;
          break;
        }
        default: {
          const t = cellText(c);
          const k = f as TextField;
          pr.text[k] = pr.text[k] ? `${pr.text[k]} / ${t}` : t;
        }
      }
    }

    // Обʼєднані клітинки: код і шапка проєкту — з попереднього рядка.
    const isDetail = !!(pr.text.carrier || pr.text.format || pr.text.workType || pr.text.description);
    if (hasCode && !pr.text.projectCode && prev?.text.projectCode && isDetail && (pr.income !== undefined || pr.cost !== undefined)) {
      for (const k of INHERIT) if (!pr.text[k] && prev.text[k]) pr.text[k] = prev.text[k];
      pr.warnings.push("код проєкту взято з рядка вище (обʼєднана клітинка)");
    }

    if (pr.income === undefined && pr.cost === undefined) {
      skipped.push({ rowIndex: r, reason: "no-amount", text: joined });
      continue;
    }
    if (hasCode && !pr.text.projectCode) {
      // Рядок із сумою, але без коду і без деталізації — найчастіше підсумок без слова «Разом».
      skipped.push({ rowIndex: r, reason: isDetail ? "no-code" : "subtotal", text: joined });
      continue;
    }

    if (month) {
      pr.periodStart = pr.periodStart ?? month.start;
      pr.periodEnd = pr.periodEnd ?? month.end;
    }
    if (pr.periodStart && !pr.periodEnd) pr.periodEnd = endOfMonth(pr.periodStart);
    if (!pr.periodStart && pr.periodEnd) pr.periodStart = pr.periodEnd.slice(0, 8) + "01";
    if (pr.periodStart && pr.periodEnd && pr.periodEnd < pr.periodStart) {
      pr.warnings.push("кінець раніше за початок — поміняно місцями");
      [pr.periodStart, pr.periodEnd] = [pr.periodEnd, pr.periodStart];
    }
    if (!pr.periodStart) {
      skipped.push({ rowIndex: r, reason: "no-period", text: joined });
      continue;
    }
    if (pr.text.projectCode) pr.text.projectCode = pr.text.projectCode.toUpperCase().replace(/\s+/g, "");
    rows.push(pr);
    prev = pr;
  }
  return { rows, skipped };
}
