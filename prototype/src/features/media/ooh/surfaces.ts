// Детермінована генерація площин OOH з рядків медіаплану. У моделі даних площин ще немає:
// для демо вони виводяться з роботи (seed = work.id), тож однакові при кожному рендері.
import type { Work } from "../../../domain/types";

export type SurfaceStatus = "on-air" | "planned" | "finished";
export type FormatKind = "billboard" | "citylight" | "backlight" | "digital";
export type City = "Київ" | "Львів" | "Харків";

export interface Surface {
  id: string;
  workId: string;
  code: string;
  city: City;
  address: string;
  lat: number;
  lng: number;
  side: "A" | "B";
  format: string;
  lit: boolean;
  periodStart: string;
  periodEnd: string;
  status: SurfaceStatus;
  pricePerMonth: number;
  operator: string;
}

export const TODAY = "2026-11-01";
export const CITIES: City[] = ["Київ", "Львів", "Харків"];

export const STATUS_LABEL: Record<SurfaceStatus, string> = { "on-air": "в ефірі", planned: "заплановано", finished: "завершено" };

const CITY_CODE: Record<City, string> = { Київ: "KYI", Львів: "LWO", Харків: "HRK" };
const KIND_CODE: Record<FormatKind, string> = { billboard: "BB", citylight: "CL", backlight: "BL", digital: "DS" };
const PRICE_RANGE: Record<FormatKind, [number, number]> = {
  billboard: [25000, 45000],
  citylight: [8000, 15000],
  backlight: [18000, 30000],
  digital: [60000, 120000],
};

interface District {
  lat: number;
  lng: number;
  spread: number;
  streets: string[];
}

const DISTRICTS: Record<City, District[]> = {
  Київ: [
    { lat: 50.4501, lng: 30.5234, spread: 0.007, streets: ["вул. Хрещатик", "вул. Велика Васильківська", "бул. Тараса Шевченка", "вул. Заньковецької"] },
    { lat: 50.4265, lng: 30.538, spread: 0.006, streets: ["вул. Саксаганського", "вул. Ярославів Вал", "просп. Лесі Українки", "вул. Липська"] },
    { lat: 50.501, lng: 30.498, spread: 0.008, streets: ["просп. Оболонський", "просп. Героїв Сталінграда", "вул. Богатирська"] },
    { lat: 50.396, lng: 30.635, spread: 0.01, streets: ["просп. Бажана", "вул. Градинська", "вул. Драгоманова"] },
    { lat: 50.462, lng: 30.48, spread: 0.008, streets: ["просп. Перемоги", "вул. Дорогожицька", "вул. Мельникова"] },
    { lat: 50.43, lng: 30.45, spread: 0.008, streets: ["просп. Повітрофлотський", "вул. Івана Лепсе", "бул. Вацлава Гавела"] },
    { lat: 50.452, lng: 30.6, spread: 0.008, streets: ["просп. Броварський", "вул. Кубанської України", "вул. Райдужна"] },
  ],
  Львів: [
    { lat: 49.8419, lng: 24.0315, spread: 0.004, streets: ["вул. Городоцька", "вул. Личаківська", "вул. Стрийська", "просп. Свободи"] },
    { lat: 49.789, lng: 24.06, spread: 0.006, streets: ["вул. Хвильового", "вул. Стрийська", "вул. Любінська"] },
    { lat: 49.853, lng: 23.99, spread: 0.006, streets: ["вул. Замарстинівська", "вул. Володимира Великого", "вул. Мучна"] },
    { lat: 49.823, lng: 24.07, spread: 0.005, streets: ["вул. Пасічна", "вул. Липинського", "вул. Зелена"] },
  ],
  Харків: [
    { lat: 49.9935, lng: 36.2304, spread: 0.005, streets: ["вул. Сумська", "вул. Полтавський Шлях", "просп. Незалежності", "вул. Пушкінська"] },
    { lat: 50.04, lng: 36.32, spread: 0.008, streets: ["вул. Героїв Праці", "просп. Тракторобудівників", "вул. Дружби Народів"] },
    { lat: 49.96, lng: 36.27, spread: 0.007, streets: ["просп. Науки", "вул. Клочківська", "просп. Ювілейний"] },
    { lat: 49.977, lng: 36.19, spread: 0.006, streets: ["вул. Московський просп.", "вул. Новгородська", "вул. Біологічна"] },
  ],
};

/** Хеш рядка → 32-бітний seed (xmur3-подібний). */
function hashSeed(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** mulberry32 */
function prng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function formatKind(name: string): FormatKind {
  const n = name.toLowerCase();
  if (/цифр|digital|dooh|екран|led/.test(n)) return "digital";
  if (/сітіл|ситил|citylight|city light|сіті/.test(n)) return "citylight";
  if (/бекл|backlight|back light/.test(n)) return "backlight";
  return "billboard";
}

export function cityOf(carrierName: string | undefined): City {
  const n = (carrierName ?? "").toLowerCase();
  if (n.includes("львів")) return "Львів";
  if (n.includes("харків")) return "Харків";
  return "Київ";
}

export function statusOf(periodStart: string, periodEnd: string, today = TODAY): SurfaceStatus {
  if (periodStart > today) return "planned";
  if (periodEnd < today) return "finished";
  return "on-air";
}

export interface WorkCtx {
  /** Назва формату роботи. */
  formatName(w: Work): string;
  carrierName(w: Work): string | undefined;
  operatorName(w: Work): string;
}

/** Площини однієї OOH-роботи. */
export function surfacesOfWork(w: Work, ctx: WorkCtx): Surface[] {
  const rnd = prng(hashSeed(w.id));
  const format = ctx.formatName(w) || "Білборд 6×3";
  const kind = formatKind(format);
  const city = cityOf(ctx.carrierName(w));
  const [lo, hi] = PRICE_RANGE[kind];
  const typical = lo + rnd() * (hi - lo);
  const count = Math.min(18, Math.max(3, Math.round(w.cost / typical)));
  const price = Math.round((w.cost / count) * 100) / 100;
  const status = statusOf(w.periodStart, w.periodEnd);
  const operator = ctx.operatorName(w);
  const districts = DISTRICTS[city];
  const base = 100 + Math.floor(rnd() * 800);
  const out: Surface[] = [];
  for (let i = 0; i < count; i++) {
    const d = districts[Math.floor(rnd() * districts.length)];
    const street = d.streets[Math.floor(rnd() * d.streets.length)];
    const house = 1 + Math.floor(rnd() * 140);
    const lat = d.lat + (rnd() - 0.5) * 2 * d.spread;
    const lng = d.lng + (rnd() - 0.5) * 2 * d.spread * 1.6;
    const num = String(base + i * 7 + Math.floor(rnd() * 6)).padStart(4, "0");
    out.push({
      id: `${w.id}#${i}`,
      workId: w.id,
      code: `${CITY_CODE[city]}-${KIND_CODE[kind]}-${num}`,
      city,
      address: `${street}, ${house}`,
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
      side: rnd() < 0.5 ? "A" : "B",
      format,
      lit: kind === "billboard" ? rnd() < 0.7 : true,
      periodStart: w.periodStart,
      periodEnd: w.periodEnd,
      status,
      pricePerMonth: price,
      operator,
    });
  }
  return out;
}
