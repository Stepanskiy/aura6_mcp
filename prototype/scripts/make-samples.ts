// Генерує зразки файлів для імпорту в samples/. Запуск: npm run samples
import * as XLSXns from "xlsx";
import { createSeed } from "../src/data/seed.ts";
import * as fs from "node:fs";
const { mkdirSync } = fs;

const XLSX: typeof XLSXns = (XLSXns as any).default ?? XLSXns;
(XLSX as any).set_fs(fs);
const seed = createSeed();
mkdirSync("samples", { recursive: true });

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(777);
const r2 = (n: number) => Math.round(n * 100) / 100;
const D = (s: string) => new Date(s + "T00:00:00Z");

function nextCode(prefix: string): string {
  const nums = seed.projects.filter((p) => p.code.startsWith(prefix + "-")).map((p) => Number(p.code.slice(4)));
  const max = nums.length ? Math.max(...nums) : 0;
  return `${prefix}-${String(max + 3).padStart(4, "0")}`;
}

function saveSheet(file: string, sheetName: string, aoa: unknown[][], widths: number[]) {
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  for (const addr of Object.keys(ws)) {
    if (addr[0] === "!") continue;
    const c = (ws as any)[addr];
    if (c.t === "d") c.z = "dd.mm.yyyy";
    else if (c.t === "n") c.z = "#,##0.00";
  }
  ws["!cols"] = widths.map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, file, { cellDates: true });
}

// ---------- A: один файл, 5 нових проєктів, аркуш «Медіаплан» ----------
// рядок: медіа, носій, формат, продавець, початок, кінець, бюджет, закупівля, примітка
type RowA = [string, string, string, string, string, string, number, number, string];
interface ProjA {
  prefix: string;
  client: string;
  brand: string;
  name: string;
  rows: RowA[];
}
const projA: ProjA[] = [
  { prefix: "KST", client: "Київстар", brand: "Київстар", name: "Київстар — зимова кампанія 2027", rows: [
    ["ТБ", "1+1", "Ролик 30\"", "1+1 media", "2027-01-11", "2027-01-31", 1850000, 1660000, ""],
    ["ТБ", "СТБ", "Ролик 20\"", "Starlight Media", "2027-01-11", "2027-02-28", 1240000, 1110000, ""],
    ["Діджитал", "Ютуб", "Pre-roll 15\"", "Google Ireland Ltd", "2027-01-15", "2027-03-15", 640000, 590000, "bumper + in-stream"],
    ["Зовнішня", "Білборд 6х3 Київ", "6×3", "BigMedia", "2027-02-01", "2027-02-28", 410000, 365000, ""],
  ] },
  { prefix: "RZT", client: "Rozetka", brand: "Rozetka", name: "Rozetka — весняний розпродаж 2027", rows: [
    ["Діджитал", "Фейсбук/Інстаграм", "Пост/сторіз", "Meta Platforms Ireland Ltd", "2027-02-15", "2027-03-31", 520000, 480000, ""],
    ["Діджитал", "TikTok", "Пост/сторіз", "TikTok Information Technologies UK", "2027-02-15", "2027-03-31", 330000, 300000, ""],
    ["Діджитал", "Google Search", "Пошукова реклама CPC", "Google Ireland Ltd", "2027-02-15", "2027-03-31", 280000, 262000, "бюджет на кліки"],
    ["ТБ", "Еспресо", "Ролик 20\"", "Еспресо TV", "2027-03-01", "2027-03-21", 150000, 135000, "новий носій"],
  ] },
  { prefix: "NST", client: "Нестле Україна", brand: "Nescafé", name: "Nescafé — Q1 2027 підтримка", rows: [
    ["ТБ", "ТЕТ", "Ролик 30\"", "1+1 media", "2027-01-18", "2027-02-14", 960000, 860000, ""],
    ["ТБ", "Новий", "Ролик 30\"", "Starlight Media", "2027-01-18", "2027-02-14", 1120000, 1000000, "скорочена назва каналу"],
    ["Радіо", "Хіт ФМ", "Ролик 30\"", "TAVR Media", "2027-02-01", "2027-02-28", 135000, 120000, ""],
    ["Зовнішня", "сітілайти Київ", "сітілайт", "BigMedia", "2027-02-01", "2027-03-14", 275000, 246000, ""],
    ["Діджитал", "Sweet.tv", "Pre-roll 15\"", "Sweet.tv", "2027-02-01", "2027-03-14", 180000, 160000, ""],
  ] },
  { prefix: "CRL", client: "Carlsberg Ukraine", brand: "Карпатське", name: "Карпатське — літній сезон 2027 (передзаявка)", rows: [
    ["ТБ", "ICTV2", "Ролик 30\"", "Starlight Media", "2027-03-01", "2027-03-31", 780000, 700000, ""],
    ["Радіо", "Радіо Аристократи", "Ролик 30\"", "Аристократи Медіа", "2027-03-01", "2027-03-31", 90000, 80000, "носія немає в довіднику"],
    ["Зовнішня", "Цифрові екрани Київ", "Digital screen 10\"", "BigMedia", "2027-03-01", "2027-03-31", 310000, 280000, ""],
  ] },
  { prefix: "PRB", client: "ПриватБанк", brand: "Приват24", name: "Приват24 — мобільний застосунок, Q1 2027", rows: [
    ["Діджитал", "Ютуб", "Pre-roll 15\"", "Google Ireland Ltd", "2027-01-10", "2027-03-31", 870000, 800000, ""],
    ["Діджитал", "Фейсбук/Інстаграм", "Пост/сторіз", "Meta Platforms Ireland Ltd", "2027-01-10", "2027-03-31", 690000, 640000, ""],
    ["Діджитал", "Ukr.net", "Банер 300×250", "Ukr.net", "2027-01-10", "2027-03-31", 240000, 215000, ""],
    ["ТБ", "Інтер", "Спонсорство", "Inter Media Group", "2027-02-01", "2027-02-28", 1500000, 1350000, "спонсорство прогнозу погоди"],
  ] },
];
const hdrA = ["Код проекту", "Назва проекту", "Клієнт", "Бренд", "Медіа", "Носій", "Формат", "Продавець", "Початок", "Кінець", "Бюджет клієнту, грн без ПДВ", "Закупівля, грн без ПДВ", "Примітка"];
const aoaA: unknown[][] = [["Демо Медіа Агенція"], ["Медіаплани на I квартал 2027"], [], hdrA];
const newCodesA: string[] = [];
let totB = 0;
let totC = 0;
for (const p of projA) {
  const code = nextCode(p.prefix);
  newCodesA.push(code);
  let sb = 0;
  let sc = 0;
  for (const r of p.rows) {
    aoaA.push([code, p.name, p.client, p.brand, r[0], r[1], r[2], r[3], D(r[4]), D(r[5]), r[6], r[7], r[8] || undefined]);
    sb += r[6];
    sc += r[7];
  }
  aoaA.push([`Разом по проекту ${code}`, "", "", "", "", "", "", "", "", "", sb, sc, ""]);
  totB += sb;
  totC += sc;
}
aoaA.push(["ВСЬОГО", "", "", "", "", "", "", "", "", "", totB, totC, ""]);
saveSheet("samples/бюджети-формат-A.xlsx", "Медіаплан", aoaA, [14, 44, 20, 16, 12, 24, 20, 32, 12, 12, 24, 22, 28]);

// ---------- B: інший планер, змішані заголовки, порожні рядки ----------
const existing =
  seed.projects.find((p) => p.status === "active" && (p.startDate ?? "") <= "2026-11-01" && (p.endDate ?? "") >= "2026-12-31") ??
  seed.projects.find((p) => p.status === "active" && (p.endDate ?? "") >= "2026-10-31")!;
const exClient = seed.clients.find((c) => c.id === existing.clientId)!;
const exBrand = seed.brands.find((b) => b.id === existing.brandId)!;
const hdrB = ["Project ID", "Advertiser", "Brand", "Month", "Media", "Channel / Site", "Ad format", "Vendor", "Gross to client (UAH, excl. VAT)", "Net cost (UAH)", "Comment"];
const codeVDF = nextCode("VDF");
const codeUNL = nextCode("UNL");
const codeEPC = nextCode("EPC");
const rowsB: (unknown[] | null)[] = [
  [codeVDF, "Vodafone Україна", "Vodafone", "лют.27", "TV", "Новий канал", "Ролик 30 сек", "Starlight", 1420000, 1275000, ""],
  [codeVDF, "Vodafone Україна", "Vodafone", "березень 2027", "TV", "Новий канал", "Ролик 30 сек", "Starlight", 1380000, 1240000, ""],
  [codeVDF, "Vodafone Україна", "Vodafone", "лют.27", "Digital", "YouTube", "pre-roll", "Google", 410000, 372000, "кампанія 5G"],
  null,
  [codeUNL, "Unilever Україна", "Dove", "січень 2027", "Radio", "Kiss FM", "Ролик 30\"", "TAVR", 112000, 99000, ""],
  [codeUNL, "Unilever Україна", "Dove", "січень 2027", "OOH", "Білборди 6×3 Київ", "6x3", "BigMedia", 345000, 312000, ""],
  [codeUNL, "Unilever Україна", "Dove", "лют.27", "OOH", "Білборди 6×3 Київ", "6x3", "BigMedia", "345 000", 312000, "сума текстом"],
  null,
  null,
  [codeEPC, "Епіцентр К", "Епіцентр", "квітень 2027", "Digital", "Meta", "stories", "Meta Platforms Ireland", 260000, 238000, ""],
  [codeEPC, "Епіцентр К", "Епіцентр", "квітень 2027", "Digital", "Google Search", "CPC", "Google", 190000, 176000, ""],
  null,
  [existing.code, exClient.name, exBrand.name, "листопад 2026", "Digital", "TikTok", "пост/сторіз", "TikTok Information Technologies UK", 295000, 268000, "додатковий флайт"],
  [existing.code, exClient.name, exBrand.name, "грудень 2026", "Radio", "Хіт FM", "Ролик 30\"", "TAVR Media", 88000, 79000, "додатковий флайт"],
];
saveSheet("samples/бюджети-формат-B.xlsx", "Plan", [hdrB, ...rowsB.map((r) => r ?? [])], [12, 20, 14, 16, 10, 22, 16, 24, 24, 16, 20]);

// ---------- C: фінальні суми для існуючих незакритих робіт ----------
const WT_PLACEMENT = new Set(["wt-tv", "wt-radio", "wt-ooh", "wt-digital"]);
const cand = seed.works.filter(
  (w) => !w.closed && WT_PLACEMENT.has(w.workTypeId) && w.carrierId && w.formatId && w.periodEnd < "2026-10-01" && w.periodStart >= "2026-05-01",
);
const byProj = new Map<string, typeof cand>();
for (const w of cand) byProj.set(w.projectId, [...(byProj.get(w.projectId) ?? []), w]);
const targets = [...byProj.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 4);
const carName = (id?: string) => seed.carriers.find((c) => c.id === id)!.name;
const fmtName = (id?: string) => seed.formats.find((f) => f.id === id)!.name;
const rowsC: unknown[][] = [];
const sources = ["Ефірна довідка", "Акт виконаних робіт", "Постфактум-звіт"];
const targetInfo: string[] = [];
for (const [pid, ws] of targets) {
  const code = seed.projects.find((p) => p.id === pid)!.code;
  for (const w of ws.slice(0, 3)) {
    const f = 0.92 + rnd() * 0.13; // -8%..+5%
    rowsC.push([code, carName(w.carrierId), fmtName(w.formatId), w.periodStart.slice(0, 7), r2(w.income * f), r2(w.cost * (0.92 + rnd() * 0.13)), sources[Math.floor(rnd() * sources.length)]]);
    targetInfo.push(`${code} | ${carName(w.carrierId)} | ${fmtName(w.formatId)} | ${w.periodStart.slice(0, 7)} | ${w.id} income=${w.income} cost=${w.cost}`);
  }
}
// рядок, якому не відповідає жодна робота
const firstCode = seed.projects.find((p) => p.id === targets[0][0])!.code;
const firstId = targets[0][0];
const noMatch = seed.carriers.find(
  (c) => c.mediaType === "Radio" && !seed.works.some((w) => w.projectId === firstId && w.carrierId === c.id),
)!;
rowsC.splice(2, 0, [firstCode, noMatch.name, "Ролик 30\"", "2026-09", 125000, 112000, "Ефірна довідка"]);
saveSheet(
  "samples/фінальні-суми.xlsx",
  "Фінал",
  [["Проект", "Носій", "Формат", "Період", "Фінальна сума клієнту", "Фінальна вартість підрядника", "Джерело"], ...rowsC],
  [12, 26, 22, 10, 22, 26, 22],
);

// ---------- перевірка ----------
for (const f of ["бюджети-формат-A", "бюджети-формат-B", "фінальні-суми"]) {
  const wb = XLSX.readFile(`samples/${f}.xlsx`, { cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as unknown[][];
  console.log(`${f}.xlsx  sheet="${wb.SheetNames[0]}"  rows=${rows.length}`);
}
console.log("A new codes:", newCodesA.join(", "));
console.log("B new:", codeVDF, codeUNL, codeEPC, "existing:", existing.code, existing.name, existing.startDate, existing.endDate);
console.log("C targets:\n" + targetInfo.join("\n"));
