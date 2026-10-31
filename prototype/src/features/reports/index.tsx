// «Конструктор звітів»: зведена таблиця по роботах за період. Стан синхронізується з URL.
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useStore } from "../../store";
import { useInvoiced, useRefs } from "../../shell/hooks";
import { Button, Card, Page, Stat } from "../../ui";
import { fmtMoney0, fmtPct, margin } from "../../domain/calc";
import { REPORT_DIMENSIONS } from "../../shell/routes";
import { parseConfig, serializeConfig, type Lookups } from "./config";
import { buildPlanIncome, runReport, type EngineCtx, type Node, type ReportConfig } from "./engine";
import { Controls, PresetBar } from "./Controls";
import { PivotTable } from "./PivotTable";
import { ReportChart } from "./ReportChart";
import { DrillModal } from "./DrillModal";
import { exportReport } from "./exportXlsx";

export function ReportsApp() {
  const [sp, setSp] = useSearchParams();
  const works = useStore((s) => s.works);
  const versions = useStore((s) => s.versions);
  const projectsList = useStore((s) => s.projects);
  const refs = useRefs();
  const invoiced = useInvoiced();

  const lookups = useMemo<Lookups>(
    () => ({
      clients: [...refs.clients.values()],
      brands: [...refs.brands.values()],
      directions: [...refs.directions.values()],
      contractors: [...refs.contractors.values()],
      managers: [...refs.managers.values()],
    }),
    [refs],
  );

  const [cfg, setCfg] = useState<ReportConfig>(() => parseConfig(sp, lookups));
  const [showChart, setShowChart] = useState(true);
  const [showSettings, setShowSettings] = useState(true);
  const [drill, setDrill] = useState<Node | null>(null);

  // URL <-> стан. lastWritten запобігає зациклюванню.
  const lastWritten = useRef(sp.toString());
  useEffect(() => {
    const s = sp.toString();
    if (s !== lastWritten.current) {
      lastWritten.current = s;
      setCfg(parseConfig(sp, lookups));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);
  useEffect(() => {
    const s = serializeConfig(cfg).toString();
    if (s !== lastWritten.current) {
      lastWritten.current = s;
      setSp(new URLSearchParams(s), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg]);

  const plan = useMemo(() => buildPlanIncome(versions, projectsList.map((p) => p.id)), [versions, projectsList]);
  const ctx = useMemo<EngineCtx>(
    () => ({ works, plan, invoiced, projects: refs.projects, clients: refs.clients, brands: refs.brands, contractors: refs.contractors, carriers: refs.carriers, formats: refs.formats, directions: refs.directions, workTypes: refs.workTypes, managers: refs.managers }),
    [works, plan, invoiced, refs],
  );
  const report = useMemo(() => runReport(ctx, cfg), [ctx, cfg]);

  const patch = (p: Partial<ReportConfig>) => setCfg((c) => ({ ...c, ...p, preset: undefined }));
  const t = report.root.acc;
  const m = margin(t.income, t.cost);
  const drillTitle = drill ? (drill.id === "root" ? "Всього" : drill.label) : "";

  return (
    <Page
      title="Конструктор звітів"
      subtitle="Зведена таблиця по роботах за період: оберіть групування, показники і фільтри. Посилання на звіт можна надіслати колезі."
      actions={
        <>
          <Button onClick={() => setShowSettings((v) => !v)}>{showSettings ? "Сховати налаштування" : "Налаштування"}</Button>
          <Button onClick={() => setShowChart((v) => !v)}>{showChart ? "Сховати діаграму" : "Діаграма"}</Button>
          <Button onClick={() => navigator.clipboard?.writeText(window.location.href)}>Копіювати посилання</Button>
          <Button variant="primary" onClick={() => exportReport(report, cfg)}>Експорт в Excel</Button>
        </>
      }
    >
      <div className="space-y-4">
        <PresetBar cfg={cfg} onPreset={setCfg} />
        {showSettings && <Controls cfg={cfg} lookups={lookups} onChange={patch} />}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Робіт" value={report.worksCount} />
          <Stat label="Дохід" value={fmtMoney0(t.income)} />
          <Stat label="Затрата" value={fmtMoney0(t.cost)} />
          <Stat label="Маржа" value={fmtMoney0(m.value)} sub={fmtPct(m.pct)} />
        </div>

        {showChart && (
          <Card title="Діаграма">
            <ReportChart report={report} />
          </Card>
        )}

        <Card title={cfg.rows.map((d) => REPORT_DIMENSIONS[d]).join(" → ") + (cfg.col ? ` × ${REPORT_DIMENSIONS[cfg.col]}` : "") || "Підсумок"}>
          <PivotTable report={report} onDrill={setDrill} />
        </Card>
      </div>
      <DrillModal node={drill} title={drillTitle} projects={refs.projects} carriers={refs.carriers} onClose={() => setDrill(null)} />
    </Page>
  );
}
