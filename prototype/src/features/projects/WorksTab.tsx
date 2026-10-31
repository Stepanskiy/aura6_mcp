import { Fragment, useMemo, useState } from "react";
import { useStore, type ApplyResult, type WorkChange, type WorkPatch } from "../../store";
import { fmtDate, newId, round2, totals } from "../../domain/calc";
import type { Project, Work } from "../../domain/types";
import { Alert, Badge, Button, Empty, Input, Money, Select, Table, clsx } from "../../ui";
import { useInvoiced, useRefs } from "../../shell/hooks";
import { period } from "./common";

type Draft = Omit<Work, "projectId"> & { isNew?: boolean };
const EDIT_FIELDS = ["workTypeId", "carrierId", "formatId", "contractorId", "periodStart", "periodEnd", "description", "income", "cost"] as const;

export function WorksTab({ project, works }: { project: Project; works: Work[] }) {
  const s = useStore();
  const refs = useRefs();
  const invoiced = useInvoiced();
  const [draft, setDraft] = useState<Draft[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ApplyResult>();
  const [localErrors, setLocalErrors] = useState<string[]>([]);

  const editing = draft !== null;
  const name = (m: Map<string, { name: string }>, id?: string) => (id ? m.get(id)?.name ?? "" : "");

  function startEdit() {
    setResult(undefined);
    setLocalErrors([]);
    setDraft(works.map(({ projectId: _p, ...w }) => ({ ...w })));
  }

  function patchRow(id: string, patch: Partial<Draft>) {
    setDraft((d) => d && d.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function changeCarrier(id: string, carrierId: string) {
    const c = s.carriers.find((x) => x.id === carrierId);
    const row = draft?.find((r) => r.id === id);
    patchRow(id, { carrierId: carrierId || undefined, contractorId: row?.contractorId || c?.contractorId });
  }

  function addRow() {
    const d = project.startDate ?? `${project.year}-01-01`;
    setDraft((rows) => [
      ...(rows ?? []),
      { id: newId("w"), workTypeId: s.workTypes[0]?.id ?? "", periodStart: d, periodEnd: project.endDate ?? d, income: 0, cost: 0, closed: false, isNew: true },
    ]);
  }

  function save() {
    if (!draft) return;
    const errs: string[] = [];
    const changes: WorkChange[] = [];
    const orig = new Map(works.map((w) => [w.id, w]));
    for (const r of draft) {
      const label = `${name(refs.workTypes, r.workTypeId) || "Рядок"} ${r.description ?? ""}`.trim();
      if (!r.workTypeId) errs.push(`${label}: оберіть вид робіт`);
      if (r.periodEnd < r.periodStart) errs.push(`${label}: кінець періоду раніше за початок`);
      if (r.income < 0 || r.cost < 0) errs.push(`${label}: суми не можуть бути від’ємними`);
      const o = orig.get(r.id);
      if (!o) {
        const { isNew: _n, ...w } = r;
        changes.push({ op: "add", work: { ...w, projectId: project.id } });
      } else {
        const patch: Record<string, unknown> = {};
        for (const f of EDIT_FIELDS) {
          if (o.closed && (f === "income" || f === "cost")) continue;
          if ((o[f] ?? "") !== (r[f] ?? "")) patch[f] = r[f] === "" ? undefined : r[f];
        }
        if (Object.keys(patch).length) changes.push({ op: "update", id: r.id, patch: patch as WorkPatch });
      }
    }
    const kept = new Set(draft.map((r) => r.id));
    for (const w of works) if (!kept.has(w.id)) changes.push({ op: "delete", id: w.id });
    setLocalErrors(errs);
    if (errs.length) return;
    if (!changes.length) {
      setDraft(null);
      return;
    }
    const res = s.applyWorkChanges(project.id, changes, "manual");
    setResult(res);
    setDraft(null);
    setSelected(new Set());
  }

  function setClosed(closed: boolean) {
    s.setWorkClosed([...selected], closed);
    setSelected(new Set());
  }

  const rows: (Work | Draft)[] = editing ? draft : works;
  const groups = useMemo(() => {
    const out: { key: string; label: string; items: (Work | Draft)[] }[] = [];
    if (editing) return [{ key: "", label: "", items: rows }];
    for (const w of rows) {
      const key = w.workTypeId;
      let g = out.find((x) => x.key === key);
      if (!g) out.push((g = { key, label: name(refs.workTypes, key), items: [] }));
      g.items.push(w);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, editing, refs]);

  const sel = (m: Map<string, { name: string }>, id: string | undefined, onChange: (v: string) => void, list: { id: string; name: string }[], empty = "—") => (
    <Select className="min-w-28 !px-1.5 !py-1" value={id ?? ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">{empty}</option>
      {list.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
    </Select>
  );

  return (
    <div className="space-y-3">
      {result && (
        <div className="space-y-2">
          {result.errors.length > 0 && <Alert tone="red">{result.errors.map((e) => <div key={e}>{e}</div>)}</Alert>}
          {result.autoVersion && <Alert tone="green">Створено версію плану {result.autoVersion.number}: {result.autoVersion.reason}</Alert>}
          <Alert tone="sky">Збережено: додано {result.added.length}, змінено {result.updated.length}, видалено {result.deleted.length}.</Alert>
        </div>
      )}
      {localErrors.length > 0 && <Alert tone="red">{localErrors.map((e) => <div key={e}>{e}</div>)}</Alert>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button variant="primary" onClick={save}>Зберегти</Button>
              <Button onClick={() => { setDraft(null); setLocalErrors([]); }}>Скасувати</Button>
              <Button variant="ghost" onClick={addRow}>＋ Додати рядок</Button>
            </>
          ) : (
            <>
              <Button onClick={startEdit}>Редагувати</Button>
              <Button disabled={!selected.size} onClick={() => setClosed(true)}>Закрити роботи{selected.size ? ` (${selected.size})` : ""}</Button>
              <Button disabled={!selected.size} onClick={() => setClosed(false)}>Відкрити</Button>
            </>
          )}
        </div>
        <div className="text-xs text-slate-500">Закриття роботи = підтвердження, що сума фінальна; суми закритих робіт не редагуються.</div>
      </div>

      {rows.length === 0 ? (
        <Empty>Медіаплан порожній. Імпортуйте бюджет або додайте рядки вручну.</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              {!editing && <th className="w-8"><input type="checkbox" checked={selected.size === works.length && works.length > 0} onChange={(e) => setSelected(e.target.checked ? new Set(works.map((w) => w.id)) : new Set())} /></th>}
              <th>Вид робіт</th><th>Носій</th><th>Формат</th><th>Підрядник</th><th>Період</th><th>Опис</th>
              <th className="text-right">Дохід</th><th className="text-right">Затрата</th><th className="text-right">Маржа</th>
              {!editing && <th className="text-right">Виставлено</th>}
              <th>{editing ? "" : "Статус"}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const sub = totals(g.items as Work[], invoiced);
              return (
                <Fragment key={g.key || "all"}>
                  {g.items.map((w) => {
                    const dr = w as Draft;
                    const orig = works.find((x) => x.id === w.id);
                    const lock = !!orig?.closed;
                    return (
                      <tr key={w.id} className={clsx(lock && editing && "bg-slate-50/70", dr.isNew && "bg-emerald-50/40")}>
                        {!editing && (
                          <td>
                            <input type="checkbox" checked={selected.has(w.id)} onChange={(e) => setSelected((o) => { const n = new Set(o); if (e.target.checked) n.add(w.id); else n.delete(w.id); return n; })} />
                          </td>
                        )}
                        {editing ? (
                          <>
                            <td>{sel(refs.workTypes, w.workTypeId, (v) => patchRow(w.id, { workTypeId: v }), s.workTypes, "обрати")}</td>
                            <td>{sel(refs.carriers, w.carrierId, (v) => changeCarrier(w.id, v), s.carriers)}</td>
                            <td>{sel(refs.formats, w.formatId, (v) => patchRow(w.id, { formatId: v || undefined }), s.formats)}</td>
                            <td>{sel(refs.contractors, w.contractorId, (v) => patchRow(w.id, { contractorId: v || undefined }), s.contractors)}</td>
                            <td className="whitespace-nowrap">
                              <div className="flex gap-1">
                                <Input type="date" className="!w-32 !px-1.5 !py-1" value={w.periodStart} onChange={(e) => patchRow(w.id, { periodStart: e.target.value })} />
                                <Input type="date" className="!w-32 !px-1.5 !py-1" value={w.periodEnd} onChange={(e) => patchRow(w.id, { periodEnd: e.target.value })} />
                              </div>
                            </td>
                            <td><Input className="min-w-40 !px-1.5 !py-1" value={w.description ?? ""} onChange={(e) => patchRow(w.id, { description: e.target.value })} /></td>
                            <td><Input type="number" step="0.01" disabled={lock} title={lock ? "Робота закрита: сума фінальна" : undefined} className="!w-32 !px-1.5 !py-1 text-right" value={w.income} onChange={(e) => patchRow(w.id, { income: Number(e.target.value) })} /></td>
                            <td><Input type="number" step="0.01" disabled={lock} title={lock ? "Робота закрита: сума фінальна" : undefined} className="!w-32 !px-1.5 !py-1 text-right" value={w.cost} onChange={(e) => patchRow(w.id, { cost: Number(e.target.value) })} /></td>
                            <td className="text-right"><Money value={round2(w.income - w.cost)} /></td>
                            <td>
                              <Button variant="ghost" disabled={lock} title={lock ? "Закриту роботу видалити не можна" : "Видалити рядок"} onClick={() => setDraft((d) => d && d.filter((r) => r.id !== w.id))}>✕</Button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="whitespace-nowrap">{name(refs.workTypes, w.workTypeId)}</td>
                            <td>{name(refs.carriers, w.carrierId)}</td>
                            <td>{name(refs.formats, w.formatId)}</td>
                            <td>{name(refs.contractors, w.contractorId)}</td>
                            <td className="whitespace-nowrap text-slate-500">{period(w.periodStart, w.periodEnd)}</td>
                            <td className="max-w-44 truncate text-slate-600" title={w.description}>{w.description}</td>
                            <td className="text-right"><Money value={w.income} /></td>
                            <td className="text-right"><Money value={w.cost} /></td>
                            <td className="text-right"><Money value={round2(w.income - w.cost)} /></td>
                            <td className="text-right"><Money value={invoiced.get(w.id) ?? 0} /></td>
                            <td className="whitespace-nowrap">
                              {orig?.closed && <Badge tone="green">Закрито{orig.closedAt ? ` ${fmtDate(orig.closedAt)}` : ""}</Badge>}
                              {orig?.finalLoadedAt && <span className="ml-1 cursor-help" title={`Фінальна сума завантажена ${fmtDate(orig.finalLoadedAt)}`}>✔︎</span>}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                  {!editing && groups.length > 1 && (
                    <tr className="bg-slate-50 text-xs font-medium text-slate-600">
                      <td colSpan={7} className="text-right">Разом: {g.label}</td>
                      <td className="text-right"><Money value={sub.income} /></td>
                      <td className="text-right"><Money value={sub.cost} /></td>
                      <td className="text-right"><Money value={sub.margin} /></td>
                      <td className="text-right"><Money value={sub.invoiced} /></td>
                      <td />
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          {!editing && (
            <tfoot>
              <tr className="bg-slate-100 font-semibold">
                <td colSpan={7} className="text-right">Разом по проєкту</td>
                <td className="text-right"><Money value={totals(works, invoiced).income} /></td>
                <td className="text-right"><Money value={totals(works, invoiced).cost} /></td>
                <td className="text-right"><Money value={totals(works, invoiced).margin} /></td>
                <td className="text-right"><Money value={totals(works, invoiced).invoiced} /></td>
                <td />
              </tr>
            </tfoot>
          )}
        </Table>
      )}
    </div>
  );
}
