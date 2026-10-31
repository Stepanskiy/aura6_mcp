// Контракт запуску SPA: маршрут + параметри запиту (query). Це прообраз open_* tools MCP:
// чат, каталог або посилання відкривають SPA тільки через ці параметри, дані не передаються.
// Параметри-«підказки» (client, brand…) — текст, як його сказав користувач; SPA сама шукає збіг.

export interface LaunchSpec {
  path: string;
  title: string;
  description: string;
  params: Record<string, string>;
}

export const LAUNCH: Record<string, LaunchSpec> = {
  projects: {
    path: "/projects",
    title: "Проєкти",
    description: "Список проєктів з фільтрами",
    params: { q: "пошук за кодом або назвою", client: "підказка: клієнт", brand: "підказка: бренд", year: "рік" },
  },
  projectNew: {
    path: "/projects/new",
    title: "Новий проєкт",
    description: "Створення проєкту, зокрема копією наявного",
    params: { client: "підказка: клієнт", copyFrom: "код проєкту-зразка" },
  },
  project: {
    path: "/projects/:code",
    title: "Картка проєкту",
    description: "Медіаплан, версії плану, історія змін",
    params: { tab: "works | versions | history" },
  },
  import: {
    path: "/import",
    title: "Імпорт з Excel",
    description: "Бюджети проєктів або фінальні суми з одного файлу на багато проєктів",
    params: { mode: "budget | final" },
  },
  invoices: {
    path: "/invoices",
    title: "Рахунки клієнтам",
    description: "Список рахунків і звірка план — виставлено",
    params: { client: "підказка: клієнт", project: "код проєкту" },
  },
  invoiceNew: {
    path: "/invoices/new",
    title: "Новий рахунок",
    description: "Рахунок клієнту за період з бюджету (мультибренд)",
    params: { client: "підказка: клієнт", from: "YYYY-MM-DD", to: "YYYY-MM-DD", project: "код проєкту" },
  },
  invoice: {
    path: "/invoices/:id",
    title: "Рахунок",
    description: "Перегляд і друкована форма рахунку",
    params: {},
  },
  reports: {
    path: "/reports",
    title: "Звіти",
    description: "Конструктор звітів за період",
    params: { from: "YYYY-MM-DD", to: "YYYY-MM-DD", rows: "виміри через кому", cols: "вимір колонок", measures: "показники через кому", preset: "назва готового звіту" },
  },
  chat: {
    path: "/chat",
    title: "Помічник",
    description: "Відкриває бічну панель помічника; він запускає потрібну SPA з параметрами",
    params: {},
  },
};

/** Побудувати посилання запуску SPA. */
export function launchUrl(path: string, params: Record<string, string | number | undefined> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

// Спільний контракт звітів: ідентифікатори вимірів і показників.
// Реалізує модуль reports; чат передає їх у параметрах rows / cols / measures.
export const REPORT_DIMENSIONS = {
  client: "Клієнт",
  brand: "Бренд",
  project: "Проєкт",
  direction: "Напрям",
  manager: "Менеджер",
  workType: "Вид робіт",
  mediaType: "Медіа",
  carrier: "Носій",
  format: "Формат",
  contractor: "Підрядник",
  month: "Місяць",
  quarter: "Квартал",
  year: "Рік",
  status: "Статус проєкту",
} as const;

export const REPORT_MEASURES = {
  income: "Дохід",
  cost: "Затрата",
  margin: "Маржа",
  marginPct: "Маржа, %",
  planIncome: "Дохід за планом",
  deltaIncome: "Відхилення доходу від плану",
  invoiced: "Виставлено",
  uninvoiced: "Не виставлено",
  closedIncome: "Закрито (дохід)",
  closedCost: "Закрито (затрата)",
  works: "Кількість робіт",
} as const;

export type ReportDimension = keyof typeof REPORT_DIMENSIONS;
export type ReportMeasure = keyof typeof REPORT_MEASURES;
