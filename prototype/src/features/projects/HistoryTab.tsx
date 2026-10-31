import { useMemo } from "react";
import { useStore } from "../../store";
import { fmtMoney } from "../../domain/calc";
import type { ChangeAction, ChangeEntry, Project } from "../../domain/types";
import { Card, Empty } from "../../ui";
import { useRefs } from "../../shell/hooks";
import { STATUS_LABEL, SourceBadge, period } from "./common";

const ACTION_LABEL: Record<ChangeAction, string> = {
  create: "Додано роботу",
  update: "Змінено",
  delete: "Видалено роботу",
  close: "Закрито роботу",
  reopen: "Відкрито роботу",
  version: "Версія плану",
  "project-create": "Створено проєкт",
  "project-update": "Змінено проєкт",
};

const FIELD_LABEL: Record<string, string> = {
  workTypeId: "Вид робіт", carrierId: "Носій", formatId: "Формат", contractorId: "Підрядник",
  periodStart: "Початок періоду", periodEnd: "Кінець періоду", description: "Опис", income: "Дохід", cost: "Затрата",
  name: "Назва", status: "Статус", year: "Рік", startDate: "Початок", endDate: "Завершення",
  clientId: "Клієнт", brandId: "Бренд", directionId: "Напрям", managerId: "Менеджер", code: "Код",
};

export function HistoryTab({ project }: { project: Project }) {
  const history = useStore((s) => s.history);
  const works = useStore((s) => s.works);
  const refs = useRefs();

  const groups = useMemo(() => {
    const mine = history.filter((h) => h.projectId === project.id);
    const map = new Map<string, ChangeEntry[]>();
    for (const h of mine) {
      const key = h.batchId ?? `${h.at}|${h.source}|${h.action}|${h.user}`;
      const a = map.get(key);
      if (a) a.push(h);
      else map.set(key, [h]);
    }
    return [...map.entries()].map(([key, items]) => ({ key, items, at: items[0].at })).sort((a, b) => b.at.localeCompare(a.at));
  }, [history, project.id]);

  const refMap: Record<string, Map<string, { name: string }>> = {
    workTypeId: refs.workTypes, carrierId: refs.carriers, formatId: refs.formats, contractorId: refs.contractors,
    clientId: refs.clients, brandId: refs.brands, directionId: refs.directions, managerId: refs.managers,
  };

  function val(field: string | undefined, v: unknown): string {
    if (v === undefined || v === null || v === "") return "—";
    if (field === "income" || field === "cost") return fmtMoney(Number(v));
    if (field && refMap[field]) return refMap[field].get(String(v))?.name ?? String(v);
    if (field === "status") return STATUS_LABEL[v as keyof typeof STATUS_LABEL] ?? String(v);
    if (typeof v === "object") return snapshotText(v as Record<string, unknown>);
    return String(v);
  }

  function snapshotText(o: Record<string, unknown>): string {
    const parts = [
      refs.workTypes.get(String(o.workTypeId))?.name,
      o.carrierId ? refs.carriers.get(String(o.carrierId))?.name : undefined,
      o.description ? String(o.description) : undefined,
      period(String(o.periodStart ?? ""), String(o.periodEnd ?? "")),
      typeof o.income === "number" ? `дохід ${fmtMoney(o.income)}` : undefined,
      typeof o.cost === "number" ? `затрата ${fmtMoney(o.cost)}` : undefined,
    ];
    return parts.filter(Boolean).join(" · ");
  }

  function workLabel(h: ChangeEntry): string {
    if (!h.workId) return "";
    const w = works.find((x) => x.id === h.workId);
    if (w) return [refs.workTypes.get(w.workTypeId)?.name, w.carrierId && refs.carriers.get(w.carrierId)?.name, w.description].filter(Boolean).join(" · ");
    const snap = (h.before ?? h.after) as Record<string, unknown> | undefined;
    return snap && typeof snap === "object" ? refs.workTypes.get(String(snap.workTypeId))?.name ?? "" : "";
  }

  function detail(h: ChangeEntry) {
    if (h.action === "update" || h.action === "project-update")
      return <><b>{FIELD_LABEL[h.field ?? ""] ?? h.field}</b>: <span className="text-slate-500 line-through">{val(h.field, h.before)}</span> → <b>{val(h.field, h.after)}</b></>;
    if (h.action === "create") return <span className="text-slate-600">{val(undefined, h.after)}</span>;
    if (h.action === "delete") return <span className="text-slate-600">{val(undefined, h.before)}</span>;
    if (h.action === "version") return <span>{String(h.after ?? "")}{h.field ? <span className="text-slate-500"> — {h.field}</span> : null}</span>;
    if (h.action === "project-create") return <span>{String(h.after ?? "")}</span>;
    return null;
  }

  if (!groups.length) return <Empty>Історія змін порожня</Empty>;

  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const first = g.items[0];
        return (
          <Card key={g.key}>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{new Date(first.at).toLocaleString("uk-UA")}</span>
              <span className="text-slate-500">{first.user}</span>
              <SourceBadge source={first.source} />
              <span className="text-xs text-slate-400">{g.items.length} {g.items.length === 1 ? "запис" : "записів"}</span>
            </div>
            <ul className="space-y-1 text-sm">
              {g.items.map((h) => (
                <li key={h.id} className="flex flex-wrap gap-x-2">
                  <span className="w-36 shrink-0 text-slate-500">{ACTION_LABEL[h.action]}</span>
                  <span className="min-w-0 flex-1">
                    {workLabel(h) && h.action !== "create" && h.action !== "delete" && <span className="mr-2 text-slate-600">[{workLabel(h)}]</span>}
                    {detail(h)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
