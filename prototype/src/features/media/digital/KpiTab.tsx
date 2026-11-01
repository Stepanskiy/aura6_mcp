import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Coins, Download, Eye, MousePointerClick, Percent, PlayCircle, PlugZap, Target, Users, Wallet, XCircle } from "lucide-react";
import type { GradientName, Icon } from "../../../ui";
import * as XLSX from "xlsx";
import { Alert, Badge, Button, Card, Stat, Table, clsx } from "../../../ui";
import { fmtDate, fmtMoney, fmtMoney0, fmtPct, today as todayIso } from "../../../domain/calc";
import type { ProjectViewProps } from "../types";
import { PLATFORMS } from "./benchmarks";
import { PacingChart, SpendChart, type PacingPoint } from "./charts";
import { buildKpi, fmtTime, safeDiv, useDigitalRows, type KpiRow } from "./model";
import { daysBetween, eachDate, reachAt } from "./simulate";
import { useDigital } from "./store";
import { CHART_SERIES } from "../util";

type Level = "ok" | "warn" | "bad";

/** Обсяги: чим більше, тим краще. Витратні показники (CPM/CPC/CPA): чим менше, тим краще. */
function level(ratio: number, kind: "volume" | "cost"): Level {
  if (kind === "volume") return ratio >= 0.95 ? "ok" : ratio >= 0.8 ? "warn" : "bad";
  return ratio <= 1.05 ? "ok" : ratio <= 1.2 ? "warn" : "bad";
}
type Kind = "volume" | "cost" | "pace";
const LABELS: Record<Kind, Record<Level, string>> = {
  pace: { ok: "в темпі", warn: "розбіжність", bad: "суттєва розбіжність" },
  volume: { ok: "за планом", warn: "відставання", bad: "суттєве відставання" },
  cost: { ok: "в межах плану", warn: "перевитрата", bad: "суттєва перевитрата" },
};
function Mark({ l, kind }: { l: Level; kind: Kind }) {
  const I = l === "ok" ? CheckCircle2 : l === "warn" ? AlertTriangle : XCircle;
  const c = l === "ok" ? "text-emerald-700" : l === "warn" ? "text-amber-700" : "text-rose-700";
  return (
    <span className={clsx("inline-flex items-center gap-1 font-semibold", c)}>
      <I size={13} /> {LABELS[kind][l]}
    </span>
  );
}

const n0 = (v: number) => fmtMoney0(v);
const rate = (v: number) => fmtMoney(v);

export function KpiTab({ project, works }: ProjectViewProps) {
  const rows = useDigitalRows(works);
  const stats = useDigital((s) => s.stats);
  const today = todayIso();
  const kpi = useMemo(() => buildKpi(rows, stats, today), [rows, stats, today]);
  const withPlan = kpi.filter((k) => k.plan);
  const withFact = kpi.filter((k) => k.fact && k.plan);
  const hasFact = withFact.length > 0;
  const scope = hasFact ? withFact : withPlan;

  const sum = (f: (k: KpiRow) => number, list = scope) => list.reduce((a, k) => a + f(k), 0);
  // План до дати = повний план × частка часу, що минула.
  const pl = (f: (k: KpiRow) => number) => sum((k) => f(k) * k.elapsed);
  const fa = (f: (k: NonNullable<KpiRow["fact"]>) => number) => sum((k) => (k.fact ? f(k.fact) : 0));

  const planImp = hasFact ? pl((k) => k.plan!.impressions) : sum((k) => k.plan!.impressions);
  const planClk = hasFact ? pl((k) => k.plan!.clicks) : sum((k) => k.plan!.clicks);
  const planSpend = hasFact ? sum((k) => k.budget * k.elapsed) : sum((k) => k.budget);
  const planReach = hasFact ? sum((k) => reachAt(k.plan!.impressions, k.plan!.impressions * k.elapsed, k.profile!.bench.freq)) : sum((k) => k.plan!.reach);
  const planConv = hasFact ? pl((k) => k.plan!.conversions) : sum((k) => k.plan!.conversions);
  const video = scope.filter((k) => k.profile?.video);
  const planViews = video.reduce((a, k) => a + k.plan!.views * (hasFact ? k.elapsed : 1), 0);
  const planVideoImp = video.reduce((a, k) => a + k.plan!.impressions * (hasFact ? k.elapsed : 1), 0);

  const F = {
    imp: fa((f) => f.imp), reach: fa((f) => f.reach), clk: fa((f) => f.clk), spend: fa((f) => f.spend), conv: fa((f) => f.conv),
    view: video.reduce((a, k) => a + (k.fact?.view ?? 0), 0),
    videoImp: video.reduce((a, k) => a + (k.fact?.imp ?? 0), 0),
  };

  function tile(label: string, icon: Icon, gradient: GradientName, factV: number, planV: number, fmt: (v: number) => string, kind: "volume" | "cost", extra?: ReactNode) {
    if (!hasFact) return <Stat key={label} icon={icon} gradient={gradient} label={label} value={fmt(planV)} sub={<>план{extra ? <> · {extra}</> : null}</>} />;
    if (!planV) return <Stat key={label} icon={icon} gradient={gradient} label={label} value={fmt(factV)} sub={<>план — {extra}</>} />;
    const ratio = safeDiv(factV, planV);
    return (
      <Stat
        key={label}
        icon={icon}
        gradient={gradient}
        label={label}
        value={fmt(factV)}
        sub={
          <div className="space-y-0.5">
            <div>
              план {fmt(planV)} · {kind === "volume" ? `${Math.round(ratio * 100)}%` : `${ratio >= 1 ? "+" : ""}${Math.round((ratio - 1) * 100)}%`} {extra}
            </div>
            <Mark l={level(ratio, kind)} kind={kind} />
          </div>
        }
      />
    );
  }

  const factCtr = safeDiv(F.clk, F.imp), planCtr = safeDiv(planClk, planImp);
  const factCpm = safeDiv(F.spend, F.imp) * 1000, planCpm = safeDiv(planSpend, planImp) * 1000;
  const factCpc = safeDiv(F.spend, F.clk), planCpc = safeDiv(planSpend, planClk);
  const factVtr = safeDiv(F.view, F.videoImp), planVtr = safeDiv(planViews, planVideoImp);
  const factCpa = safeDiv(F.spend, F.conv), planCpa = safeDiv(planSpend, planConv);

  // Графіки.
  const pacing: PacingPoint[] = useMemo(() => {
    const list = hasFact ? withFact : withPlan;
    if (!list.length) return [];
    const from = list.reduce((m, k) => (k.work.periodStart < m ? k.work.periodStart : m), list[0].work.periodStart);
    const to = list.reduce((m, k) => (k.work.periodEnd > m ? k.work.periodEnd : m), list[0].work.periodEnd);
    const plan = new Map<string, number>(), fact = new Map<string, number>();
    for (const k of list) {
      const len = daysBetween(k.work.periodStart, k.work.periodEnd) + 1;
      for (const d of eachDate(k.work.periodStart, k.work.periodEnd)) plan.set(d, (plan.get(d) ?? 0) + k.plan!.impressions / len);
      for (const d of k.entry?.days ?? []) fact.set(d.d, (fact.get(d.d) ?? 0) + d.imp);
    }
    return eachDate(from, to).map((d) => ({ d, plan: Math.round(plan.get(d) ?? 0), fact: fact.has(d) ? fact.get(d) : undefined }));
  }, [hasFact, withFact, withPlan]);

  const bars = PLATFORMS.map((p, i) => ({
    name: p.name,
    color: CHART_SERIES[i % CHART_SERIES.length],
    value: Math.round(kpi.filter((k) => k.platform?.id === p.id).reduce((a, k) => a + (hasFact ? (k.fact?.spend ?? 0) : k.budget), 0)),
  })).filter((b) => (hasFact ? b.value > 0 || kpi.some((k) => k.platform?.name === b.name) : b.value > 0));

  function exportXlsx() {
    const data = kpi.map((k) => ({
      Носій: k.carrierName, Формат: k.formatName, Початок: k.work.periodStart, Кінець: k.work.periodEnd,
      "Бюджет, грн": k.budget, "Витрачено, грн": k.fact?.spend ?? "",
      "Покази (план)": k.plan ? Math.round(k.plan.impressions) : "", "Покази (факт)": k.fact?.imp ?? "",
      "CPM (план)": k.plan ? +k.plan.cpm.toFixed(2) : "", "CPM (факт)": k.fact ? +(safeDiv(k.fact.spend, k.fact.imp) * 1000).toFixed(2) : "",
      Кліки: k.fact?.clk ?? "", "CTR, %": k.fact ? +(safeDiv(k.fact.clk, k.fact.imp) * 100).toFixed(2) : "",
      "CPC, грн": k.fact ? +safeDiv(k.fact.spend, k.fact.clk).toFixed(2) : "",
      Перегляди: k.fact && k.profile?.video ? k.fact.view : "", "VTR, %": k.fact && k.profile?.video ? +(safeDiv(k.fact.view, k.fact.imp) * 100).toFixed(1) : "",
      Конверсії: k.fact?.conv ?? "", "CPA, грн": k.fact ? +safeDiv(k.fact.spend, k.fact.conv).toFixed(2) : "",
      "Витрати / бюджет, %": k.fact ? Math.round((k.fact.spend / k.budget) * 100) : "", "Час флайту минув, %": Math.round(k.elapsed * 100),
      Джерело: k.entry ? k.platform?.source : "", Синхронізовано: k.entry ? fmtTime(k.entry.syncedAt) : "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ефективність");
    XLSX.writeFile(wb, `${project.code}_ефективність.xlsx`);
  }

  if (!rows.length) return <Alert tone="sky">У проєкті немає цифрових робіт.</Alert>;

  return (
    <div className="space-y-4">
      {!hasFact && (
        <Alert tone="amber">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <b>Підключіть кабінети, щоб побачити факт.</b> Зараз показано лише план, розрахований з бюджету за середніми орієнтирами носіїв (CPM, CTR, VTR, CR).
            </div>
            <Link to="?tab=cabinets" className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-1.5 text-sm font-semibold text-white shadow">
              <PlugZap size={15} /> До рекламних кабінетів
            </Link>
          </div>
        </Alert>
      )}
      {hasFact && withFact.length < withPlan.length && (
        <Alert tone="sky">Факт є для {withFact.length} з {withPlan.length} робіт; показники нижче порівнюють лише їх. Решту можна завантажити на вкладці <Link className="font-semibold underline" to="?tab=cabinets">«Рекламні кабінети»</Link>.</Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tile("Покази", Eye, "violet", F.imp, planImp, n0, "volume")}
        {tile("Охоплення", Users, "fuchsia", F.reach, planReach, n0, "volume", <span title="Сума охоплень по носіях: унікальні користувачі між носіями не дедуплікуються">∑ по носіях</span>)}
        {tile("Кліки", MousePointerClick, "cyan", F.clk, planClk, n0, "volume")}
        {tile("CTR", Percent, "teal", factCtr, planCtr, fmtPct, "volume")}
        {tile("CPM, грн", Coins, "amber", factCpm, planCpm, rate, "cost")}
        {tile("CPC, грн", Wallet, "orange", factCpc, planCpc, rate, "cost")}
        {tile("Перегляди · VTR", PlayCircle, "rose", F.view, planViews, n0, "volume", video.length ? <>VTR {fmtPct(hasFact ? factVtr : planVtr)}</> : "немає відео")}
        {tile("Конверсії · CPA", Target, "lime", F.conv, planConv, n0, "volume", <>CPA {rate(hasFact ? factCpa : planCpa)} грн</>)}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Покази за днями: факт і плановий темп">
          <PacingChart data={pacing} hasFact={hasFact} />
        </Card>
        <Card title={hasFact ? "Витрачено за платформами, грн" : "Бюджет за платформами (план), грн"}>
          <SpendChart data={bars} label={hasFact ? "Витрачено" : "Бюджет"} />
        </Card>
      </div>

      <Card
        title="Показники за роботами"
        actions={
          <Button onClick={exportXlsx}>
            <Download size={15} /> Excel
          </Button>
        }
      >
        <Table>
          <thead>
            <tr className="whitespace-nowrap">
              <th>Носій / формат</th>
              <th>Період</th>
              <th className="text-right">Бюджет</th>
              <th className="text-right">Витрачено</th>
              <th className="text-right">Покази план / факт</th>
              <th className="text-right">CPM план / факт</th>
              <th className="text-right">Кліки</th>
              <th className="text-right">CTR</th>
              <th className="text-right">CPC</th>
              <th className="text-right">Перегляди</th>
              <th className="text-right">VTR</th>
              <th className="text-right">Конверсії</th>
              <th className="text-right">CPA</th>
              <th>Темп: витрати / час</th>
              <th>Джерело</th>
            </tr>
          </thead>
          <tbody className="text-xs tabular-nums">
            {kpi.map((k) => {
              const f = k.fact;
              const dash = <span className="text-slate-300">—</span>;
              const spendShare = f ? f.spend / k.budget : 0;
              const lvl = f ? (Math.abs(spendShare - k.elapsed) <= 0.1 ? "ok" : Math.abs(spendShare - k.elapsed) <= 0.2 ? "warn" : "bad") : undefined;
              return (
                <tr key={k.work.id}>
                  <td className="whitespace-nowrap">
                    <div className="font-semibold text-slate-800">{k.carrierName || "—"}</div>
                    <div className="text-slate-500">{k.formatName}</div>
                  </td>
                  <td className="whitespace-nowrap text-slate-700">{fmtDate(k.work.periodStart)} – {fmtDate(k.work.periodEnd)}</td>
                  <td className="text-right text-slate-800">{fmtMoney0(k.budget)}</td>
                  <td className="text-right text-slate-800">{f ? fmtMoney0(f.spend) : dash}</td>
                  <td className="text-right text-slate-800">{k.plan ? n0(k.plan.impressions) : dash} / {f ? n0(f.imp) : dash}</td>
                  <td className="text-right text-slate-800">{k.plan ? rate(k.plan.cpm) : dash} / {f ? rate(safeDiv(f.spend, f.imp) * 1000) : dash}</td>
                  <td className="text-right text-slate-800">{f ? n0(f.clk) : dash}</td>
                  <td className="text-right text-slate-800">{f ? fmtPct(safeDiv(f.clk, f.imp)) : dash}</td>
                  <td className="text-right text-slate-800">{f ? rate(safeDiv(f.spend, f.clk)) : dash}</td>
                  <td className="text-right text-slate-800">{f && k.profile?.video ? n0(f.view) : dash}</td>
                  <td className="text-right text-slate-800">{f && k.profile?.video ? fmtPct(safeDiv(f.view, f.imp)) : dash}</td>
                  <td className="text-right text-slate-800">{f ? n0(f.conv) : dash}</td>
                  <td className="text-right text-slate-800">{f ? rate(safeDiv(f.spend, f.conv)) : dash}</td>
                  <td className="min-w-[150px]">
                    <div className="relative h-2 overflow-hidden rounded-full bg-slate-100" title={`Витрачено ${Math.round(spendShare * 100)}% бюджету, минуло ${Math.round(k.elapsed * 100)}% часу`}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, spendShare * 100)}%`, background: CHART_SERIES[0] }} />
                      <div className="absolute inset-y-0 w-0.5 bg-slate-700" style={{ left: `${k.elapsed * 100}%` }} />
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-slate-600">
                      <span>{f ? Math.round(spendShare * 100) : 0}% / {Math.round(k.elapsed * 100)}%</span>
                      {lvl && <Mark l={lvl} kind="pace" />}
                    </div>
                  </td>
                  <td className="whitespace-nowrap">
                    {k.entry && k.platform ? (
                      <>
                        <Badge tone="indigo">{k.platform.source}</Badge>
                        <div className="mt-0.5 text-[11px] text-slate-500">{fmtTime(k.entry.syncedAt)}</div>
                      </>
                    ) : (
                      <Badge>немає даних</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <p className="mt-2 text-xs text-slate-500">
          Факт у демо симулюється детерміновано (орієнтири: CPM Meta 60–110 грн, YouTube 90–160, TikTok 50–90, CTV 250–400, Ukr.net 30–60). Тонка лінія на смузі темпу — частка часу флайту, що минула. Стан на {fmtDate(today)}.
        </p>
      </Card>
    </div>
  );
}
