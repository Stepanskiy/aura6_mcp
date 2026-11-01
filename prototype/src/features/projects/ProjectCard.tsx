import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useStore } from "../../store";
import { fmtMoney0, fmtPct, totals } from "../../domain/calc";
import type { ProjectStatus } from "../../domain/types";
import { Alert, Button, Empty, Page, Select, Stat, clsx } from "../../ui";
import { useInvoiced, useRefs } from "../../shell/hooks";
import { launchUrl } from "../../shell/routes";
import { StatusBadge, period } from "./common";
import { WorksTab } from "./WorksTab";
import { VersionsTab } from "./VersionsTab";
import { HistoryTab } from "./HistoryTab";
import { PROJECT_VIEWS } from "../media/registry";
import { mediaOfWork } from "../media/util";

const BASE_TABS = [
  { id: "works", label: "Медіаплан" },
  { id: "versions", label: "Версії плану" },
  { id: "history", label: "Історія змін" },
] as const;

export function ProjectCard() {
  const { code } = useParams();
  const s = useStore();
  const refs = useRefs();
  const invoiced = useInvoiced();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [error, setError] = useState<string>();

  const project = s.projects.find((p) => p.code === code);
  const works = useMemo(() => s.works.filter((w) => w.projectId === project?.id), [s.works, project?.id]);
  const t = useMemo(() => totals(works, invoiced), [works, invoiced]);

  if (!project) {
    return (
      <Page title="Проєкт не знайдено">
        <Empty>
          Проєкту з кодом «{code}» немає. <Link className="text-indigo-600 hover:underline" to="/projects">До списку проєктів</Link>
        </Empty>
      </Page>
    );
  }

  // Медійні вкладки (карта, календар, ефективність…) — лише ті, що застосовні до медіаплану проєкту.
  const mediaViews = PROJECT_VIEWS.filter((v) => v.applies(works, (w) => mediaOfWork(w, refs)));
  const TABS: { id: string; label: string; view?: (typeof PROJECT_VIEWS)[number] }[] = [
    BASE_TABS[0],
    ...mediaViews.map((v) => ({ id: v.id, label: v.title, view: v })),
    BASE_TABS[1],
    BASE_TABS[2],
  ];
  const tab = TABS.find((x) => x.id === sp.get("tab"))?.id ?? "works";
  const activeView = mediaViews.find((v) => v.id === tab);
  const client = refs.clients.get(project.clientId);
  const brand = project.brandId ? refs.brands.get(project.brandId)?.name : undefined;
  const direction = project.directionId ? refs.directions.get(project.directionId)?.name : undefined;
  const manager = project.managerId ? refs.managers.get(project.managerId)?.name : undefined;
  const meta = [client?.name, brand, direction, manager, period(project.startDate, project.endDate) || String(project.year)].filter(Boolean).join(" · ");

  function remove() {
    if (!project || !window.confirm(`Видалити проєкт ${project.code} разом з медіапланом?`)) return;
    const r = s.deleteProject(project.id);
    if (r.ok) nav("/projects");
    else setError(r.error);
  }

  return (
    <Page
      title={
        <span className="flex items-center gap-3">
          <span className="text-indigo-600">{project.code}</span> {project.name}
        </span>
      }
      subtitle={<div className="flex flex-wrap items-center gap-2"><StatusBadge status={project.status} /> {meta}</div>}
      actions={
        <>
          <Select className="!w-auto" value={project.status} onChange={(e) => s.updateProject(project.id, { status: e.target.value as ProjectStatus })}>
            <option value="draft">Чернетка</option>
            <option value="active">Активний</option>
            <option value="closed">Закритий</option>
          </Select>
          <Button onClick={() => nav(launchUrl("/import", { mode: "budget" }))}>Імпортувати бюджет</Button>
          <Button onClick={() => nav(launchUrl("/import", { mode: "final" }))}>Фінальні суми</Button>
          <Button variant="primary" onClick={() => nav(launchUrl("/invoices/new", { client: client?.name, project: project.code }))}>Виставити рахунок</Button>
          <Button onClick={() => nav(launchUrl("/projects/new", { copyFrom: project.code }))}>Копіювати</Button>
          <Button onClick={() => nav(launchUrl("/reports", { rows: "carrier,month", project: project.code }))}>Звіт</Button>
          <Button variant="danger" onClick={remove}>Видалити</Button>
        </>
      }
    >
      {error && <div className="mb-3"><Alert tone="red">{error}</Alert></div>}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Дохід, грн" value={fmtMoney0(t.income)} />
        <Stat label="Затрата, грн" value={fmtMoney0(t.cost)} />
        <Stat label="Маржа, грн" value={fmtMoney0(t.margin)} sub={fmtPct(t.marginPct)} />
        <Stat label="Виставлено, грн" value={fmtMoney0(t.invoiced)} />
        <Stat label="Не виставлено, грн" value={fmtMoney0(t.uninvoiced)} />
        <Stat label="Закрито (дохід), грн" value={fmtMoney0(t.closedIncome)} sub={fmtPct(t.income ? t.closedIncome / t.income : undefined)} />
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((x) => (
          <button
            key={x.id}
            onClick={() => setSp({ tab: x.id }, { replace: true })}
            className={clsx(
              "-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition",
              tab === x.id ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {x.view && <x.view.icon size={15} />}
            {x.label}
            {x.view?.badge && <span className="rounded-full bg-gradient-to-r from-lime-300 to-cyan-300 px-1.5 py-px text-[10px] font-extrabold text-[#160b2e]">{x.view.badge}</span>}
          </button>
        ))}
      </div>

      {tab === "works" && <WorksTab project={project} works={works} />}
      {tab === "versions" && <VersionsTab project={project} works={works} />}
      {tab === "history" && <HistoryTab project={project} />}
      {activeView && <activeView.Component project={project} works={works} />}
    </Page>
  );
}
