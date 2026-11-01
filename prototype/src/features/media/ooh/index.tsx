import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import * as XLSX from "xlsx";
import { Building2, Download, Info, MapPin, MapPinned, Search, Wallet, Layers, Users } from "lucide-react";
import { Badge, Button, Card, Empty, Input, Select, Stat, clsx } from "../../../ui";
import { fmtDate, fmtMoney0 } from "../../../domain/calc";
import { useRefs } from "../../../shell/hooks";
import { CHART_SERIES, mediaOfWork } from "../util";
import type { ProjectView, ProjectViewProps } from "../types";
import { CITIES, STATUS_LABEL, surfacesOfWork, type City, type Surface, type SurfaceStatus } from "./surfaces";

const STATUS_COLOR: Record<SurfaceStatus, string> = { "on-air": "#16a34a", planned: "#f59e0b", finished: "#94a3b8" };
const STATUS_TONE: Record<SurfaceStatus, "green" | "amber" | "slate"> = { "on-air": "green", planned: "amber", finished: "slate" };

function pinIcon(color: string, status: SurfaceStatus, active: boolean): L.DivIcon {
  const size = active ? 30 : 22;
  const op = status === "finished" ? 0.5 : 1;
  const html =
    `<div style="position:relative;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #fff;` +
    `box-shadow:0 2px 6px rgba(30,10,60,.4)${active ? ",0 0 0 4px rgba(217,70,239,.45)" : ""};opacity:${op};box-sizing:border-box">` +
    `<span style="position:absolute;right:-4px;bottom:-4px;width:9px;height:9px;border-radius:50%;background:${STATUS_COLOR[status]};border:1.5px solid #fff"></span></div>`;
  return L.divIcon({ html, className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2] });
}

/** Підганяє карту під маркери й перераховує розмір при зміні контейнера (бічна панель чату). */
function MapController({ points, fitKey }: { points: [number, number][]; fitKey: string }) {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  useEffect(() => {
    map.invalidateSize();
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 15, animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey]);
  return null;
}

function Photo({ format, color }: { format: string; color: string }) {
  return (
    <div>
      <div className="grid h-20 place-items-center rounded-lg text-center text-xs font-bold text-white" style={{ background: `linear-gradient(135deg, ${color}, #7c3aed)` }}>
        {format}
      </div>
      <div className="mt-1 text-[10px] text-slate-400">фото площини — з кабінету оператора</div>
    </div>
  );
}

function OohMap({ project, works }: ProjectViewProps) {
  const refs = useRefs();
  const [city, setCity] = useState<City | "all">("all");
  const [fmt, setFmt] = useState("");
  const [q, setQ] = useState("");
  const [hover, setHover] = useState<string | null>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const markerRefs = useRef(new Map<string, L.Marker>());

  const surfaces = useMemo(() => {
    const oohWorks = works.filter((w) => mediaOfWork(w, refs) === "OOH");
    return oohWorks.flatMap((w) =>
      surfacesOfWork(w, {
        formatName: (x) => (x.formatId ? refs.formats.get(x.formatId)?.name : undefined) ?? refs.workTypes.get(x.workTypeId)?.name ?? "Білборд 6×3",
        carrierName: (x) => (x.carrierId ? refs.carriers.get(x.carrierId)?.name : undefined),
        operatorName: (x) => {
          const c = x.carrierId ? refs.carriers.get(x.carrierId) : undefined;
          const cid = x.contractorId ?? c?.contractorId;
          return (cid ? refs.contractors.get(cid)?.name : undefined) ?? c?.name ?? "Оператор";
        },
      }),
    );
  }, [works, refs]);

  const formats = useMemo(() => [...new Set(surfaces.map((s) => s.format))].sort(), [surfaces]);
  const colorOf = useCallback((f: string) => CHART_SERIES[Math.max(0, formats.indexOf(f)) % CHART_SERIES.length], [formats]);

  const cityCounts = useMemo(() => {
    const m = new Map<City, number>();
    for (const s of surfaces) m.set(s.city, (m.get(s.city) ?? 0) + 1);
    return m;
  }, [surfaces]);

  // За замовчуванням — місто з найбільшою кількістю площин (карта одразу «в місті», а не на всю країну).
  const topCity = useMemo(() => [...cityCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0], [cityCounts]);
  const [cityTouched, setCityTouched] = useState(false);
  useEffect(() => {
    if (!cityTouched && topCity && cityCounts.size > 1) setCity(topCity);
  }, [topCity, cityTouched, cityCounts.size]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return surfaces.filter((s) => (city === "all" || s.city === city) && (!fmt || s.format === fmt) && (!t || s.address.toLowerCase().includes(t) || s.code.toLowerCase().includes(t)));
  }, [surfaces, city, fmt, q]);

  const stats = useMemo(() => {
    const operators = new Set(surfaces.map((s) => s.operator));
    const budget = works.filter((w) => mediaOfWork(w, refs) === "OOH").reduce((a, w) => a + w.cost, 0);
    return { cities: cityCounts.size, operators: operators.size, budget, avg: surfaces.length ? surfaces.reduce((a, s) => a + s.pricePerMonth, 0) / surfaces.length : 0 };
  }, [surfaces, works, refs, cityCounts]);

  const points = useMemo(() => shown.map((s) => [s.lat, s.lng] as [number, number]), [shown]);
  const fitKey = `${city}|${fmt}|${q}|${surfaces.length}`;

  const focus = (s: Surface) => {
    if (!map) return;
    const m = markerRefs.current.get(s.id);
    map.flyTo([s.lat, s.lng], Math.max(map.getZoom(), 16), { duration: 0.8 });
    map.once("moveend", () => m?.openPopup());
  };

  const exportXlsx = () => {
    const rows = shown.map((s) => ({
      код: s.code,
      місто: s.city,
      адреса: s.address,
      формат: s.format,
      сторона: s.side,
      підсвітка: s.lit ? "так" : "ні",
      період: `${fmtDate(s.periodStart)} – ${fmtDate(s.periodEnd)}`,
      оператор: s.operator,
      "ціна/міс": s.pricePerMonth,
      lat: s.lat,
      lng: s.lng,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Адресна програма");
    XLSX.writeFile(wb, `Адресна програма ${project.code}.xlsx`);
  };

  if (!surfaces.length) return <Empty>У медіаплані немає робіт OOH</Empty>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Площин" value={surfaces.length} icon={MapPin} gradient="fuchsia" />
        <Stat label="Міст" value={stats.cities} icon={Building2} gradient="violet" />
        <Stat label="Операторів" value={stats.operators} icon={Users} gradient="cyan" />
        <Stat label="Бюджет OOH" value={fmtMoney0(stats.budget)} icon={Wallet} gradient="orange" />
        <Stat label="Середня вартість площини/міс" value={fmtMoney0(stats.avg)} icon={Layers} gradient="teal" />
      </div>

      <Card
        title={
          <span className="flex items-center gap-2">
            <MapPinned size={16} /> Карта площин <Badge tone="indigo">демо-адреси</Badge>
          </span>
        }
        actions={
          <Button variant="primary" onClick={exportXlsx}>
            <Download size={15} /> Вивантажити адресну програму (Excel)
          </Button>
        }
      >
        <div className="mb-3 flex flex-wrap gap-1.5">
          {([["all", "Усі", surfaces.length], ...CITIES.filter((c) => cityCounts.has(c)).map((c) => [c, c, cityCounts.get(c) ?? 0] as const)] as [City | "all", string, number][]).map(([k, label, n]) => (
            <button
              key={k}
              onClick={() => { setCityTouched(true); setCity(k); }}
              className={clsx("rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset transition", city === k ? "bg-juicy text-white ring-transparent shadow-md shadow-fuchsia-500/30" : "bg-white text-slate-600 ring-violet-200 hover:bg-violet-50")}
            >
              {label} <span className="opacity-70">{n}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="relative min-w-0">
            <MapContainer ref={setMap} center={[49.0, 31.0]} zoom={6} scrollWheelZoom style={{ height: 520 }} className="z-0 w-full rounded-2xl ring-1 ring-violet-100">
              <TileLayer className="aura-tiles" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} attribution="&copy; &lt;a href=&quot;https://www.openstreetmap.org/copyright&quot;&gt;OpenStreetMap&lt;/a&gt; contributors" />
              <MapController points={points} fitKey={fitKey} />
              {shown.map((s) => (
                <Marker
                  key={s.id}
                  position={[s.lat, s.lng]}
                  icon={pinIcon(colorOf(s.format), s.status, hover === s.id)}
                  zIndexOffset={hover === s.id ? 1000 : 0}
                  ref={(m) => {
                    if (m) markerRefs.current.set(s.id, m);
                    else markerRefs.current.delete(s.id);
                  }}
                  eventHandlers={{ mouseover: () => setHover(s.id), mouseout: () => setHover((h) => (h === s.id ? null : h)) }}
                >
                  <Popup minWidth={230}>
                    <div className="space-y-1.5 text-xs text-slate-700">
                      <Photo format={s.format} color={colorOf(s.format)} />
                      <div className="text-sm font-bold text-slate-900">{s.code}</div>
                      <div>{s.address}, {s.city}</div>
                      <div>{s.format} · сторона {s.side} · {s.lit ? "підсвітка" : "без підсвітки"}</div>
                      <div>{fmtDate(s.periodStart)} – {fmtDate(s.periodEnd)} · {STATUS_LABEL[s.status]}</div>
                      <div>Оператор: {s.operator}</div>
                      <div className="font-bold">{fmtMoney0(s.pricePerMonth)} грн/міс</div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
            {formats.length >= 2 && (
              <div className="pointer-events-none absolute bottom-3 left-3 z-[500] max-w-[70%] space-y-1 rounded-xl bg-white/90 px-3 py-2 text-[11px] shadow-md ring-1 ring-violet-100">
                {formats.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-slate-700">
                    <span className="h-3 w-3 rounded-full border-2 border-white shadow ring-1 ring-slate-200" style={{ background: colorOf(f) }} />
                    {f}
                  </div>
                ))}
                <div className="border-t border-slate-200 pt-1 text-slate-500">
                  {(Object.keys(STATUS_LABEL) as SurfaceStatus[]).map((k) => (
                    <span key={k} className="mr-2 inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[k] }} />
                      {STATUS_LABEL[k]}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col" style={{ maxHeight: 520 }}>
            <div className="mb-2 space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input className="pl-8" placeholder="Адреса або код" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <Select value={fmt} onChange={(e) => setFmt(e.target.value)}>
                <option value="">Усі формати</option>
                {formats.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </Select>
              <div className="text-xs text-slate-500">Показано {shown.length} з {surfaces.length}</div>
            </div>
            <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
              {shown.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => focus(s)}
                    onMouseEnter={() => setHover(s.id)}
                    onMouseLeave={() => setHover((h) => (h === s.id ? null : h))}
                    className={clsx("w-full rounded-xl border px-3 py-2 text-left transition", hover === s.id ? "border-fuchsia-300 bg-fuchsia-50" : "border-violet-100 bg-white hover:bg-violet-50")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(s.format) }} />
                        {s.code}
                      </span>
                      <Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-slate-600">{s.address}, {s.city}</div>
                    <div className="truncate text-[11px] text-slate-400">
                      {s.format} · {s.side} · {fmtMoney0(s.pricePerMonth)} грн/міс
                    </div>
                  </button>
                </li>
              ))}
              {!shown.length && <li className="py-6 text-center text-xs text-slate-400">Нічого не знайдено</li>}
            </ul>
          </div>
        </div>

        <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-400">
          <Info size={13} className="mt-px shrink-0" />
          Адреси й координати — демо; у робочій системі — з адресної програми оператора (імпорт або API).
        </p>
      </Card>
    </div>
  );
}

export const oohMapView: ProjectView = {
  id: "map",
  title: "Карта площин",
  icon: MapPinned,
  badge: "OOH",
  applies: (works, mediaOf) => works.some((w) => mediaOf(w) === "OOH"),
  Component: OohMap,
};
