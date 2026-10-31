import { Button, Card, Field, Input, Select, clsx } from "../../ui";
import { REPORT_DIMENSIONS, REPORT_MEASURES, type ReportDimension, type ReportMeasure } from "../../shell/routes";
import { MAX_ROWS, MEDIA_TYPES, PRESETS, QUICK_PERIODS, configOfPreset, type Lookups } from "./config";
import type { Filters, ReportConfig } from "./engine";

interface Props {
  cfg: ReportConfig;
  lookups: Lookups;
  onChange: (patch: Partial<ReportConfig>) => void;
  onPreset: (cfg: ReportConfig) => void;
}

const dimKeys = Object.keys(REPORT_DIMENSIONS) as ReportDimension[];
const measureKeys = Object.keys(REPORT_MEASURES) as ReportMeasure[];

export function PresetBar({ cfg, onPreset }: Pick<Props, "cfg" | "onPreset">) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map((p) => (
        <button
          key={p.id}
          onClick={() => onPreset(configOfPreset(p, cfg))}
          className={clsx(
            "rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
            cfg.preset === p.id ? "border-indigo-600 bg-indigo-600 text-white shadow-sm" : "border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50",
          )}
        >
          {p.title}
        </button>
      ))}
    </div>
  );
}

export function Controls({ cfg, lookups, onChange }: Omit<Props, "onPreset">) {
  const setFilter = (patch: Partial<Filters>) => onChange({ filters: { ...cfg.filters, ...patch } });
  const moveRow = (i: number, d: -1 | 1) => {
    const rows = [...cfg.rows];
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    [rows[i], rows[j]] = [rows[j], rows[i]];
    onChange({ rows });
  };
  const free = dimKeys.filter((d) => !cfg.rows.includes(d) && d !== cfg.col);
  const brands = cfg.filters.client ? lookups.brands.filter((b) => (b as { clientId?: string }).clientId === cfg.filters.client) : lookups.brands;
  const f = cfg.filters;
  const activeFilters = Object.values(f).filter(Boolean).length;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Період">
        <div className="grid grid-cols-2 gap-3">
          <Field label="З">
            <Input type="date" value={cfg.from ?? ""} onChange={(e) => onChange({ from: e.target.value || undefined })} />
          </Field>
          <Field label="По">
            <Input type="date" value={cfg.to ?? ""} onChange={(e) => onChange({ to: e.target.value || undefined })} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {QUICK_PERIODS.map((q) => (
            <button key={q.id} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-indigo-100 hover:text-indigo-700" onClick={() => onChange(q.range().from ? q.range() : { from: undefined, to: undefined })}>
              {q.title}
            </button>
          ))}
        </div>
        <label className="mt-3 flex items-start gap-2 text-sm text-slate-600">
          <input type="checkbox" className="mt-0.5" checked={cfg.prorate} onChange={(e) => onChange({ prorate: e.target.checked })} />
          <span>Розподіляти суми пропорційно дням періоду</span>
        </label>
      </Card>

      <Card title={`Рядки (до ${MAX_ROWS}) і колонки`}>
        <div className="space-y-1.5">
          {cfg.rows.length === 0 && <div className="text-sm text-slate-400">Без групування — лише підсумок</div>}
          {cfg.rows.map((d, i) => (
            <div key={d} className="flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2 py-1 text-sm">
              <span className="w-4 text-xs text-indigo-400">{i + 1}</span>
              <span className="flex-1 font-medium text-indigo-900">{REPORT_DIMENSIONS[d]}</span>
              <button className="px-1 text-slate-500 hover:text-indigo-700 disabled:opacity-30" disabled={i === 0} onClick={() => moveRow(i, -1)} title="Вище">↑</button>
              <button className="px-1 text-slate-500 hover:text-indigo-700 disabled:opacity-30" disabled={i === cfg.rows.length - 1} onClick={() => moveRow(i, 1)} title="Нижче">↓</button>
              <button className="px-1 text-slate-400 hover:text-red-600" onClick={() => onChange({ rows: cfg.rows.filter((x) => x !== d) })} title="Прибрати">✕</button>
            </div>
          ))}
          {cfg.rows.length < MAX_ROWS && (
            <Select value="" onChange={(e) => e.target.value && onChange({ rows: [...cfg.rows, e.target.value as ReportDimension] })}>
              <option value="">+ Додати вимір у рядки…</option>
              {free.map((d) => <option key={d} value={d}>{REPORT_DIMENSIONS[d]}</option>)}
            </Select>
          )}
        </div>
        <Field label="Колонки" className="mt-3">
          <Select
            value={cfg.col ?? ""}
            onChange={(e) => {
              const col = (e.target.value || undefined) as ReportDimension | undefined;
              const timeCol = col && ["month", "quarter", "year"].includes(col);
              onChange({ col, rows: cfg.rows.filter((d) => d !== col), ...(timeCol ? { prorate: true } : {}) });
            }}
          >
            <option value="">— без колонок —</option>
            {dimKeys.filter((d) => !cfg.rows.includes(d)).map((d) => <option key={d} value={d}>{REPORT_DIMENSIONS[d]}</option>)}
          </Select>
        </Field>
      </Card>

      <Card title="Показники">
        <div className="flex flex-wrap gap-1.5">
          {measureKeys.map((m) => {
            const on = cfg.measures.includes(m);
            return (
              <button
                key={m}
                onClick={() => {
                  const ms = on ? cfg.measures.filter((x) => x !== m) : [...cfg.measures, m];
                  if (ms.length) onChange({ measures: ms });
                }}
                className={clsx("rounded-md border px-2.5 py-1 text-xs font-medium transition", on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50")}
              >
                {REPORT_MEASURES[m]}
              </button>
            );
          })}
        </div>
        <div className="mt-2 text-xs text-slate-400">Перший показник визначає сортування і діаграму.</div>
      </Card>

      <div className="lg:col-span-3">
        <Card
          title={`Фільтри${activeFilters ? ` · ${activeFilters}` : ""}`}
          actions={activeFilters ? <Button variant="ghost" onClick={() => onChange({ filters: {} })}>Скинути</Button> : undefined}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <Sel label="Клієнт" value={f.client} items={lookups.clients} onChange={(v) => setFilter({ client: v, brand: undefined })} />
            <Sel label="Бренд" value={f.brand} items={brands} onChange={(v) => setFilter({ brand: v })} />
            <Sel label="Напрям" value={f.direction} items={lookups.directions} onChange={(v) => setFilter({ direction: v })} />
            <Field label="Медіа">
              <Select value={f.mediaType ?? ""} onChange={(e) => setFilter({ mediaType: e.target.value || undefined })}>
                <option value="">Усі</option>
                {MEDIA_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            </Field>
            <Sel label="Підрядник" value={f.contractor} items={lookups.contractors} onChange={(v) => setFilter({ contractor: v })} />
            <Sel label="Менеджер" value={f.manager} items={lookups.managers} onChange={(v) => setFilter({ manager: v })} />
            <Field label="Статус проєкту">
              <Select value={f.status ?? ""} onChange={(e) => setFilter({ status: e.target.value || undefined })}>
                <option value="">Усі</option>
                <option value="draft">Чернетка</option>
                <option value="active">Активний</option>
                <option value="closed">Закритий</option>
              </Select>
            </Field>
            <Field label="Закриття робіт">
              <Select value={f.closed ?? ""} onChange={(e) => setFilter({ closed: (e.target.value || undefined) as Filters["closed"] })}>
                <option value="">Усі</option>
                <option value="closed">Закриті</option>
                <option value="open">Не закриті</option>
              </Select>
            </Field>
            <Field label="Проєкт (код)">
              <Input value={f.project ?? ""} placeholder="усі" onChange={(e) => setFilter({ project: e.target.value.trim().toUpperCase() || undefined })} />
            </Field>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Sel({ label, value, items, onChange }: { label: string; value?: string; items: { id: string; name: string }[]; onChange: (v: string | undefined) => void }) {
  return (
    <Field label={label}>
      <Select value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">Усі</option>
        {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
      </Select>
    </Field>
  );
}
