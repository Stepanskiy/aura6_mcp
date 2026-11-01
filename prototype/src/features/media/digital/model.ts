// Спільна модель вкладок: цифрові роботи проєкту, їх план і факт.
import { useMemo } from "react";
import type { Work } from "../../../domain/types";
import { useRefs } from "../../../shell/hooks";
import { mediaOfWork } from "../util";
import { platformOfCarrier, profileOf, type Platform, type Profile } from "./benchmarks";
import { elapsedShare, planOf, type Plan } from "./simulate";
import type { StatsEntry } from "./store";

export interface DRow {
  work: Work;
  carrierName: string;
  formatName: string;
  platform?: Platform;
  profile?: Profile;
}

/** Цифрові роботи проєкту з довідниковими назвами носія й формату. */
export function useDigitalRows(works: Work[]): DRow[] {
  const refs = useRefs();
  return useMemo(
    () =>
      works
        .filter((w) => mediaOfWork(w, refs) === "Digital")
        .map((w) => {
          const carrierName = (w.carrierId && refs.carriers.get(w.carrierId)?.name) || "";
          const formatName = (w.formatId && refs.formats.get(w.formatId)?.name) || "";
          return { work: w, carrierName, formatName, platform: platformOfCarrier(carrierName), profile: profileOf(carrierName, formatName) };
        })
        .sort((a, b) => a.work.periodStart.localeCompare(b.work.periodStart)),
    [works, refs],
  );
}

export interface Totals {
  imp: number;
  reach: number;
  clk: number;
  view: number;
  conv: number;
  spend: number;
}

export interface KpiRow extends DRow {
  budget: number;
  elapsed: number;
  plan?: Plan;
  entry?: StatsEntry;
  fact?: Totals;
}

export function buildKpi(rows: DRow[], stats: Record<string, StatsEntry>, today: string): KpiRow[] {
  return rows.map((r) => {
    const entry = stats[r.work.id];
    const budget = entry?.planBudget ?? r.work.cost;
    const fact = entry && entry.days.length ? sumDays(entry) : undefined;
    return { ...r, budget, elapsed: elapsedShare(r.work.periodStart, r.work.periodEnd, today), plan: r.profile ? planOf(budget, r.profile) : undefined, entry, fact };
  });
}

function sumDays(e: StatsEntry): Totals {
  const t: Totals = { imp: 0, reach: 0, clk: 0, view: 0, conv: 0, spend: 0 };
  for (const d of e.days) {
    t.imp += d.imp; t.clk += d.clk; t.view += d.view; t.conv += d.conv; t.spend += d.spend;
  }
  t.reach = e.days[e.days.length - 1].reach;
  return t;
}

export const safeDiv = (a: number, b: number) => (b > 0 ? a / b : 0);

export function fmtTime(iso: string | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function fmtCompact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".", ",") + " млн";
  if (a >= 1e3) return Math.round(n / 1e3) + " тис.";
  return String(Math.round(n));
}
