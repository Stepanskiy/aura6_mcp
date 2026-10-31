// Модель даних демо-прототипу управлінського варіанта (drafts/варіант-управлінський-облік/12-…).
// Тільки ключові поля. Суми — у гривнях без ПДВ, 2 знаки після коми. Одна валюта.
// Дати — рядки ISO "YYYY-MM-DD".

export type ID = string;

/** Вид медіа носія / формату. */
export type MediaType = "TV" | "Digital" | "OOH" | "Radio" | "Press" | "Indoor" | "Cinema" | "Production" | "Agency";

/** Вид роботи визначає секцію друкованої форми рахунку. */
export type WorkKind = "placement" | "agency" | "production";

export interface Client {
  id: ID;
  name: string;
  /** Три літери для коду проєкту: KST → KST-0012. */
  prefix: string;
  edrpou?: string;
}

export interface Brand {
  id: ID;
  name: string;
  clientId: ID;
}

/** Підрядник: селлер, медіахолдинг, оператор зовнішньої реклами, продакшн. */
export interface Contractor {
  id: ID;
  name: string;
  edrpou?: string;
}

/** Носій: телеканал, сайт, радіостанція, мережа площин. */
export interface Carrier {
  id: ID;
  name: string;
  mediaType: MediaType;
  /** Типовий підрядник, через якого купується носій. */
  contractorId?: ID;
}

export interface Format {
  id: ID;
  name: string;
  mediaType: MediaType;
}

/** Напрям проєкту: Медіа, Діджитал, Креатив, BTL … */
export interface Direction {
  id: ID;
  name: string;
}

export interface WorkType {
  id: ID;
  name: string;
  kind: WorkKind;
  mediaType?: MediaType;
}

export interface Manager {
  id: ID;
  name: string;
}

export type ProjectStatus = "draft" | "active" | "closed";

export interface Project {
  id: ID;
  /** Унікальний код, за ним зіставляються рядки імпорту: KST-0012. */
  code: string;
  name: string;
  clientId: ID;
  brandId?: ID;
  directionId?: ID;
  managerId?: ID;
  year: number;
  startDate?: string;
  endDate?: string;
  status: ProjectStatus;
  createdAt: string;
}

/** Робота = рядок медіаплану: дохід від клієнта і затрата на підрядника. */
export interface Work {
  id: ID;
  projectId: ID;
  workTypeId: ID;
  carrierId?: ID;
  formatId?: ID;
  contractorId?: ID;
  periodStart: string;
  periodEnd: string;
  description?: string;
  /** Дохід: сума клієнту без ПДВ. */
  income: number;
  /** Затрата: вартість підрядника без ПДВ. */
  cost: number;
  /** Прапорець «сума фінальна». Ставиться окремою дією, не імпортом. */
  closed: boolean;
  closedAt?: string;
  /** Чи завантажувались фінальні суми з файлу. */
  finalLoadedAt?: string;
}

/** Поля роботи, які фіксуються у версії плану і порівнюються. */
export type WorkSnapshot = Pick<
  Work,
  "id" | "workTypeId" | "carrierId" | "formatId" | "contractorId" | "periodStart" | "periodEnd" | "description" | "income" | "cost"
>;

/** Версія плану — іменований знімок медіаплану проєкту. */
export interface PlanVersion {
  id: ID;
  projectId: ID;
  number: number;
  name: string;
  createdAt: string;
  auto: boolean;
  reason?: string;
  works: WorkSnapshot[];
}

export type ChangeSource = "manual" | "import" | "final-import" | "seed";

export type ChangeAction = "create" | "update" | "delete" | "close" | "reopen" | "version" | "project-create" | "project-update";

/** Запис історії змін. Пишеться завжди, на кожну зміну. */
export interface ChangeEntry {
  id: ID;
  at: string;
  user: string;
  projectId: ID;
  workId?: ID;
  action: ChangeAction;
  field?: string;
  before?: unknown;
  after?: unknown;
  source: ChangeSource;
  /** Одна операція імпорту або редагування = один batch. */
  batchId?: ID;
}

export type ContractType = "commission" | "regular";

export interface InvoiceLine {
  workId: ID;
  /** Сума рядка без ПДВ. Не більше невиставленого залишку роботи. */
  amount: number;
}

/** Рахунок клієнту (заявка). Може охоплювати кілька проєктів і брендів клієнта за період. */
export interface Invoice {
  id: ID;
  number: string;
  date: string;
  clientId: ID;
  periodStart: string;
  periodEnd: string;
  dueDate?: string;
  contractType: ContractType;
  status: "draft" | "issued";
  note?: string;
  lines: InvoiceLine[];
  createdAt: string;
}

/** Поле роботи / проєкту, на яке може відображатися колонка Excel. */
export type ImportField =
  | "projectCode"
  | "projectName"
  | "client"
  | "brand"
  | "direction"
  | "manager"
  | "workType"
  | "carrier"
  | "format"
  | "contractor"
  | "periodStart"
  | "periodEnd"
  | "month"
  | "description"
  | "income"
  | "cost"
  | "ignore";

/** Розбір структури аркуша. Його пропонує модель, застосовує детермінований код. */
export interface SheetMapping {
  sheetName: string;
  /** Індекс рядка заголовків (з 0). */
  headerRow: number;
  /** Перший рядок даних (з 0). */
  firstDataRow: number;
  /** Колонка (індекс з 0) → поле. */
  columns: Record<number, ImportField>;
  /** Рядки, що містять ці підрядки в будь-якій клітинці, пропускаються (підсумки тощо). */
  skipRowPatterns: string[];
}

/** Збережений шаблон формату файлу: наступний такий самий файл імпортується без моделі. */
export interface ImportTemplate {
  id: ID;
  name: string;
  /** Нормалізовані заголовки через «|». */
  signature: string;
  mapping: SheetMapping;
  createdAt: string;
}

export interface Settings {
  openRouterKey: string;
  model: string;
  /** Поріг автоматичної версії плану: % зміни суми доходів або витрат проєкту. */
  autoVersionThresholdPct: number;
  agencyName: string;
}

export type RefKind = "clients" | "brands" | "contractors" | "carriers" | "formats" | "directions" | "workTypes" | "managers";

export interface Refs {
  clients: Client[];
  brands: Brand[];
  contractors: Contractor[];
  carriers: Carrier[];
  formats: Format[];
  directions: Direction[];
  workTypes: WorkType[];
  managers: Manager[];
}

export interface DataState extends Refs {
  projects: Project[];
  works: Work[];
  versions: PlanVersion[];
  history: ChangeEntry[];
  invoices: Invoice[];
  templates: ImportTemplate[];
}
