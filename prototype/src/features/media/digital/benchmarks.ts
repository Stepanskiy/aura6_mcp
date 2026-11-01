// Ринкові орієнтири та довідник рекламних платформ для демо. Усе — умовні значення, не реальні дані.
export interface Platform {
  id: string;
  name: string;
  initials: string;
  color: string;
  /** Назви носіїв з довідника, що обслуговує платформа. */
  carriers: string[];
  kind: "api" | "seller";
  /** Текст кнопки входу у кроці 1 майстра підключення. */
  loginLabel: string;
  /** Що саме дозволяємо. */
  scope: string;
  accountLabel: string;
  source: string;
}

/** Порядок фіксований: від нього залежить колір платформи на графіках. */
export const PLATFORMS: Platform[] = [
  { id: "meta", name: "Meta Ads", initials: "M", color: "#2a78d6", carriers: ["Meta (Facebook/Instagram)"], kind: "api", loginLabel: "Увійти через Meta Business", scope: "Лише читання статистики (ads_read)", accountLabel: "рекламний акаунт", source: "Meta Ads" },
  { id: "google", name: "Google Ads", initials: "G", color: "#eb6834", carriers: ["Google Search", "YouTube"], kind: "api", loginLabel: "Увійти через Google Ads", scope: "Лише читання статистики (adwords.readonly)", accountLabel: "акаунт Google Ads", source: "Google Ads" },
  { id: "tiktok", name: "TikTok Ads", initials: "T", color: "#1baf7a", carriers: ["TikTok"], kind: "api", loginLabel: "Увійти через TikTok For Business", scope: "Лише читання статистики (Reporting: read)", accountLabel: "рекламний кабінет", source: "TikTok Ads" },
  { id: "megogo", name: "MEGOGO", initials: "Mg", color: "#eda100", carriers: ["MEGOGO"], kind: "seller", loginLabel: "Отримати доступ до звітів MEGOGO", scope: "Лише читання звітів продавця", accountLabel: "договір / кабінет", source: "MEGOGO (звіт)" },
  { id: "sweet", name: "Sweet.tv", initials: "S", color: "#e87ba4", carriers: ["Sweet.tv"], kind: "seller", loginLabel: "Отримати доступ до звітів Sweet.tv", scope: "Лише читання звітів продавця", accountLabel: "договір / кабінет", source: "Sweet.tv (звіт)" },
  { id: "ukrnet", name: "Ukr.net", initials: "U", color: "#6250d6", carriers: ["Ukr.net"], kind: "seller", loginLabel: "Отримати доступ до звітів Ukr.net", scope: "Лише читання звітів продавця", accountLabel: "договір / кабінет", source: "Ukr.net (звіт)" },
];

export function platformOfCarrier(carrierName: string | undefined): Platform | undefined {
  return carrierName ? PLATFORMS.find((p) => p.carriers.includes(carrierName)) : undefined;
}

type Range = [number, number];
export interface Bench {
  cpm: Range; // грн за 1000 показів
  ctr: Range; // частка
  vtr?: Range; // частка (лише відео)
  cr: Range; // частка від кліків
  /** Умовна середня частота: показів на одного унікального користувача. */
  freq: number;
}

const BENCH: Record<string, Bench> = {
  "Meta (Facebook/Instagram)": { cpm: [60, 110], ctr: [0.006, 0.015], cr: [0.015, 0.04], freq: 2.6 },
  "Google Search": { cpm: [120, 200], ctr: [0.015, 0.035], cr: [0.02, 0.04], freq: 1.8 }, // пошук: CTR вищий за медійний
  YouTube: { cpm: [90, 160], ctr: [0.003, 0.007], vtr: [0.55, 0.75], cr: [0.01, 0.025], freq: 2.4 },
  TikTok: { cpm: [50, 90], ctr: [0.005, 0.012], vtr: [0.55, 0.72], cr: [0.01, 0.03], freq: 2.8 },
  MEGOGO: { cpm: [250, 400], ctr: [0.003, 0.006], vtr: [0.7, 0.8], cr: [0.01, 0.02], freq: 3.2 },
  "Sweet.tv": { cpm: [250, 400], ctr: [0.003, 0.006], vtr: [0.7, 0.8], cr: [0.01, 0.02], freq: 3.2 },
  "Ukr.net": { cpm: [30, 60], ctr: [0.003, 0.007], cr: [0.01, 0.025], freq: 2.2 },
};

export interface Profile {
  carrierName: string;
  formatName: string;
  video: boolean;
  bench: Bench;
}

export function profileOf(carrierName: string | undefined, formatName: string | undefined): Profile | undefined {
  if (!carrierName) return undefined;
  const bench = BENCH[carrierName];
  if (!bench) return undefined;
  const f = (formatName ?? "").toLowerCase();
  const video = !!bench.vtr && (f.includes("pre-roll") || f.includes("відео") || carrierName === "TikTok" || carrierName === "YouTube");
  return { carrierName, formatName: formatName ?? "", video, bench };
}

export const mid = (r: Range) => (r[0] + r[1]) / 2;
