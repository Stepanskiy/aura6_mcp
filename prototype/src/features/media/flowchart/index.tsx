import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CalendarRange, CheckCircle2, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { Alert, Button, Card, Empty, Stat, clsx } from "../../../ui";
import { fmtDate, fmtMoney0 } from "../../../domain/calc";
import type { MediaType, Work } from "../../../domain/types";
import { useRefs } from "../../../shell/hooks";
import { CHART_GRID } from "../util";
import { mediaOfWork } from "../util";
import type { ProjectView, ProjectViewProps } from "../types";
import {
  MEDIA_LABEL,
  MEDIA_ORDER,
  PX_PER_DAY,
  TODAY,
  defaultScale,
  dayNum,
  fmtCompact,
  isoOfDay,
  groupBuckets,
  isPlacementMedia,
  makeBuckets,
  mediaColor,
  overlapDays,
  prorate,
  spanDays,
  type Scale,
} from "./logic";

const LEFT_W = 300;
const ROW_H = 38;
const SCALES: { id: Scale; label: string }[] = [
  { id: "day", label: "Дні" },
  { id: "week", label: "Тижні" },
  { id: "month", label: "Місяці" },
];

interface Row {
  work: Work;
  media: MediaType;
  carrier: string;
  format: string;
  contractor: string;
  start: number;
  end: number;
  days: number;
}
interface CarrierGroup {
  name: string;
  rows: Row[];
  budget: number;
}
interface MediaGroup {
  media: MediaType;
  carriers: CarrierGroup[];
  budget: number;
  cost: number;
}

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: string }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" className="h-4 w-4 accent-fuchsia-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

function FlowchartTab({ project, works }: ProjectViewProps) {
  const refs = useRefs();
  const [showCost, setShowCost] = useState(false);
  const [onlyActive, setOnlyActive] = useState(false);
  const [scaleOverride, setScaleOverride] = useState<Scale | null>(null);
  const [tip, setTip] = useState<{ row: Row; x: number; y: number } | null>(null);
  const today = dayNum(TODAY);

  const allRows = useMemo<Row[]>(() => {
    const res: Row[] = [];
    for (const w of works) {
      const media = mediaOfWork(w, refs);
      if (!isPlacementMedia(media)) continue;
      const carrier = w.carrierId ? refs.carriers.get(w.carrierId) : undefined;
      const start = dayNum(w.periodStart);
      const end = Math.max(start, dayNum(w.periodEnd));
      res.push({
        work: w,
        media,
        carrier: carrier?.name ?? "Без носія",
        format: (w.formatId ? refs.formats.get(w.formatId)?.name : undefined) ?? refs.workTypes.get(w.workTypeId)?.name ?? "—",
        contractor: refs.contractors.get(w.contractorId ?? carrier?.contractorId ?? "")?.name ?? "—",
        start,
        end,
        days: spanDays(w.periodStart, w.periodEnd),
      });
    }
    return res;
  }, [works, refs]);

  const rows = useMemo(() => (onlyActive ? allRows.filter((r) => !r.work.closed) : allRows), [allRows, onlyActive]);

  const [from, to] = useMemo(() => {
    const src = allRows.length ? allRows : [];
    return [Math.min(...src.map((r) => r.start)), Math.max(...src.map((r) => r.end))];
  }, [allRows]);

  const scale = scaleOverride ?? (allRows.length ? defaultScale(from, to) : "week");
  const ppd = PX_PER_DAY[scale];

  const buckets = useMemo(() => (allRows.length ? makeBuckets(scale, from, to) : []), [scale, from, to, allRows.length]);
  const rangeStart = buckets[0]?.start ?? 0;
  const rangeEnd = buckets.length ? buckets[buckets.length - 1].end : 0;
  const timelineW = (rangeEnd - rangeStart) * ppd;
  const xOf = (d: number) => (d - rangeStart) * ppd;

  const groups = useMemo<MediaGroup[]>(() => {
    const res: MediaGroup[] = [];
    for (const media of MEDIA_ORDER) {
      const mr = rows.filter((r) => r.media === media);
      if (!mr.length) continue;
      const byCarrier = new Map<string, Row[]>();
      for (const r of mr) byCarrier.set(r.carrier, [...(byCarrier.get(r.carrier) ?? []), r]);
      const carriers = [...byCarrier.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], "uk"))
        .map(([name, rs]) => ({ name, rows: rs.sort((a, b) => a.start - b.start), budget: rs.reduce((s, r) => s + r.work.income, 0) }));
      res.push({ media, carriers, budget: mr.reduce((s, r) => s + r.work.income, 0), cost: mr.reduce((s, r) => s + r.work.cost, 0) });
    }
    return res;
  }, [rows]);

  const presentMedia = groups.map((g) => g.media);
  const perBucket = useMemo(() => prorate(rows.map((r) => ({ start: r.work.periodStart, end: r.work.periodEnd, income: r.work.income })), buckets), [rows, buckets]);
  const maxBucket = Math.max(1, ...perBucket);
  const topGroups = groupBuckets(buckets);
  const totalBudget = rows.reduce((s, r) => s + r.work.income, 0);
  const totalCost = rows.reduce((s, r) => s + r.work.cost, 0);
  const overdue = rows.filter((r) => !r.work.closed && r.end < today).length;
  const bucketWord = scale === "day" ? "днях" : scale === "week" ? "тижнях" : "місяцях";

  function exportXlsx() {
    const head = ["Медіа", "Носій", "Формат", "Підрядник", "Початок", "Кінець", "Бюджет", ...buckets.map((b) => b.full)];
    const data = rows.map((r) => [
      MEDIA_LABEL[r.media],
      r.carrier,
      r.format,
      r.contractor,
      fmtDate(r.work.periodStart),
      fmtDate(r.work.periodEnd),
      r.work.income,
      ...buckets.map((b) => (overlapDays(r.start, r.end, b) > 0 ? 1 : "")),
    ]);
    const ws = XLSX.utils.aoa_to_sheet([head, ...data]);
    ws["!cols"] = [{ wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 11 }, { wch: 11 }, { wch: 14 }, ...buckets.map(() => ({ wch: 6 }))];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Флоучарт");
    XLSX.writeFile(wb, `Флоучарт ${project.code}.xlsx`);
  }

  if (!allRows.length) return <Empty>У проєкті немає робіт з розміщення в медіа.</Empty>;

  const todayX = today >= rangeStart && today < rangeEnd ? xOf(today) + ppd / 2 : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Бюджет (дохід)" value={fmtMoney0(totalBudget)} sub={`${rows.length} виходів`} />
        <Stat label="Період" value={`${fmtDate(isoOfDay(from)).slice(0, 5)} – ${fmtDate(isoOfDay(to)).slice(0, 5)}`} sub={`${to - from + 1} днів, ${fmtDate(isoOfDay(to)).slice(6)}`} icon={CalendarRange} gradient="cyan" />
        <Stat label="Видів медіа" value={String(presentMedia.length)} sub={presentMedia.map((m) => MEDIA_LABEL[m]).join(", ")} gradient="fuchsia" />
        {showCost ? <Stat label="Затрати" value={fmtMoney0(totalCost)} sub={`маржа ${fmtMoney0(totalBudget - totalCost)}`} /> : <Stat label="Не закрито після періоду" value={String(overdue)} sub="виходи в минулому" gradient="amber" icon={AlertTriangle} />}
      </div>

      <Card
        title="Календар виходів"
        actions={
          <Button onClick={exportXlsx}>
            <FileSpreadsheet size={16} /> Флоучарт в Excel
          </Button>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="inline-flex rounded-xl border border-violet-200 bg-white p-0.5" role="group" aria-label="Шкала часу">
            {SCALES.map((s) => (
              <button
                key={s.id}
                onClick={() => setScaleOverride(s.id)}
                className={clsx("rounded-lg px-3 py-1 text-sm font-semibold transition", scale === s.id ? "bg-juicy text-white shadow" : "text-slate-600 hover:bg-violet-50")}
              >
                {s.label}
              </button>
            ))}
          </div>
          <Toggle checked={showCost} onChange={setShowCost}>
            Показати затрати
          </Toggle>
          <Toggle checked={onlyActive} onChange={setOnlyActive}>
            Тільки активні
          </Toggle>
          {presentMedia.length >= 2 && (
            <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
              {presentMedia.map((m) => (
                <span key={m} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                  <span className="h-2.5 w-4 rounded-sm" style={{ background: mediaColor(m) }} />
                  {MEDIA_LABEL[m]}
                </span>
              ))}
            </div>
          )}
        </div>

        {!rows.length ? (
          <Alert tone="sky">Усі виходи закриті. Вимкніть «Тільки активні», щоб побачити їх.</Alert>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-violet-100 bg-white">
            <div style={{ width: LEFT_W + timelineW, minWidth: "100%" }} className="relative">
              {/* Шапка */}
              <div className="flex border-b border-violet-100 bg-violet-50/60">
                <div style={{ width: LEFT_W }} className="sticky left-0 z-20 flex shrink-0 items-end justify-between border-r border-violet-100 bg-violet-50 px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-violet-900/70">
                  <span>Носій / формат</span>
                  <span>Бюджет</span>
                </div>
                <div style={{ width: timelineW }} className="shrink-0">
                  <div className="flex border-b border-violet-100/70">
                    {topGroups.map((g) => (
                      <div key={g.key} style={{ width: g.days * ppd }} className="overflow-hidden whitespace-nowrap border-r border-violet-100 px-2 py-1 text-xs font-bold text-slate-700">
                        {g.label}
                      </div>
                    ))}
                  </div>
                  <div className="flex">
                    {buckets.map((b) => (
                      <div
                        key={b.key}
                        title={b.full}
                        style={{ width: (b.end - b.start) * ppd }}
                        className={clsx("overflow-hidden border-r border-violet-100/60 py-1 text-center text-[11px] tabular-nums text-slate-500", b.weekend && "bg-violet-100/60")}
                      >
                        {scale === "week" ? <span>{b.label}</span> : b.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Тіло */}
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 z-0" style={{ left: LEFT_W, width: timelineW }} aria-hidden>
                  {buckets.map((b) => (
                    <div
                      key={b.key}
                      className="absolute inset-y-0"
                      style={{ left: xOf(b.start), width: (b.end - b.start) * ppd, borderRight: `1px solid ${CHART_GRID}`, background: b.weekend ? "rgba(139,92,246,0.06)" : undefined }}
                    />
                  ))}
                  {todayX !== null && (
                    <div className="absolute inset-y-0 z-10" style={{ left: todayX }}>
                      <div className="h-full w-0.5 bg-rose-500" />
                    </div>
                  )}
                </div>
                {todayX !== null && (
                  <div className="pointer-events-none absolute z-20" style={{ left: LEFT_W + todayX, top: 2, transform: "translateX(-50%)" }}>
                    <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">сьогодні</span>
                  </div>
                )}

                {groups.map((g) => (
                  <div key={g.media} className="relative z-[1]">
                    <div className="flex bg-violet-50/70" style={{ height: 30 }}>
                      <div style={{ width: LEFT_W }} className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-violet-100 bg-violet-50 px-3">
                        <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: mediaColor(g.media) }} />
                        <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">{MEDIA_LABEL[g.media]}</span>
                        <span className="text-sm font-bold tabular-nums text-slate-800">{fmtMoney0(g.budget)}</span>
                      </div>
                    </div>
                    {g.carriers.map((c) => (
                      <div key={c.name}>
                        <div className="flex" style={{ height: 24 }}>
                          <div style={{ width: LEFT_W }} className="sticky left-0 z-10 flex shrink-0 items-center justify-between gap-2 border-r border-violet-100 bg-white px-3 pl-5">
                            <span className="min-w-0 truncate text-xs font-semibold text-slate-600">{c.name}</span>
                            <span className="text-xs tabular-nums text-slate-500">{fmtMoney0(c.budget)}</span>
                          </div>
                        </div>
                        {c.rows.map((r) => (
                          <WorkRow key={r.work.id} r={r} showCost={showCost} today={today} xOf={xOf} ppd={ppd} timelineW={timelineW} onTip={setTip} />
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Бюджет по кошиках */}
              <div className="relative z-[1] flex border-t-2 border-violet-200 bg-violet-50/30">
                <div style={{ width: LEFT_W }} className="sticky left-0 z-10 flex shrink-0 flex-col justify-center border-r border-violet-100 bg-violet-50 px-3 py-2">
                  <span className="text-sm font-bold text-slate-800">Бюджет по {bucketWord}</span>
                  <span className="text-xs tabular-nums text-slate-500">разом {fmtMoney0(totalBudget)}</span>
                </div>
                <div className="flex shrink-0" style={{ width: timelineW }}>
                  {buckets.map((b, i) => {
                    const v = perBucket[i];
                    const w = (b.end - b.start) * ppd;
                    return (
                      <div key={b.key} title={`${b.full}: ${fmtMoney0(v)}`} style={{ width: w }} className="flex flex-col justify-end border-r border-violet-100/60 px-px py-1">
                        <div className="h-4 overflow-hidden text-center text-[10px] tabular-nums leading-4 text-slate-600">{w >= 40 && v > 0 ? fmtCompact(v) : ""}</div>
                        <div className="h-8 w-full">
                          <div className="flex h-full items-end">
                            <div className="w-full rounded-t-[3px] bg-violet-500" style={{ height: `${Math.max(v > 0 ? 6 : 0, (v / maxBucket) * 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {tip && createPortal(<Tooltip tip={tip} showCost={showCost} />, document.body)}
    </div>
  );
}

function WorkRow({
  r,
  showCost,
  today,
  xOf,
  ppd,
  timelineW,
  onTip,
}: {
  r: Row;
  showCost: boolean;
  today: number;
  xOf: (d: number) => number;
  ppd: number;
  timelineW: number;
  onTip: (t: { row: Row; x: number; y: number } | null) => void;
}) {
  const left = xOf(r.start);
  const width = Math.max(6, (r.end - r.start + 1) * ppd);
  const overdue = !r.work.closed && r.end < today;
  const roomRight = timelineW - (left + width) > 100;
  return (
    <div className="flex" style={{ height: ROW_H }}>
      <div style={{ width: LEFT_W }} className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-violet-100 bg-white px-3 pl-7">
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[13px] font-medium text-slate-800" title={r.format}>
            {r.format}
          </div>
          <div className="truncate text-[11px] text-slate-500" title={r.contractor}>
            {r.contractor}
          </div>
        </div>
        <div className="text-right leading-tight">
          <div className="text-[13px] tabular-nums text-slate-800">{fmtMoney0(r.work.income)}</div>
          {showCost && <div className="text-[11px] tabular-nums text-rose-600">−{fmtMoney0(r.work.cost)}</div>}
        </div>
      </div>
      <div className="relative shrink-0" style={{ width: timelineW }}>
        <div
          className="absolute flex items-center justify-end rounded-[4px] px-1 shadow-sm ring-1 ring-black/5 transition hover:brightness-110"
          style={{ left, width, top: 1, bottom: 1, background: mediaColor(r.media) }}
          onMouseMove={(e) => onTip({ row: r, x: e.clientX, y: e.clientY })}
          onMouseLeave={() => onTip(null)}
        >
          {r.work.closed && <CheckCircle2 size={14} className="shrink-0 text-white" aria-label="Закрито" />}
        </div>
        {overdue && (
          <span
            className="absolute flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-amber-300"
            style={roomRight ? { left: left + width + 4, top: ROW_H / 2 - 10 } : { left: Math.max(2, left + width - 96), top: ROW_H / 2 - 10 }}
          >
            <AlertTriangle size={11} /> Не закрито
          </span>
        )}
      </div>
    </div>
  );
}

function Tooltip({ tip, showCost }: { tip: { row: Row; x: number; y: number }; showCost: boolean }) {
  const { row: r } = tip;
  const left = Math.min(tip.x + 14, window.innerWidth - 280);
  const top = Math.min(tip.y + 14, window.innerHeight - 230);
  const line = (k: string, v: string) => (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{k}</span>
      <span className="text-right font-medium tabular-nums text-slate-900">{v}</span>
    </div>
  );
  return (
    <div className="pointer-events-none fixed z-[100] w-[264px] rounded-xl border border-violet-200 bg-white p-3 text-xs shadow-xl shadow-violet-900/20" style={{ left, top }}>
      <div className="mb-1.5 flex items-center gap-2 font-bold text-slate-900">
        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: mediaColor(r.media) }} />
        {r.carrier}
      </div>
      <div className="space-y-0.5">
        {line("Формат", r.format)}
        {line("Підрядник", r.contractor)}
        {line("Період", `${fmtDate(r.work.periodStart)} – ${fmtDate(r.work.periodEnd)}`)}
        {line("Днів", String(r.days))}
        {line("Бюджет (дохід)", fmtMoney0(r.work.income))}
        {showCost && line("Затрата", fmtMoney0(r.work.cost))}
        {line("Бюджет на день", fmtMoney0(r.work.income / r.days))}
        {r.work.closed ? line("Статус", "Закрито") : r.end < dayNum(TODAY) ? line("Статус", "Не закрито") : null}
      </div>
    </div>
  );
}

export const flowchartView: ProjectView = {
  id: "flowchart",
  title: "Календар виходів",
  icon: CalendarRange,
  applies: (works, mediaOf) => works.some((w) => isPlacementMedia(mediaOf(w))),
  Component: FlowchartTab,
};
