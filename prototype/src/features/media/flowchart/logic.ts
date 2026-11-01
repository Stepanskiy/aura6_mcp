// Чиста логіка флоучарта: шкала часу, кошики (дні/тижні/місяці), пропорційний розподіл бюджету. Без React.
import type { MediaType } from "../../../domain/types";
import { CHART_SERIES } from "../util";

export type Scale = "day" | "week" | "month";

export const TODAY = "2026-11-01";

/** Фіксований порядок видів медіа: колір належить виду, а не його місцю в поточному проєкті. */
export const MEDIA_ORDER: MediaType[] = ["TV", "Radio", "Digital", "OOH", "Indoor", "Cinema", "Press"];

export const MEDIA_LABEL: Record<string, string> = {
  TV: "ТБ",
  Radio: "Радіо",
  Digital: "Діджитал",
  OOH: "Зовнішня реклама",
  Indoor: "Indoor",
  Cinema: "Кіно",
  Press: "Преса",
  Production: "Продакшн",
  Agency: "Агентські",
};

export function isPlacementMedia(m: MediaType | undefined): m is MediaType {
  return !!m && MEDIA_ORDER.includes(m);
}

export function mediaColor(m: MediaType): string {
  const i = MEDIA_ORDER.indexOf(m);
  return CHART_SERIES[(i < 0 ? 0 : i) % CHART_SERIES.length];
}

const DAY_MS = 86400000;
const MONTHS_FULL = ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"];
const MONTHS_SHORT = ["Січ", "Лют", "Бер", "Кві", "Тра", "Чер", "Лип", "Сер", "Вер", "Жов", "Лис", "Гру"];

/** Номер дня (UTC) від епохи. */
export function dayNum(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function dateOf(n: number): Date {
  return new Date(n * DAY_MS);
}

export function isoOfDay(n: number): string {
  return dateOf(n).toISOString().slice(0, 10);
}

/** Тривалість у днях, включно з обома межами. */
export function spanDays(start: string, end: string): number {
  return Math.max(1, dayNum(end) - dayNum(start) + 1);
}

/** 0 = понеділок … 6 = неділя. */
function dow(n: number): number {
  return (dateOf(n).getUTCDay() + 6) % 7;
}

function isoWeek(n: number): number {
  const thu = n - dow(n) + 3;
  const year = dateOf(thu).getUTCFullYear();
  const jan1 = Math.round(Date.UTC(year, 0, 1) / DAY_MS);
  return Math.floor((thu - jan1) / 7) + 1;
}

function ddmm(n: number): string {
  const d = dateOf(n);
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export interface Bucket {
  key: string;
  /** Перший день (включно) і день після останнього (виключно). */
  start: number;
  end: number;
  label: string;
  /** Повна підпис для Excel і підказок. */
  full: string;
  weekend: boolean;
  /** Ключ і підпис верхнього рівня шапки (місяць або рік). */
  group: string;
  groupLabel: string;
}

export const PX_PER_DAY: Record<Scale, number> = { day: 26, week: 9, month: 3.4 };

/** Кошики, що покривають [from, to] (номери днів, включно). */
export function makeBuckets(scale: Scale, from: number, to: number): Bucket[] {
  const out: Bucket[] = [];
  if (scale === "day") {
    for (let n = from; n <= to; n++) {
      const d = dateOf(n);
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth();
      out.push({ key: `d${n}`, start: n, end: n + 1, label: String(d.getUTCDate()), full: ddmm(n) + "." + y, weekend: dow(n) >= 5, group: `${y}-${m}`, groupLabel: `${MONTHS_FULL[m]} ${y}` });
    }
  } else if (scale === "week") {
    for (let n = from - dow(from); n <= to; n += 7) {
      const th = dateOf(n + 3);
      const y = th.getUTCFullYear();
      const m = th.getUTCMonth();
      out.push({ key: `w${n}`, start: n, end: n + 7, label: String(isoWeek(n)), full: `Т${isoWeek(n)} (${ddmm(n)}–${ddmm(n + 6)})`, weekend: false, group: `${y}-${m}`, groupLabel: `${MONTHS_FULL[m]} ${y}` });
    }
  } else {
    const f = dateOf(from);
    let y = f.getUTCFullYear();
    let m = f.getUTCMonth();
    for (;;) {
      const s = Math.round(Date.UTC(y, m, 1) / DAY_MS);
      if (s > to) break;
      const e = Math.round(Date.UTC(m === 11 ? y + 1 : y, (m + 1) % 12, 1) / DAY_MS);
      out.push({ key: `m${y}-${m}`, start: s, end: e, label: MONTHS_SHORT[m], full: `${MONTHS_FULL[m]} ${y}`, weekend: false, group: String(y), groupLabel: String(y) });
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }
  }
  return out;
}

/** Дні, на які робота перетинає кошик. */
export function overlapDays(ws: number, we: number, b: Bucket): number {
  return Math.max(0, Math.min(we, b.end - 1) - Math.max(ws, b.start) + 1);
}

/** Бюджет по кошиках: дохід роботи рівномірно розподілений по днях її періоду. */
export function prorate(works: { start: string; end: string; income: number }[], buckets: Bucket[]): number[] {
  const res = buckets.map(() => 0);
  for (const w of works) {
    const s = dayNum(w.start);
    const e = Math.max(s, dayNum(w.end));
    const daily = w.income / (e - s + 1);
    buckets.forEach((b, i) => {
      res[i] += overlapDays(s, e, b) * daily;
    });
  }
  return res;
}

/** Компактна сума для вузьких клітинок: 1,2м / 125к. */
export function fmtCompact(n: number): string {
  const a = Math.abs(n);
  const f = (v: number) => v.toFixed(v >= 10 ? 0 : 1).replace(".", ",");
  if (a >= 1e6) return f(n / 1e6) + "м";
  if (a >= 1e3) return f(n / 1e3) + "к";
  return String(Math.round(n));
}

/** Групи верхньої шапки: послідовні кошики з однаковим group. */
export function groupBuckets(buckets: Bucket[]): { key: string; label: string; days: number }[] {
  const res: { key: string; label: string; days: number }[] = [];
  for (const b of buckets) {
    const last = res[res.length - 1];
    if (last && last.key === b.group) last.days += b.end - b.start;
    else res.push({ key: b.group, label: b.groupLabel, days: b.end - b.start });
  }
  return res;
}

export function defaultScale(from: number, to: number): Scale {
  return to - from + 1 <= 125 ? "week" : "month";
}
