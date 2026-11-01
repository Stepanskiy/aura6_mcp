// Інструменти чату = open_* «лаунчери» власного MCP-сервера. Чисті функції, без доступу до даних обліку.
import type { ToolDef, ToolCall } from "../../llm/openrouter";
import { LAUNCH, REPORT_DIMENSIONS, REPORT_MEASURES, launchUrl } from "../../shell/routes";

const DIMS = Object.keys(REPORT_DIMENSIONS);
const MEASURES = Object.keys(REPORT_MEASURES);
export const PRESETS: Record<string, string> = {
  "margin-by-client": "Маржа за клієнтами",
  "media-by-month": "Медіа за місяцями",
  contractors: "Підрядники",
  "plan-vs-current": "План проти поточного",
  uninvoiced: "Не виставлено",
  managers: "Менеджери",
};

const str = (description: string) => ({ type: "string", description });
const date = (description: string) => ({ type: "string", description: `${description} Формат YYYY-MM-DD.` });

function def(name: string, description: string, properties: Record<string, unknown>, required: string[] = []): ToolDef {
  return { type: "function", function: { name, description, parameters: { type: "object", properties, required } } };
}

export const TOOLS: ToolDef[] = [
  def(
    "open_projects",
    "Відкриває застосунок «Проєкти» — список проєктів з фільтрами. Фрази: «покажи проєкти Київстар», «проєкти бренду X за 2026». Клієнта і бренд передавай так, як сказав користувач (текстом) — застосунок сам знайде збіг. Не для питань про суми — для цього open_reports.",
    { q: str("Пошук за кодом або назвою проєкту."), client: str("Клієнт — як сказав користувач."), brand: str("Бренд — як сказав користувач."), year: { type: "integer", description: "Рік, напр. 2026." } },
  ),
  def(
    "open_project",
    "Відкриває картку одного проєкту за кодом (напр. KST-0015): медіаплан, календар виходів, карта площин (OOH), ефективність діджиталу, рекламні кабінети, версії плану, історія змін. Фрази: «відкрий проєкт KST-0015», «покажи історію змін RZT-0018», «карта площин LFC-0018», «флоучарт по RZT-0021», «ефективність діджиталу по RZT-0021», «підключи кабінет Meta для цього проєкту». Код береш тільки зі слів користувача. Не для створення проєкту — для цього open_project_new.",
    { code: str("Код проєкту, напр. KST-0015."), tab: { type: "string", enum: ["works", "flowchart", "map", "kpi", "cabinets", "versions", "history"], description: "Вкладка: works — роботи медіаплану; flowchart — календар виходів (флоучарт) по носіях; map — карта площин зовнішньої реклами (OOH); kpi — ефективність діджиталу (покази, кліки, CTR, CPM, план/факт); cabinets — рекламні кабінети Meta, Google, TikTok (підключення, синхронізація статистики); versions — версії плану; history — історія змін." } },
    ["code"],
  ),
  def(
    "open_project_new",
    "Відкриває форму створення нового проєкту, за потреби — копією наявного. Фрази: «створи проєкт для Rozetka», «зроби проєкт аналогічний RZT-0018». Сам проєкт не створює — лише відкриває форму.",
    { client: str("Клієнт — як сказав користувач."), copyFrom: str("Код проєкту-зразка для копії, напр. RZT-0018.") },
  ),
  def(
    "open_import",
    "Відкриває імпорт з Excel. mode=budget — завантаження бюджетів проєктів; mode=final — завантаження фінальних (фактичних) сум. Фрази: «завантаж бюджети», «завантаж фінальні суми з файлу».",
    { mode: { type: "string", enum: ["budget", "final"], description: "budget — бюджети, final — фінальні суми." } },
    ["mode"],
  ),
  def(
    "open_invoices",
    "Відкриває список рахунків клієнтам і звірку «план — виставлено». Фрази: «покажи рахунки Carlsberg», «рахунки по проєкту KST-0015». Не для створення рахунку (open_invoice_new) і не для аналізу сум (open_reports).",
    { client: str("Клієнт — як сказав користувач."), project: str("Код проєкту.") },
  ),
  def(
    "open_invoice_new",
    "Відкриває форму нового рахунку клієнту (Ф2). Фрази: «виставити рахунок Carlsberg за жовтень», «рахунок Київстар за 3 квартал», «створи рахунок по проєкту KST-0015 на всю суму», «виставити рахунок по цьому проєкту». Якщо відомий код проєкту — достатньо project: клієнта застосунок визначить сам, НЕ питай клієнта. «На всю суму» / «на весь проєкт» — не передавай from/to: застосунок візьме весь період проєкту і всі невиставлені суми. Інакше період переводь у конкретні дати from/to.",
    { client: str("Клієнт — як сказав користувач (не потрібен, якщо є project)."), from: date("Початок періоду (не передавай для «на всю суму»)."), to: date("Кінець періоду."), project: str("Код проєкту — зі слів користувача або з поточного екрана.") },
  ),
  def(
    "open_reconciliation",
    "Відкриває звірку «заплановано — виставлено» по клієнту за період. Фрази: «звірка з Київстар за вересень», «що виставлено, а що ні по клієнту» (якщо потрібна саме звірка рахунків). Для аналітики за різними вимірами — open_reports.",
    { client: str("Клієнт — як сказав користувач."), from: date("Початок періоду."), to: date("Кінець періоду.") },
  ),
  def(
    "open_reports",
    "Відкриває конструктор звітів з потрібними рядками, колонками, показниками та періодом. Використовуй для БУДЬ-ЯКОГО питання про суми, маржу, дохід, затрати, виставлено/не виставлено, порівняння план/факт. Ти не знаєш цифр — просто налаштуй звіт. Фрази: «яка маржа по Київстар за вересень», «маржа по клієнтах за 3 квартал», «що не виставлено по Нова пошта». Якщо названо конкретного клієнта, став rows=[\"client\"] або [\"project\"] і вкажи період; конкретне значення фільтра застосунок підбере сам.",
    {
      from: date("Початок періоду."),
      to: date("Кінець періоду."),
      rows: { type: "array", items: { type: "string", enum: DIMS }, description: `Виміри рядків. Допустимі: ${DIMS.map((d) => `${d} (${REPORT_DIMENSIONS[d as keyof typeof REPORT_DIMENSIONS]})`).join(", ")}.` },
      cols: { type: "string", enum: DIMS, description: "Вимір колонок (напр. month або quarter)." },
      measures: { type: "array", items: { type: "string", enum: MEASURES }, description: `Показники. Допустимі: ${MEASURES.map((m) => `${m} (${REPORT_MEASURES[m as keyof typeof REPORT_MEASURES]})`).join(", ")}.` },
      preset: { type: "string", enum: Object.keys(PRESETS), description: "Готовий звіт, якщо запит точно збігається з одним із них." },
    },
  ),
];

export const TOOL_NAMES = TOOLS.map((t) => t.function.name);

export interface LaunchInfo {
  tool: string;
  appTitle: string;
  url: string;
  /** Людиночитні параметри для картки. */
  params: { label: string; value: string }[];
  error?: string;
}

const LABELS: Record<string, string> = {
  q: "Пошук", client: "Клієнт", brand: "Бренд", year: "Рік", code: "Код проєкту", tab: "Вкладка", copyFrom: "Копія з", mode: "Режим",
  project: "Проєкт", from: "Період з", to: "Період по", rows: "Рядки", cols: "Колонки", measures: "Показники", preset: "Готовий звіт",
};
const TABS: Record<string, string> = { works: "Медіаплан", flowchart: "Календар виходів", map: "Карта площин", kpi: "Ефективність", cabinets: "Рекламні кабінети", versions: "Версії плану", history: "Історія змін" };
const MODES: Record<string, string> = { budget: "Бюджети", final: "Фінальні суми" };

function toList(v: unknown): string[] {
  const arr = Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [];
  return arr.map((x) => String(x).trim()).filter(Boolean);
}
const toStr = (v: unknown): string | undefined => (v === undefined || v === null || v === "" ? undefined : String(v).trim());

function human(key: string, value: string): string {
  const dim = (id: string) => REPORT_DIMENSIONS[id as keyof typeof REPORT_DIMENSIONS] ?? id;
  const mes = (id: string) => REPORT_MEASURES[id as keyof typeof REPORT_MEASURES] ?? id;
  if (key === "rows") return value.split(",").map(dim).join(", ");
  if (key === "cols") return dim(value);
  if (key === "measures") return value.split(",").map(mes).join(", ");
  if (key === "preset") return PRESETS[value] ?? value;
  if (key === "tab") return TABS[value] ?? value;
  if (key === "mode") return MODES[value] ?? value;
  return value;
}

/** Параметри інструмента → URL запуску SPA (за контрактом LAUNCH). */
export function buildLaunch(tool: string, args: Record<string, unknown>): LaunchInfo {
  const p: Record<string, string | undefined> = {};
  let spec = LAUNCH.projects;
  let path = spec.path;
  const take = (...keys: string[]) => keys.forEach((k) => (p[k] = toStr(args[k])));

  switch (tool) {
    case "open_projects": spec = LAUNCH.projects; path = spec.path; take("q", "client", "brand", "year"); break;
    case "open_project": {
      spec = LAUNCH.project;
      const code = toStr(args.code);
      if (!code) return { tool, appTitle: spec.title, url: "", params: [], error: "Не вказано код проєкту" };
      path = spec.path.replace(":code", encodeURIComponent(code));
      p.tab = String(args.tab) in TABS ? String(args.tab) : undefined;
      break;
    }
    case "open_project_new": spec = LAUNCH.projectNew; path = spec.path; take("client", "copyFrom"); break;
    case "open_import": {
      spec = LAUNCH.import; path = spec.path;
      const mode = String(args.mode);
      if (mode !== "budget" && mode !== "final") return { tool, appTitle: spec.title, url: "", params: [], error: "mode має бути budget або final" };
      p.mode = mode;
      break;
    }
    case "open_invoices": spec = LAUNCH.invoices; path = spec.path; take("client", "project"); break;
    case "open_invoice_new": spec = LAUNCH.invoiceNew; path = spec.path; take("client", "from", "to", "project"); break;
    case "open_reconciliation": spec = LAUNCH.invoices; path = "/invoices/reconciliation"; take("client", "from", "to"); break;
    case "open_reports": {
      spec = LAUNCH.reports; path = spec.path; take("from", "to");
      const rows = toList(args.rows).filter((d) => d in REPORT_DIMENSIONS);
      const measures = toList(args.measures).filter((m) => m in REPORT_MEASURES);
      if (rows.length) p.rows = rows.join(",");
      if (measures.length) p.measures = measures.join(",");
      const cols = toStr(args.cols);
      if (cols && cols in REPORT_DIMENSIONS) p.cols = cols;
      const preset = toStr(args.preset);
      if (preset && preset in PRESETS) p.preset = preset;
      break;
    }
    default:
      return { tool, appTitle: tool, url: "", params: [], error: `Невідомий інструмент ${tool}` };
  }
  const clean = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)) as Record<string, string>;
  const shown = tool === "open_project" ? { code: String(args.code), ...clean } : clean;
  return {
    tool,
    appTitle: tool === "open_reconciliation" ? "Звірка рахунків" : spec.title,
    url: launchUrl(path, clean),
    params: Object.entries(shown).map(([k, v]) => ({ label: LABELS[k] ?? k, value: human(k, v) })),
  };
}

export function parseArgs(tc: ToolCall): Record<string, unknown> {
  try {
    const v = JSON.parse(tc.function.arguments || "{}");
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Результат інструмента для моделі: жодних даних, лише факт відкриття. */
export function toolResult(info: LaunchInfo): string {
  return info.error
    ? JSON.stringify({ status: "error", message: info.error })
    : JSON.stringify({ status: "opened", app: info.appTitle });
}

/** Запасний варіант для слабких моделей: у тексті є JSON {"tool": "...", "args": {...}}. */
export function parseFallbackToolCall(text: string | null): ToolCall | null {
  if (!text) return null;
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```(?:json)?/g, "");
  const s = cleaned.indexOf("{");
  const e = cleaned.lastIndexOf("}");
  if (s < 0 || e <= s) return null;
  try {
    const o = JSON.parse(cleaned.slice(s, e + 1)) as { tool?: unknown; name?: unknown; args?: unknown; arguments?: unknown };
    const name = String(o.tool ?? o.name ?? "");
    if (!TOOL_NAMES.includes(name)) return null;
    const args = o.args ?? o.arguments ?? {};
    return {
      id: `fallback_${Date.now()}`,
      type: "function",
      function: { name, arguments: typeof args === "string" ? args : JSON.stringify(args) },
    };
  } catch {
    return null;
  }
}

const UA_MONTHS = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];

/** Що зараз відкрито у користувача: лише маршрут і коди з адресного рядка, без даних обліку. */
export interface ScreenContext {
  app: string;
  projectCode?: string;
  invoice?: string;
  query?: string;
}

export function describeScreen(c: ScreenContext | undefined): string {
  if (!c) return "невідомо";
  const parts = [c.app];
  if (c.projectCode) parts.push(`проєкт ${c.projectCode}`);
  if (c.invoice) parts.push(`рахунок ${c.invoice}`);
  if (c.query) parts.push(`параметри: ${c.query}`);
  return parts.join(", ");
}

export function systemPrompt(now = new Date(), screen?: ScreenContext): string {
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const y = now.getFullYear();
  const m = now.getMonth();
  const prevStart = new Date(y, m - 1, 1);
  const prevEnd = new Date(y, m, 0);
  const q = Math.floor(m / 3);
  const wd = ["неділя", "понеділок", "вівторок", "середа", "четвер", "пʼятниця", "субота"][now.getDay()];
  return `Ти — помічник у системі управлінського обліку рекламного агентства «Аура 6». Ти працюєш як клієнт MCP-сервера: твої інструменти open_* відкривають потрібний застосунок з готовими параметрами.

ГОЛОВНЕ ПРАВИЛО. Ти не знаєш і не бачиш жодних даних обліку (суми, проєкти, клієнти, рахунки). Ніколи не вигадуй цифр і не відповідай по суті даних. Твоя задача — зрозуміти, що хоче користувач, і відкрити правильний застосунок з параметрами зі слів користувача. Далі користувач працює в застосунку сам.

ПИТАННЯ ПРО ДАНІ. Якщо користувач питає про суми, маржу, дохід, затрати, «що не виставлено», порівняння плану з фактом — викликай open_reports з доречними rows (виміри), measures (показники) і періодом from/to, а відповідай коротко, що звіт відкрито. Приклад: «яка маржа по Київстар за вересень?» → open_reports(from=${y}-09-01, to=${y}-09-30, rows=["client"], measures=["income","cost","margin","marginPct"]).

ПАРАМЕТРИ. Клієнта, бренд, проєкт передавай текстом так, як сказав користувач — застосунок сам знайде збіг. Коди проєктів (напр. KST-0015) — лише ті, що назвав користувач або що видно з поточного екрана. Не заповнюй параметри, яких користувач не казав.

ПОТОЧНИЙ ЕКРАН. Зараз у користувача відкрито: ${describeScreen(screen)}. Слова «цей проєкт», «по ньому», «тут», «на всю суму» стосуються саме цього екрана: бери код проєкту звідси і не перепитуй. Приклад: відкрита картка проєкту KST-0015, користувач каже «створи рахунок клієнту на всю суму» → open_invoice_new(project="KST-0015") без client і без from/to.

ДАТИ. Сьогодні ${iso(now)} (${wd}, ${now.getDate()} ${UA_MONTHS[m]} ${y}). Відносні періоди переводь у конкретні ISO-дати YYYY-MM-DD:
- «цей місяць» = ${iso(new Date(y, m, 1))} … ${iso(new Date(y, m + 1, 0))};
- «минулий місяць» = ${iso(prevStart)} … ${iso(prevEnd)};
- «цей квартал» = ${iso(new Date(y, q * 3, 1))} … ${iso(new Date(y, q * 3 + 3, 0))};
- «3 квартал» (без року — цього року) = ${y}-07-01 … ${y}-09-30; аналогічно 1 кв. = 01-01…03-31, 2 кв. = 04-01…06-30, 4 кв. = 10-01…12-31;
- назва місяця без року — цей рік; «рік»/«${y} рік» = ${y}-01-01 … ${y}-12-31.

СТИЛЬ. Відповідай українською, дуже коротко (1–2 речення). Після виклику інструмента просто підтверди, що відкрито, без переказу параметрів. Якщо запит неясний або не стосується обліку — коротко уточни або поясни, що вмієш. Можна викликати кілька інструментів, якщо користувач просить про кілька дій.`;
}
