// Демо-дані: рекламний ринок України. Детермінований генератор (mulberry32, фіксований seed).
// Увага: тільки `import type` — файл також імпортується Node-скриптом зі strip-types.
import type {
  Brand,
  Carrier,
  ChangeEntry,
  Client,
  Contractor,
  DataState,
  Direction,
  Format,
  Invoice,
  InvoiceLine,
  Manager,
  MediaType,
  PlanVersion,
  Project,
  Work,
  WorkSnapshot,
  WorkType,
} from "../domain/types";

const TODAY = "2026-10-31";
const SEED = 20261031;

// ---------- допоміжні ----------
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const pad = (n: number, l = 2) => String(n).padStart(l, "0");
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const addDays = (s: string, n: number) => new Date(Date.parse(s + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
/** Індекс місяця: 0 = 2025-01. */
const monthOf = (idx: number) => ({ y: 2025 + Math.floor(idx / 12), m: (idx % 12) + 1 });
const monthStart = (idx: number) => {
  const { y, m } = monthOf(idx);
  return `${y}-${pad(m)}-01`;
};
const monthEnd = (idx: number) => {
  const { y, m } = monthOf(idx);
  return `${y}-${pad(m)}-${pad(lastDay(y, m))}`;
};
const idxOfDate = (d: string) => (Number(d.slice(0, 4)) - 2025) * 12 + Number(d.slice(5, 7)) - 1;
const MONTHS_UA = ["січень", "лютий", "березень", "квітень", "травень", "червень", "липень", "серпень", "вересень", "жовтень", "листопад", "грудень"];

// ---------- довідники ----------
const CLIENT_DEFS: [string, string, string[]][] = [
  ["Київстар", "KST", ["Київстар", "Kyivstar TV", "Київстар Бізнес"]],
  ["Vodafone Україна", "VDF", ["Vodafone", "Vodafone Business", "Vodafone Pay"]],
  ["lifecell", "LFC", ["lifecell", "lifecell Business"]],
  ["Нова пошта", "NPS", ["Нова пошта", "Нова пошта Бізнес", "Nova Post"]],
  ["Rozetka", "RZT", ["Rozetka", "Rozetka Pay", "Rozetka Маркетплейс"]],
  ["Сільпо / Fozzy Group", "FZG", ["Сільпо", "Фора", "Fozzy Cash&Carry"]],
  ["АТБ-маркет", "ATB", ["АТБ", "Власні марки АТБ"]],
  ["Procter & Gamble Україна", "PNG", ["Ariel", "Pampers", "Gillette", "Head & Shoulders"]],
  ["Unilever Україна", "UNL", ["Dove", "Rexona", "Domestos", "Knorr"]],
  ["Nestlé Україна", "NST", ["Nesquik", "Nescafé", "Мівіна"]],
  ["Carlsberg Ukraine", "CRL", ["Львівське", "Карпатське", "Robert Doms"]],
  ["Оболонь", "OBL", ["Оболонь", "Живчик", "Прозора"]],
  ["Дарниця", "DRN", ["Цитрамон", "Аскорбінка", "Корвалол"]],
  ["Фармак", "FRM", ["Амізон", "Ліпразид", "Кетанов"]],
  ["ПриватБанк", "PRB", ["Приват24", "Картка «Універсальна»", "ПриватБанк Бізнес"]],
  ["monobank / Universal Bank", "MNB", ["monobank", "monobank Junior"]],
  ["Comfy", "CMF", ["Comfy", "Comfy Home"]],
  ["Епіцентр К", "EPC", ["Епіцентр", "Епіцентр Маркетплейс"]],
];

const CONTRACTOR_NAMES = [
  "1+1 media", "Starlight Media", "Inter Media Group", "TAVR Media", "ТРК Люкс", "BigMedia", "RTM-Україна", "Perekhid Media",
  "Google Ireland Ltd", "Meta Platforms Ireland Ltd", "TikTok Information Technologies UK", "MEGOGO", "Sweet.tv", "Ukr.net",
  "Продакшн-студія «Кадр»", "Лайм Продакшн",
];

const FORMAT_DEFS: [string, MediaType][] = [
  ["Ролик 30\"", "TV"], ["Ролик 20\"", "TV"], ["Спонсорство", "TV"],
  ["Ролик 30\"", "Radio"],
  ["6×3", "OOH"], ["Сітілайт 1,2×1,8", "OOH"], ["Digital screen 10\"", "OOH"],
  ["Pre-roll 15\"", "Digital"], ["Банер 300×250", "Digital"], ["Пост/сторіз", "Digital"], ["Пошукова реклама CPC", "Digital"],
  ["Відеоролик", "Production"], ["Адаптація", "Production"],
];

// [носій, медіа, підрядник, формати за замовчуванням]
const CARRIER_DEFS: [string, MediaType, string, string[]][] = [
  ["1+1 Україна", "TV", "1+1 media", ["Ролик 30\"", "Ролик 20\"", "Спонсорство"]],
  ["2+2", "TV", "1+1 media", ["Ролик 30\"", "Ролик 20\""]],
  ["ТЕТ", "TV", "1+1 media", ["Ролик 30\"", "Ролик 20\"", "Спонсорство"]],
  ["ICTV2", "TV", "Starlight Media", ["Ролик 30\"", "Ролик 20\""]],
  ["СТБ", "TV", "Starlight Media", ["Ролик 30\"", "Ролик 20\"", "Спонсорство"]],
  ["Новий канал", "TV", "Starlight Media", ["Ролик 30\"", "Ролик 20\""]],
  ["Інтер", "TV", "Inter Media Group", ["Ролик 30\"", "Ролик 20\"", "Спонсорство"]],
  ["НТН", "TV", "Inter Media Group", ["Ролик 30\"", "Ролик 20\""]],
  ["Хіт FM", "Radio", "TAVR Media", ["Ролик 30\""]],
  ["Kiss FM", "Radio", "TAVR Media", ["Ролик 30\""]],
  ["Radio Relax", "Radio", "TAVR Media", ["Ролик 30\""]],
  ["Мелодія FM", "Radio", "Perekhid Media", ["Ролик 30\""]],
  ["Люкс FM", "Radio", "ТРК Люкс", ["Ролик 30\""]],
  ["Radio Bayraktar", "Radio", "Perekhid Media", ["Ролик 30\""]],
  ["Білборди 6×3 Київ", "OOH", "BigMedia", ["6×3"]],
  ["Сітілайти Київ", "OOH", "BigMedia", ["Сітілайт 1,2×1,8"]],
  ["Цифрові екрани Київ", "OOH", "BigMedia", ["Digital screen 10\""]],
  ["Бекліти Львів", "OOH", "RTM-Україна", ["6×3"]],
  ["Сітілайти Харків", "OOH", "RTM-Україна", ["Сітілайт 1,2×1,8"]],
  ["YouTube", "Digital", "Google Ireland Ltd", ["Pre-roll 15\""]],
  ["Google Search", "Digital", "Google Ireland Ltd", ["Пошукова реклама CPC"]],
  ["Meta (Facebook/Instagram)", "Digital", "Meta Platforms Ireland Ltd", ["Пост/сторіз"]],
  ["TikTok", "Digital", "TikTok Information Technologies UK", ["Пост/сторіз"]],
  ["MEGOGO", "Digital", "MEGOGO", ["Pre-roll 15\""]],
  ["Sweet.tv", "Digital", "Sweet.tv", ["Pre-roll 15\""]],
  ["Ukr.net", "Digital", "Ukr.net", ["Банер 300×250"]],
];

const MANAGER_NAMES = ["Олена Коваль", "Андрій Мельник", "Марина Шевченко", "Дмитро Бондаренко", "Ірина Ткаченко", "Сергій Кравченко"];

const DIRECTION_NAMES = ["Медіа", "Діджитал", "Зовнішня реклама", "Продакшн", "BTL"];

const WORK_TYPE_DEFS: [string, string, WorkType["kind"], MediaType][] = [
  ["wt-tv", "Розміщення ТБ", "placement", "TV"],
  ["wt-radio", "Розміщення радіо", "placement", "Radio"],
  ["wt-ooh", "Розміщення OOH", "placement", "OOH"],
  ["wt-digital", "Digital-розміщення", "placement", "Digital"],
  ["wt-prod", "Виробництво ролика", "production", "Production"],
  ["wt-agency", "Послуги з планування / агентська винагорода", "agency", "Agency"],
];
const WT_BY_MEDIA: Record<string, string> = { TV: "wt-tv", Radio: "wt-radio", OOH: "wt-ooh", Digital: "wt-digital" };

const COST_RANGE: Record<string, [number, number]> = {
  TV: [200000, 3000000],
  Radio: [20000, 200000],
  OOH: [50000, 600000],
  Digital: [30000, 800000],
};

// які медіа бере напрям (з вагами через повтор)
const DIRECTION_MEDIA: Record<string, string[]> = {
  "Медіа": ["TV", "TV", "Radio", "OOH", "Digital"],
  "Діджитал": ["Digital", "Digital", "Digital", "TV"],
  "Зовнішня реклама": ["OOH", "OOH", "OOH", "Digital"],
  "Продакшн": ["Digital", "TV"],
  "BTL": ["OOH", "Digital", "Radio"],
};

const CAMPAIGNS = ["осіння кампанія", "літня кампанія", "весняна кампанія", "зимова кампанія", "промо-підтримка", "Black Friday", "новорічна кампанія", "медійна підтримка запуску", "performance-кампанія", "ребрендинг"];

// ---------- генерація ----------
export function createSeed(): DataState {
  const rnd = mulberry32(SEED);
  const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];
  const between = (a: number, b: number) => a + rnd() * (b - a);
  const chance = (p: number) => rnd() < p;
  const shuffle = <T,>(a: T[]): T[] => {
    const x = a.slice();
    for (let i = x.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [x[i], x[j]] = [x[j], x[i]];
    }
    return x;
  };

  const managers: Manager[] = MANAGER_NAMES.map((name, i) => ({ id: `mgr-${i + 1}`, name }));
  const directions: Direction[] = DIRECTION_NAMES.map((name, i) => ({ id: `dir-${i + 1}`, name }));
  const workTypes: WorkType[] = WORK_TYPE_DEFS.map(([id, name, kind, mediaType]) => ({ id, name, kind, mediaType }));

  const clients: Client[] = [];
  const brands: Brand[] = [];
  CLIENT_DEFS.forEach(([name, prefix, bs], i) => {
    const id = `cl-${prefix}`;
    clients.push({ id, name, prefix, edrpou: String(30000000 + Math.floor(rnd() * 9999999)) });
    bs.forEach((b, j) => brands.push({ id: `br-${i + 1}-${j + 1}`, name: b, clientId: id }));
  });

  const contractors: Contractor[] = CONTRACTOR_NAMES.map((name, i) => ({
    id: `ctr-${i + 1}`,
    name,
    edrpou: name.includes("Ireland") || name.includes("UK") ? undefined : String(20000000 + Math.floor(rnd() * 9999999)),
  }));
  const ctrId = (name: string) => contractors.find((c) => c.name === name)!.id;

  const formats: Format[] = FORMAT_DEFS.map(([name, mediaType], i) => ({ id: `fmt-${i + 1}`, name, mediaType }));
  const fmtId = (name: string, mt: MediaType) => formats.find((f) => f.name === name && f.mediaType === mt)!.id;

  const carriers: Carrier[] = CARRIER_DEFS.map(([name, mediaType, ctr], i) => ({
    id: `car-${i + 1}`,
    name,
    mediaType,
    contractorId: ctrId(ctr),
  }));
  const carrierFormats = new Map<string, string[]>();
  CARRIER_DEFS.forEach(([, mt, , fs], i) => carrierFormats.set(carriers[i].id, fs.map((f) => fmtId(f, mt))));
  const carriersByMedia = (mt: string) => carriers.filter((c) => c.mediaType === mt);

  // ---------- проєкти ----------
  const projects: Project[] = [];
  const works: Work[] = [];
  const codeCounters: Record<string, number> = {};
  const PROJECT_COUNT = 40;
  let wSeq = 0;

  for (let n = 0; n < PROJECT_COUNT; n++) {
    const cIdx = Math.floor(Math.pow(rnd(), 1.5) * clients.length);
    const client = clients[cIdx];
    const cb = brands.filter((b) => b.clientId === client.id);
    const brand = pick(cb);
    const direction = pick(directions);
    const manager = pick(managers);
    const startIdx = Math.min(23, Math.floor(rnd() * 24));
    const dur = 1 + Math.floor(rnd() * 4);
    const endIdx = Math.min(23, startIdx + dur - 1);
    const startDate = monthStart(startIdx);
    const endDate = monthEnd(endIdx);
    const year = Number(startDate.slice(0, 4));

    codeCounters[client.prefix] = (codeCounters[client.prefix] ?? 0) + 1;
    const code = `${client.prefix}-${pad(9 + codeCounters[client.prefix] * 3, 4)}`;

    const sm = monthOf(startIdx).m;
    const season = sm >= 3 && sm <= 5 ? "весна" : sm >= 6 && sm <= 8 ? "літо" : sm >= 9 && sm <= 11 ? "осінь" : "зима";
    const name = chance(0.5)
      ? `${brand.name} — ${season} ${year}`
      : `${client.name.split(" /")[0]} — ${pick(CAMPAIGNS)} ${MONTHS_UA[sm - 1].slice(0, 3)}.${year}`;

    let status: Project["status"];
    if (endDate < TODAY) status = chance(0.85) ? "closed" : "active";
    else if (startDate > TODAY) status = chance(0.6) ? "draft" : "active";
    else status = "active";

    const created = addDays(startDate, -14);
    const createdAt = (created > "2026-10-30" ? "2026-10-30" : created) + "T09:00:00.000Z";
    const project: Project = {
      id: `prj-${n + 1}`,
      code,
      name,
      clientId: client.id,
      brandId: brand.id,
      directionId: direction.id,
      managerId: manager.id,
      year,
      startDate,
      endDate,
      status,
      createdAt,
    };
    projects.push(project);

    // --- роботи ---
    const media = DIRECTION_MEDIA[direction.name];
    const nMonths = endIdx - startIdx + 1;
    const placements: { mi: number; mt: string }[] = [];
    for (let mi = startIdx; mi <= endIdx; mi++) {
      const k = nMonths === 1 ? 2 + Math.floor(rnd() * 3) : 1 + Math.floor(rnd() * 3);
      for (let j = 0; j < k && placements.length < 12; j++) placements.push({ mi, mt: pick(media) });
    }
    while (placements.length < 2) placements.push({ mi: startIdx, mt: pick(media) });

    const projWorks: Work[] = [];
    let placementIncome = 0;
    for (const p of placements) {
      const carrier = pick(carriersByMedia(p.mt));
      const fid = pick(carrierFormats.get(carrier.id)!);
      const [lo, hi] = COST_RANGE[p.mt];
      const cost = r2(Math.round((lo + Math.pow(rnd(), 2) * (hi - lo)) / 100) * 100);
      const income = r2(cost * between(1.03, 1.15));
      placementIncome += income;
      const fname = formats.find((f) => f.id === fid)!.name;
      const w: Work = {
        id: `w-${pad(++wSeq, 4)}`,
        projectId: project.id,
        workTypeId: WT_BY_MEDIA[p.mt],
        carrierId: carrier.id,
        formatId: fid,
        contractorId: carrier.contractorId,
        periodStart: monthStart(p.mi),
        periodEnd: monthEnd(p.mi),
        description: `${carrier.name}, ${fname}, ${MONTHS_UA[monthOf(p.mi).m - 1]}`,
        income,
        cost,
        closed: false,
      };
      projWorks.push(w);
    }
    // виробництво
    if (direction.name === "Продакшн" || chance(0.25)) {
      const cost = r2(Math.round(between(300000, 1500000) / 1000) * 1000);
      projWorks.push({
        id: `w-${pad(++wSeq, 4)}`,
        projectId: project.id,
        workTypeId: "wt-prod",
        formatId: fmtId(chance(0.7) ? "Відеоролик" : "Адаптація", "Production"),
        contractorId: ctrId(chance(0.7) ? "Продакшн-студія «Кадр»" : "Лайм Продакшн"),
        periodStart: monthStart(startIdx),
        periodEnd: monthEnd(startIdx),
        description: "Виробництво рекламного ролика",
        income: r2(cost * between(1.1, 1.3)),
        cost,
        closed: false,
      });
    }
    // агентська винагорода
    projWorks.push({
      id: `w-${pad(++wSeq, 4)}`,
      projectId: project.id,
      workTypeId: "wt-agency",
      periodStart: startDate,
      periodEnd: endDate,
      description: "Агентська винагорода за планування та супровід",
      income: r2(placementIncome * between(0.03, 0.08)),
      cost: 0,
      closed: false,
    });

    // закриття минулих робіт
    for (const w of projWorks) {
      if (w.periodEnd < "2026-10-01" && chance(0.7)) {
        const closedDay = addDays(w.periodEnd, 10 + Math.floor(rnd() * 20));
        const cd = closedDay > TODAY ? TODAY : closedDay;
        w.closed = true;
        w.closedAt = cd + "T10:00:00.000Z";
        w.finalLoadedAt = addDays(cd, -1) + "T15:30:00.000Z";
      }
    }
    works.push(...projWorks);
  }

  return finishData(rnd, pick, between, chance, shuffle, { managers, directions, workTypes, clients, brands, contractors, formats, carriers, projects, works });
}

// ---------- версії, рахунки, історія ----------
type Parts = Pick<DataState, "managers" | "directions" | "workTypes" | "clients" | "brands" | "contractors" | "formats" | "carriers" | "projects" | "works">;

function finishData(
  rnd: () => number,
  pick: <T>(a: T[]) => T,
  between: (a: number, b: number) => number,
  chance: (p: number) => boolean,
  shuffle: <T>(a: T[]) => T[],
  d: Parts,
): DataState {
  const { projects, works, managers } = d;
  const mgrName = (id?: string) => managers.find((m) => m.id === id)?.name ?? managers[0].name;
  const snap = (w: Work, k = 1): WorkSnapshot => ({
    id: w.id,
    workTypeId: w.workTypeId,
    carrierId: w.carrierId,
    formatId: w.formatId,
    contractorId: w.contractorId,
    periodStart: w.periodStart,
    periodEnd: w.periodEnd,
    description: w.description,
    income: r2(w.income * k),
    cost: r2(w.cost * k),
  });

  // --- версії ---
  const versions: PlanVersion[] = [];
  const history: ChangeEntry[] = [];
  let hSeq = 0;
  const hid = () => `h-${++hSeq}`;
  const autoSet = new Set(shuffle(projects.filter((p) => p.status !== "draft" && works.some((w) => w.projectId === p.id)).map((p) => p.id)).slice(0, 6));

  for (const p of projects) {
    const pw = works.filter((w) => w.projectId === p.id);
    const isAuto = autoSet.has(p.id);
    const differs = !isAuto && chance(0.3);
    const v1: WorkSnapshot[] = pw.map((w) => {
      if (isAuto) return snap(w, between(0.8, 0.88));
      if (differs && chance(0.5)) return snap(w, between(0.88, 1.1));
      return snap(w);
    });
    versions.push({ id: `ver-${p.id}-1`, projectId: p.id, number: 1, name: "План", createdAt: p.createdAt, auto: false, works: v1 });
    history.push({ id: hid(), at: p.createdAt, user: mgrName(p.managerId), projectId: p.id, action: "version", field: "version", after: "План", source: "seed" });
    if (isAuto) {
      const prev = v1.reduce((s, w) => s + w.income, 0);
      const cur = pw.reduce((s, w) => s + w.income, 0);
      const pct = (Math.abs(cur - prev) / prev) * 100;
      const at = addDays(p.startDate!, 3) > TODAY ? TODAY : addDays(p.startDate!, 3);
      versions.push({
        id: `ver-${p.id}-2`,
        projectId: p.id,
        number: 2,
        name: "Авто-версія",
        createdAt: at + "T12:00:00.000Z",
        auto: true,
        reason: `Дохід змінився на ${pct.toFixed(1).replace(".", ",")}% (поріг 10%)`,
        works: pw.map((w) => snap(w)),
      });
    }
    history.push({ id: hid(), at: p.createdAt, user: mgrName(p.managerId), projectId: p.id, action: "project-create", after: p.code + " " + p.name, source: "seed" });
  }

  // оновлення проєктів і закриття робіт для історії
  for (const p of shuffle(projects.filter((x) => x.status !== "draft")).slice(0, 12)) {
    const at = addDays(p.startDate!, 5) > TODAY ? TODAY : addDays(p.startDate!, 5);
    history.push({
      id: hid(),
      at: at + "T11:00:00.000Z",
      user: mgrName(p.managerId),
      projectId: p.id,
      action: "project-update",
      field: "managerId",
      before: mgrName(managersOther(managers, p.managerId)),
      after: mgrName(p.managerId),
      source: "seed",
    });
  }
  for (const w of works.filter((x) => x.closed).slice(0, 40)) {
    const p = projects.find((x) => x.id === w.projectId)!;
    history.push({ id: hid(), at: w.closedAt!, user: mgrName(p.managerId), projectId: p.id, workId: w.id, action: "close", field: "closed", before: false, after: true, source: "seed" });
  }
  history.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  // --- рахунки ---
  const clientOfProject = new Map(projects.map((p) => [p.id, p.clientId]));
  const worksByClient = new Map<string, Work[]>();
  for (const w of works) {
    const c = clientOfProject.get(w.projectId)!;
    if (!worksByClient.has(c)) worksByClient.set(c, []);
    worksByClient.get(c)!.push(w);
  }
  const overlaps = (w: Work, mi: number) => w.periodStart <= monthEnd(mi) && w.periodEnd >= monthStart(mi);
  const pairs: { mi: number; clientId: string; n: number }[] = [];
  for (let mi = 0; mi <= 20; mi++) {
    for (const [clientId, ws] of worksByClient) {
      const n = ws.filter((w) => overlaps(w, mi)).length;
      if (n >= 2) pairs.push({ mi, clientId, n });
    }
  }
  const chosen = shuffle(pairs).slice(0, 25).sort((a, b) => a.mi - b.mi);
  const invoiced = new Map<string, number>();
  const invoices: Invoice[] = [];
  const seqByYear: Record<string, number> = {};
  for (const pr of chosen) {
    const partial = chance(0.2) ? between(0.6, 0.9) : 1;
    const lines: InvoiceLine[] = [];
    for (const w of worksByClient.get(pr.clientId)!.filter((x) => overlaps(x, pr.mi)).slice(0, 8)) {
      const nm = idxOfDate(w.periodEnd) - idxOfDate(w.periodStart) + 1;
      const remaining = r2(w.income - (invoiced.get(w.id) ?? 0));
      const amt = r2(Math.min(remaining, r2((w.income / nm) * partial)));
      if (amt <= 0) continue;
      invoiced.set(w.id, r2((invoiced.get(w.id) ?? 0) + amt));
      lines.push({ workId: w.id, amount: amt });
    }
    if (!lines.length) continue;
    const date = addDays(monthEnd(pr.mi), 3);
    const year = date.slice(0, 4);
    seqByYear[year] = (seqByYear[year] ?? 0) + 1;
    invoices.push({
      id: `inv-${invoices.length + 1}`,
      number: `РК-${year}-${pad(seqByYear[year], 4)}`,
      date,
      clientId: pr.clientId,
      periodStart: monthStart(pr.mi),
      periodEnd: monthEnd(pr.mi),
      dueDate: addDays(date, 14),
      contractType: chance(0.6) ? "commission" : "regular",
      status: "issued",
      lines,
      createdAt: date + "T10:00:00.000Z",
    });
  }
  invoices.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  // перенумерація за датою (щоб номери зростали разом з датою)
  const seq2: Record<string, number> = {};
  for (const inv of invoices) {
    const y = inv.date.slice(0, 4);
    seq2[y] = (seq2[y] ?? 0) + 1;
    inv.number = `РК-${y}-${pad(seq2[y], 4)}`;
  }

  return {
    clients: d.clients,
    brands: d.brands,
    contractors: d.contractors,
    carriers: d.carriers,
    formats: d.formats,
    directions: d.directions,
    workTypes: d.workTypes,
    managers,
    projects,
    works,
    versions,
    history,
    invoices,
    templates: [],
  };
}

function managersOther(managers: Manager[], id?: string): string {
  return (managers.find((m) => m.id !== id) ?? managers[0]).id;
}

export const SEED_INFO = { projects: 40, clients: CLIENT_DEFS.length, today: TODAY };
