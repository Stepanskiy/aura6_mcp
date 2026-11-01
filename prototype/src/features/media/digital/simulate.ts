// Детермінована симуляція денної статистики кабінетів. Чисті функції: той самий work.id + дата дає ті самі числа.
import { mid, type Profile } from "./benchmarks";

export interface Daily {
  d: string;
  imp: number;
  /** Накопичене охоплення на кінець дня. */
  reach: number;
  clk: number;
  view: number;
  conv: number;
  spend: number;
}

export interface Plan {
  impressions: number;
  reach: number;
  clicks: number;
  views: number;
  conversions: number;
  cpm: number;
  ctr: number;
  vtr: number;
  cr: number;
  cpc: number;
  cpv: number;
  cpa: number;
}

export function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const seeded = (key: string) => mulberry32(hashOf(key));

const DAY = 86400000;
const ms = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
export function daysBetween(a: string, b: string): number {
  return Math.round((ms(b) - ms(a)) / DAY);
}
export function addDays(iso: string, n: number): string {
  return new Date(ms(iso) + n * DAY).toISOString().slice(0, 10);
}
export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Накопичене охоплення після cum показів при загальному плані totalImp (та сама модель, що в симуляції). */
export function reachAt(totalImp: number, cum: number, freq: number): number {
  const pop = Math.max(1, totalImp / freq);
  return pop * (1 - Math.exp(-cum / pop));
}

/** План за бюджетом і середніми орієнтирами носія. */
export function planOf(budget: number, p: Profile): Plan {
  const b = p.bench;
  const cpm = mid(b.cpm), ctr = mid(b.ctr), cr = mid(b.cr), vtr = p.video && b.vtr ? mid(b.vtr) : 0;
  const impressions = (budget / cpm) * 1000;
  const clicks = impressions * ctr;
  const cpc = cpm / 1000 / ctr;
  return { impressions, reach: reachAt(impressions, impressions, b.freq), clicks, views: impressions * vtr, conversions: clicks * cr, cpm, ctr, vtr, cr, cpc, cpv: vtr ? cpm / 1000 / vtr : 0, cpa: cpc / cr };
}

/** Денна статистика від початку флайту до today включно. Підсумок за повний флайт ≈ бюджет × (0.92…1.04). */
export function simulate(work: { id: string; periodStart: string; periodEnd: string; cost: number }, p: Profile, today: string): Daily[] {
  const r = seeded(work.id);
  const pick = (x: [number, number]) => x[0] + (x[1] - x[0]) * r();
  const b = p.bench;
  const cpm = pick(b.cpm), ctr = pick(b.ctr), cr = pick(b.cr), vtr = p.video && b.vtr ? pick(b.vtr) : 0;
  const factor = 0.92 + 0.12 * r();
  const all = eachDate(work.periodStart, work.periodEnd);
  const weights = all.map((d, i) => {
    const wd = new Date(ms(d)).getUTCDay();
    return (0.8 + 0.4 * seeded(work.id + d + "w")()) * (wd === 0 || wd === 6 ? 1.12 : 1) * (i < 3 ? 1.15 : 1);
  });
  const sumW = weights.reduce((a, x) => a + x, 0);
  const total = work.cost * factor;
    const out: Daily[] = [];
  let cum = 0;
  for (let i = 0; i < all.length && all[i] <= today; i++) {
    const d = all[i];
    const rn = seeded(work.id + d + "n");
    const spend = (total * weights[i]) / sumW;
    const imp = (spend / cpm) * 1000;
    const clk = imp * ctr * (0.88 + 0.24 * rn());
    const view = imp * vtr * (0.94 + 0.12 * rn());
    const conv = clk * cr * (0.8 + 0.4 * rn());
    cum += imp;
    out.push({ d, imp: Math.round(imp), reach: Math.round(reachAt((work.cost / mid(b.cpm)) * 1000, cum, b.freq)), clk: Math.round(clk), view: Math.round(view), conv: Math.round(conv), spend: Math.round(spend * 100) / 100 });
  }
  return out;
}

/** Частка тривалості флайту, що минула до today (включно з поточним днем). */
export function elapsedShare(periodStart: string, periodEnd: string, today: string): number {
  if (today < periodStart) return 0;
  const total = daysBetween(periodStart, periodEnd) + 1;
  const passed = daysBetween(periodStart, today < periodEnd ? today : periodEnd) + 1;
  return Math.max(0, Math.min(1, passed / total));
}
