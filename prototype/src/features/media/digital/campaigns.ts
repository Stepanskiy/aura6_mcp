// Генерація «кампаній у кабінеті» та акаунтів для демо. Детерміновано.
import type { Platform } from "./benchmarks";
import type { DRow } from "./model";
import { hashOf } from "./simulate";
import type { Campaign } from "./store";

const SHORT: Record<string, string> = { meta: "Meta", tiktok: "TikTok", megogo: "MEGOGO", sweet: "SweetTV", ukrnet: "Ukrnet" };

function season(iso: string): string {
  const m = +iso.slice(5, 7);
  const s = m === 12 || m <= 2 ? "Winter" : m <= 5 ? "Spring" : m <= 8 ? "Summer" : "Autumn";
  return s + iso.slice(2, 4);
}

function objective(r: DRow): string {
  if (r.platform?.id === "google" && r.carrierName === "Google Search") return "Search_Brand";
  if (r.platform?.id === "ukrnet") return "Display";
  if (!r.profile?.video) return "Traffic";
  return hashOf(r.work.id) % 2 ? "Reach" : "VideoViews";
}

/** Кампанії кабінету: по одній на кожну роботу платформи + одна «чужа», що ні до чого не зіставляється. */
export function genCampaigns(projectCode: string, platform: Platform, rows: DRow[]): Campaign[] {
  const prefix = projectCode.slice(0, 3);
  const seen = new Map<string, number>();
  const items: Campaign[] = rows.map((r) => {
    const short = platform.id === "google" ? (r.carrierName === "YouTube" ? "YouTube" : "Google") : SHORT[platform.id];
    const base = `${prefix}_${short}_${season(r.work.periodStart)}_${objective(r)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return {
      id: "cmp_" + hashOf(r.work.id + platform.id).toString(36),
      name: n > 1 ? `${base}_v${n}` : base,
      workId: r.work.id,
      confidence: n > 1 ? 0.71 : 0.8 + (hashOf(r.work.id) % 20) / 100,
    };
  });
  // Перші дублікати теж менш певні: назви відрізняються лише суфіксом.
  for (const c of items) if (items.some((o) => o !== c && o.name === c.name + "_v2")) c.confidence = 0.74;
  items.push({ id: "cmp_" + hashOf(projectCode + platform.id + "ao").toString(36), name: `${prefix}_${SHORT[platform.id] ?? "Google"}_AlwaysOn_Retargeting`, workId: "", confidence: 0 });
  return items;
}

export interface Account {
  id: string;
  name: string;
}

export function genAccounts(platform: Platform, clientName: string): Account[] {
  const h = (k: string) => hashOf(platform.id + clientName + k);
  const digits = (k: string, n: number) => {
    let out = "";
    for (let i = 0; out.length < n; i++) out += String(h(k + i));
    return out.slice(0, n);
  };
  const idFor = (k: string) =>
    platform.id === "meta" ? `act_${digits(k, 15)}` : platform.id === "google" ? `${digits(k, 3)}-${digits(k + "b", 3)}-${digits(k + "c", 4)}` : platform.id === "tiktok" ? `${digits(k, 19)}` : `CNT-26-${digits(k, 4)}`;
  const labels = platform.kind === "seller" ? ["Договір 2026", "Договір 2025 (архів)"] : ["Performance", "Brand", "Test sandbox"];
  return labels.map((l, i) => ({ id: idFor("a" + i), name: `${clientName} — ${l}` }));
}
