// Цільові поля імпорту: опис для людини і для моделі, ключові слова для евристики.
// Чистий модуль без залежностей від React і сховища.
import type { ImportField, MediaType, RefKind, WorkKind } from "../../domain/types";

export type ImportMode = "budget" | "final";

export interface FieldDef {
  field: ImportField;
  label: string;
  /** Опис для моделі й підказки в UI. */
  description: string;
  /** Ключові слова в назві колонки (нормалізовані, нижній регістр). Короткі (≤4) — тільки ціле слово. */
  keywords: string[];
  /** Чи може кілька колонок відображатися на це поле. */
  multi?: boolean;
}

export const FIELDS: FieldDef[] = [
  { field: "projectCode", label: "Код проєкту", description: "унікальний код проєкту, напр. KST-0012; за ним рядки групуються і зіставляються з проєктами", keywords: ["код проєкту", "код проекту", "код", "project code", "project id", "code", "job", "job no", "№ проєкту", "номер проєкту"] },
  { field: "projectName", label: "Назва проєкту", description: "назва проєкту або кампанії", keywords: ["назва проєкту", "назва проекту", "назва", "проєкт", "проект", "project name", "project", "кампанія", "кампания", "campaign"] },
  { field: "client", label: "Клієнт", description: "клієнт (рекламодавець, замовник)", keywords: ["клієнт", "клиент", "client", "замовник", "заказчик", "customer", "advertiser", "рекламодавець", "рекламодатель"] },
  { field: "brand", label: "Бренд", description: "бренд клієнта", keywords: ["бренд", "brand", "торгова марка", "марка"] },
  { field: "direction", label: "Напрям", description: "напрям проєкту: Медіа, Діджитал, Креатив, BTL", keywords: ["напрям", "направление", "direction", "department", "відділ", "отдел", "бізнес-юніт", "business unit"] },
  { field: "manager", label: "Менеджер", description: "менеджер проєкту", keywords: ["менеджер", "manager", "відповідальний", "ответственный", "account manager", "аккаунт"] },
  { field: "workType", label: "Вид робіт / медіа", description: "вид робіт або вид медіа (Розміщення ТБ, Digital, Продакшн, Агентська винагорода)", keywords: ["вид робіт", "вид работ", "тип робіт", "work type", "service", "послуга", "услуга", "вид", "медіа", "медиа", "media", "media type", "тип медіа"] },
  { field: "carrier", label: "Носій", description: "носій: телеканал, сайт, радіостанція, мережа площин", keywords: ["носій", "носитель", "канал", "телеканал", "майданчик", "площадка", "сайт", "carrier", "channel", "media owner", "station", "vehicle", "publisher", "медіа-носій", "медианоситель"] },
  { field: "format", label: "Формат", description: "формат розміщення: ролик 30 сек, банер, біл-борд 6×3", keywords: ["формат", "format", "хронометраж", "розмір", "размер", "size", "ad format"] },
  { field: "contractor", label: "Підрядник", description: "підрядник: селлер, медіахолдинг, оператор, продакшн", keywords: ["підрядник", "подрядчик", "contractor", "vendor", "supplier", "селлер", "seller", "постачальник", "поставщик", "продавець", "продавец", "медіаселлер"] },
  { field: "periodStart", label: "Початок", description: "дата початку робіт", keywords: ["початок", "дата початку", "start", "start date", "from", "з дати", "період з", "дата с", "начало", "дата начала"] },
  { field: "periodEnd", label: "Кінець", description: "дата закінчення робіт", keywords: ["кінець", "закінчення", "дата закінчення", "end", "end date", "to", "по дату", "дата по", "період по", "окончание", "дата окончания"] },
  { field: "month", label: "Місяць", description: "місяць робіт: 2027-02, лют.27, березень 2027, 02.2027 або дата", keywords: ["місяць", "месяц", "month", "період", "период", "period", "міс"] },
  { field: "description", label: "Опис", description: "опис або коментар до рядка", keywords: ["опис", "описание", "коментар", "комментарий", "примітка", "примечание", "description", "comment", "note", "notes"], multi: true },
  { field: "income", label: "Дохід", description: "дохід: сума клієнту без ПДВ", keywords: ["дохід", "доход", "income", "revenue", "сума клієнту", "сума клієнта", "клієнту", "client net", "client cost", "продаж", "продажа", "виручка", "выручка", "sales", "бюджет", "budget", "billing", "до сплати клієнтом", "бюджет клієнту", "gross to client", "to client", "gross", "client gross", "сума клієнту"] },
  { field: "cost", label: "Затрата", description: "затрата: вартість підрядника без ПДВ", keywords: ["затрата", "затрати", "затраты", "витрати", "витрата", "расход", "собівартість", "себестоимость", "cost", "purchase", "закупка", "закупівля", "сума підрядника", "підрядника", "подрядчика", "vendor net", "media cost", "net cost", "net", "вартість", "вартість підрядника", "стоимость"] },
  { field: "ignore", label: "— не імпортувати —", description: "колонка не потрібна", keywords: [] },
];

export const FIELD_BY_ID = new Map(FIELDS.map((f) => [f.field, f]));

export const fieldLabel = (f: ImportField) => FIELD_BY_ID.get(f)?.label ?? f;

/** Обовʼязкові поля режиму. Для final — дохід або затрата (хоча б одне). */
export function requiredFields(mode: ImportMode): { all: ImportField[]; anyOf?: ImportField[] } {
  return mode === "budget" ? { all: ["projectCode", "income"] } : { all: ["projectCode"], anyOf: ["income", "cost"] };
}

/** Довідники, значення яких розвʼязуються на кроці «Довідники». */
export type DictKind = "client" | "brand" | "direction" | "manager" | "workType" | "carrier" | "format" | "contractor";

export const DICT_KINDS: DictKind[] = ["client", "brand", "direction", "manager", "workType", "carrier", "format", "contractor"];

export const DICT_REF: Record<DictKind, RefKind> = {
  client: "clients",
  brand: "brands",
  direction: "directions",
  manager: "managers",
  workType: "workTypes",
  carrier: "carriers",
  format: "formats",
  contractor: "contractors",
};

export const DICT_LABEL: Record<DictKind, string> = {
  client: "Клієнти",
  brand: "Бренди",
  direction: "Напрями",
  manager: "Менеджери",
  workType: "Види робіт",
  carrier: "Носії",
  format: "Формати",
  contractor: "Підрядники",
};

export const MEDIA_LABEL: Record<MediaType, string> = {
  TV: "ТБ",
  Digital: "Діджитал",
  OOH: "Зовнішня",
  Radio: "Радіо",
  Press: "Преса",
  Indoor: "Індор",
  Cinema: "Кіно",
  Production: "Продакшн",
  Agency: "Агентські",
};

export const MEDIA_TYPES = Object.keys(MEDIA_LABEL) as MediaType[];

/** Довгі основи — входження; короткі токени — ціле слово. */
const MEDIA_WORDS: [MediaType, string[], string[]][] = [
  ["Production", ["production", "продакшн", "продакшен", "виробництв", "производств", "зйомк", "съемк"], []],
  ["Agency", ["agency", "агентськ", "агентск", "комісі", "комисси", "винагород", "вознагражд"], ["fee"]],
  ["TV", ["телеба", "телев", "телекан", "television"], ["tv", "тб", "тв"]],
  ["Radio", ["radio", "радіо", "радио"], ["fm"]],
  ["Digital", ["digital", "діджитал", "диджитал", "інтернет", "интернет", "online", "онлайн", "banner", "банер", "баннер", "youtube", "programmatic", "програматик", "facebook", "instagram", "google", "tiktok"], ["olv", "smm", "web", "meta", "сайт"]],
  ["OOH", ["зовнішн", "наружн", "білборд", "билборд", "біл-борд", "billboard", "сітілайт", "ситилайт", "citylight", "бігборд", "outdoor"], ["ooh", "dooh"]],
  ["Indoor", ["indoor", "індор", "индор", "ліфт", "лифт"], []],
  ["Cinema", ["cinema", "кінотеатр", "кинотеатр"], ["кіно", "кино"]],
  ["Press", ["press", "преса", "пресса", "журнал", "газет", "print"], ["друк"]],
];

export function tokens(s: string): string[] {
  return s.toLowerCase().split(/[^0-9a-zа-яіїєґё]+/i).filter(Boolean);
}

/** Вид медіа за текстом (вид робіт, формат, назва носія). */
export function inferMedia(text: string | undefined): MediaType | undefined {
  if (!text) return undefined;
  const t = text.toLowerCase();
  const tk = new Set(tokens(t));
  for (const [media, stems, words] of MEDIA_WORDS) {
    if (stems.some((s) => t.includes(s)) || words.some((w) => tk.has(w))) return media;
  }
  return undefined;
}

export function inferWorkKind(text: string | undefined, media?: MediaType): WorkKind {
  const m = media ?? inferMedia(text);
  if (m === "Agency") return "agency";
  if (m === "Production") return "production";
  return "placement";
}
