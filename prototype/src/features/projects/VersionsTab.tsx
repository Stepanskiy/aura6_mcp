import { useMemo, useState } from "react";
import { useStore } from "../../store";
import { diffWorks, fmtDate, fmtMoney, latestVersion, snapshotOf } from "../../domain/calc";
import type { Project, Work, WorkSnapshot } from "../../domain/types";
import { Badge, Button, Card, Empty, Field, Money, Select, Table, clsx } from "../../ui";
import { useRefs } from "../../shell/hooks";

const CURRENT = "current";

const sum = (w: WorkSnapshot[], k: "income" | "cost") => w.reduce((s, x) => s + x[k], 0);

export function VersionsTab({ project, works }: { project: Project; works: Work[] }) {
  const s = useStore();
  const refs = useRefs();
  const versions = useMemo(() => s.versions.filter((v) => v.projectId === project.id).sort((a, b) => b.number - a.number), [s.versions, project.id]);
  const latest = latestVersion(s.versions, project.id);
  const [baseId, setBaseId] = useState<string>("");
  const [targetId, setTargetId] = useState<string>(CURRENT);

  const base = versions.find((v) => v.id === (baseId || latest?.id));
  const target = targetId === CURRENT ? undefined : versions.find((v) => v.id === targetId);
  const current = useMemo(() => works.map(snapshotOf), [works]);
  const targetWorks = target ? target.works : current;
  const diff = useMemo(() => (base ? diffWorks(base.works, targetWorks).filter((d) => d.kind !== "same") : []), [base, targetWorks]);
  const unchanged = base ? diffWorks(base.works, targetWorks).length - diff.length : 0;

  function fix() {
    const name = window.prompt("Назва версії плану (можна залишити порожньою)", "");
    if (name === null) return;
    s.fixPlanVersion(project.id, name.trim() || undefined);
  }

  const label = (w: WorkSnapshot) =>
    [refs.workTypes.get(w.workTypeId)?.name, w.carrierId && refs.carriers.get(w.carrierId)?.name, w.description].filter(Boolean).join(" · ");

  const rowCls = { added: "bg-emerald-50", removed: "bg-red-50", changed: "bg-amber-50", same: "" } as const;
  const kindLabel = { added: "додано", removed: "видалено", changed: "змінено", same: "" } as const;
  const kindTone = { added: "green", removed: "red", changed: "amber", same: "slate" } as const;

  const bi = base ? sum(base.works, "income") : 0, bc = base ? sum(base.works, "cost") : 0;
  const ti = sum(targetWorks, "income"), tc = sum(targetWorks, "cost");

  return (
    <div className="space-y-4">
      <Card title="Версії плану" actions={<Button variant="primary" onClick={fix}>Зафіксувати як план</Button>}>
        {versions.length === 0 ? (
          <Empty>Версій ще немає. Зафіксуйте поточний медіаплан як план.</Empty>
        ) : (
          <Table>
            <thead>
              <tr><th>№</th><th>Назва</th><th>Дата</th><th>Тип</th><th>Причина</th><th className="text-right">Дохід</th><th className="text-right">Затрата</th></tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id}>
                  <td className="font-medium">{v.number}</td>
                  <td>{v.name}</td>
                  <td className="whitespace-nowrap text-slate-500">{fmtDate(v.createdAt)}</td>
                  <td>{v.auto ? <Badge tone="amber">авто</Badge> : <Badge tone="indigo">вручну</Badge>}</td>
                  <td className="text-slate-600">{v.reason}</td>
                  <td className="text-right"><Money value={sum(v.works, "income")} /></td>
                  <td className="text-right"><Money value={sum(v.works, "cost")} /></td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {base && (
        <Card title="Порівняння">
          <div className="mb-4 grid max-w-2xl grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="База (план)">
              <Select value={base.id} onChange={(e) => setBaseId(e.target.value)}>
                {versions.map((v) => <option key={v.id} value={v.id}>v{v.number} · {v.name}</option>)}
              </Select>
            </Field>
            <Field label="З чим порівняти">
              <Select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                <option value={CURRENT}>Поточний медіаплан</option>
                {versions.filter((v) => v.id !== base.id).map((v) => <option key={v.id} value={v.id}>v{v.number} · {v.name}</option>)}
              </Select>
            </Field>
          </div>

          <div className="mb-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <div className="rounded-lg bg-slate-50 px-3 py-2">Дохід: <b className="tabular-nums">{fmtMoney(bi)}</b> → <b className="tabular-nums">{fmtMoney(ti)}</b> (<Money value={ti - bi} />)</div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">Затрата: <b className="tabular-nums">{fmtMoney(bc)}</b> → <b className="tabular-nums">{fmtMoney(tc)}</b> (<Money value={tc - bc} />)</div>
          </div>

          {diff.length === 0 ? (
            <Empty>Відмінностей немає{unchanged ? ` (${unchanged} незмінних рядків)` : ""}</Empty>
          ) : (
            <Table>
              <thead>
                <tr><th>Зміна</th><th>Робота</th><th className="text-right">Дохід було</th><th className="text-right">Дохід стало</th><th className="text-right">Δ дохід</th><th className="text-right">Затрата було</th><th className="text-right">Затрата стало</th><th className="text-right">Δ затрата</th></tr>
              </thead>
              <tbody>
                {diff.map((d) => (
                  <tr key={d.workId} className={clsx(rowCls[d.kind])}>
                    <td><Badge tone={kindTone[d.kind]}>{kindLabel[d.kind]}</Badge></td>
                    <td>{label((d.current ?? d.base)!)}</td>
                    <td className="text-right">{d.base ? <Money value={d.base.income} /> : ""}</td>
                    <td className="text-right">{d.current ? <Money value={d.current.income} /> : ""}</td>
                    <td className="text-right font-medium"><Money value={d.dIncome} /></td>
                    <td className="text-right">{d.base ? <Money value={d.base.cost} /> : ""}</td>
                    <td className="text-right">{d.current ? <Money value={d.current.cost} /> : ""}</td>
                    <td className="text-right font-medium"><Money value={d.dCost} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-semibold">
                  <td colSpan={4}>Разом змін: {diff.length}{unchanged ? `, без змін: ${unchanged}` : ""}</td>
                  <td className="text-right"><Money value={ti - bi} /></td>
                  <td colSpan={2} />
                  <td className="text-right"><Money value={tc - bc} /></td>
                </tr>
              </tfoot>
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}
