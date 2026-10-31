import { useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useStore } from "../../store";
import { useInvoiced, resolveHint } from "../../shell/hooks";
import { fmtDate, nextInvoiceNumber, overlaps, round2, today, uninvoiced, VAT_RATE } from "../../domain/calc";
import type { ContractType } from "../../domain/types";
import { Alert, Button, Card, Field, Input, Money, Page, Select, Empty, Stat, clsx } from "../../ui";
import { NO_BRAND, addDays, groupRows, period, prevMonthRange, sumAmount, vatOf, workTitle, type Row } from "./util";
import { useDict } from "./useData";

type CRow = Row & { rest: number };

export function InvoiceNew() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const st = useStore();
  const d = useDict();
  const invoiced = useInvoiced();
  const prev = useMemo(prevMonthRange, []);

  // Проєкт із параметра запуску задає клієнта, а без явного періоду — весь період проєкту (рахунок «на всю суму»).
  const [launchProject] = useState(() => {
    const code = sp.get("project")?.trim().toUpperCase();
    return code ? st.projects.find((p) => p.code === code) : undefined;
  });
  const [projectSpan] = useState(() => {
    if (!launchProject) return undefined;
    const ws = st.works.filter((w) => w.projectId === launchProject.id);
    const starts = [launchProject.startDate, ...ws.map((w) => w.periodStart)].filter(Boolean) as string[];
    const ends = [launchProject.endDate, ...ws.map((w) => w.periodEnd)].filter(Boolean) as string[];
    return starts.length && ends.length ? { from: [...starts].sort()[0], to: [...ends].sort().reverse()[0] } : undefined;
  });
  const [clientId, setClientId] = useState(() => resolveHint(st.clients, sp.get("client"))?.id ?? launchProject?.clientId ?? "");
  const [from, setFrom] = useState(sp.get("from") || projectSpan?.from || prev.from);
  const [to, setTo] = useState(sp.get("to") || projectSpan?.to || prev.to);
  const [projectCode, setProjectCode] = useState(launchProject?.code ?? (sp.get("project") || ""));
  const [number, setNumber] = useState(() => nextInvoiceNumber(st.invoices));
  const [date, setDate] = useState(today());
  const [dueDate, setDueDate] = useState(addDays(today(), 10));
  const [contractType, setContractType] = useState<ContractType>("commission");
  const [note, setNote] = useState("");
  const [off, setOff] = useState<Set<string>>(new Set());
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<string[]>([]);

  const clientProjects = useMemo(() => st.projects.filter((p) => p.clientId === clientId), [st.projects, clientId]);

  // Усі роботи клієнта за період із невиставленим залишком.
  const rows = useMemo(() => {
    const out: CRow[] = [];
    const ids = new Set(clientProjects.filter((p) => !projectCode || p.code === projectCode).map((p) => p.id));
    for (const w of st.works) {
      if (!ids.has(w.projectId) || !overlaps(w, from, to)) continue;
      const rest = uninvoiced(w, invoiced);
      if (rest <= 0.005) continue;
      const project = d.projects.get(w.projectId)!;
      out.push({
        workId: w.id, amount: rest, rest, work: w, project,
        brandName: (project.brandId && d.brands.get(project.brandId)?.name) || NO_BRAND,
        workType: d.workTypes.get(w.workTypeId),
        carrier: w.carrierId ? d.carriers.get(w.carrierId) : undefined,
        format: w.formatId ? d.formats.get(w.formatId) : undefined,
        costShare: 0,
      });
    }
    out.sort((a, b) => a.work.periodStart.localeCompare(b.work.periodStart));
    return out;
  }, [st.works, clientProjects, projectCode, from, to, invoiced, d]);

  const amountOf = (r: CRow) => {
    const raw = amounts[r.workId];
    if (raw === undefined) return r.rest;
    const n = parseFloat(raw.replace(",", "."));
    return isFinite(n) ? Math.min(Math.max(round2(n), 0), r.rest) : 0;
  };
  const checked = (id: string) => !off.has(id);
  const selected = rows.filter((r) => checked(r.workId)).map((r) => ({ ...r, amount: amountOf(r) })).filter((r) => r.amount > 0);

  const groups = useMemo(() => groupRows(rows), [rows]);
  const net = sumAmount(selected);
  const vat = vatOf(net);
  const byBrand = groupRows(selected).map((g) => ({ brand: g.brand, sum: g.sum }));

  const toggle = (ids: string[], on: boolean) =>
    setOff((o) => {
      const n = new Set(o);
      for (const id of ids) {
        if (on) n.delete(id);
        else n.add(id);
      }
      return n;
    });
  const allOn = (ids: string[]) => ids.every(checked);

  const save = () => {
    const res = st.saveInvoice({
      number: number.trim(), date, clientId, periodStart: from, periodEnd: to, dueDate, contractType, note: note.trim() || undefined,
      status: "issued",
      lines: selected.map((r) => ({ workId: r.workId, amount: r.amount })),
    });
    if (!res.ok) return setErrors(res.errors);
    nav(`/invoices/${res.invoice.id}`);
  };
  const preErrors = [!clientId && "Оберіть клієнта", !number.trim() && "Вкажіть номер", from > to && "Початок періоду пізніше за кінець"].filter(Boolean) as string[];
  const allErrors = [...errors, ...preErrors];

  return (
    <Page title="Новий рахунок" subtitle="Рахунок клієнту за період (мультибренд)" actions={<Link to="/invoices"><Button>До списку</Button></Link>}>
      <div className="grid gap-4">
        <Card title="Параметри">
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Клієнт">
              <Select value={clientId} onChange={(e) => { setClientId(e.target.value); setProjectCode(""); setOff(new Set()); setAmounts({}); }}>
                <option value="">— оберіть —</option>
                {st.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Період з"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="Період по"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
            <Field label="Проєкт (необов’язково)">
              <Select value={projectCode} onChange={(e) => setProjectCode(e.target.value)}>
                <option value="">Усі проєкти клієнта</option>
                {clientProjects.map((p) => <option key={p.id} value={p.code}>{p.code} · {p.name}</option>)}
              </Select>
            </Field>
            <Field label="Номер"><Input value={number} onChange={(e) => setNumber(e.target.value)} /></Field>
            <Field label="Дата рахунку"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Строк оплати"><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
            <Field label="Тип договору">
              <Select value={contractType} onChange={(e) => setContractType(e.target.value as ContractType)}>
                <option value="commission">Комісійний</option>
                <option value="regular">Звичайний</option>
              </Select>
            </Field>
            <Field label="Примітка" className="md:col-span-4"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          </div>
        </Card>

        {!clientId ? (
          <Empty>Оберіть клієнта, щоб побачити роботи, які можна виставити.</Empty>
        ) : !rows.length ? (
          <Empty>За {period(from, to)} немає робіт з невиставленим залишком.</Empty>
        ) : (
          <Card
            title={`Роботи до виставлення (${rows.length})`}
            actions={
              <label className="flex items-center gap-1.5 text-sm text-slate-600">
                <input type="checkbox" checked={allOn(rows.map((r) => r.workId))} onChange={(e) => toggle(rows.map((r) => r.workId), e.target.checked)} />
                Вибрати все
              </label>
            }
          >
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="w-8 py-2" />
                    <th className="px-2">Вид робіт · носій · формат</th>
                    <th className="px-2">Період</th>
                    <th className="px-2 text-right">Дохід</th>
                    <th className="px-2 text-right">Вже виставлено</th>
                    <th className="px-2 text-right">Залишок</th>
                    <th className="w-40 px-2 text-right">До виставлення</th>
                  </tr>
                </thead>
                {groups.map((g) => {
                  const bids = g.projects.flatMap((p) => p.rows.map((r) => r.workId));
                  return (
                    <tbody key={g.brand}>
                      <tr className="bg-indigo-50/60">
                        <td className="py-1.5 pl-1"><input type="checkbox" checked={allOn(bids)} onChange={(e) => toggle(bids, e.target.checked)} /></td>
                        <td colSpan={5} className="px-2 font-semibold text-indigo-900">Бренд: {g.brand}</td>
                        <td className="px-2 text-right font-semibold text-indigo-900">
                          <Money value={sumAmount(selected.filter((s) => s.brandName === g.brand))} />
                        </td>
                      </tr>
                      {g.projects.map((p) => {
                        const ids = p.rows.map((r) => r.workId);
                        return (
                          <ProjectRows key={p.project.id}>
                            <tr className="bg-slate-50">
                              <td className="py-1.5 pl-5"><input type="checkbox" checked={allOn(ids)} onChange={(e) => toggle(ids, e.target.checked)} /></td>
                              <td colSpan={6} className="px-2 font-medium text-slate-700">
                                <span className="text-slate-400">{p.project.code}</span> · {p.project.name}
                              </td>
                            </tr>
                            {p.rows.map((r) => (
                              <tr key={r.workId} className={clsx("border-t border-slate-100", !checked(r.workId) && "text-slate-400")}>
                                <td className="py-1.5 pl-9"><input type="checkbox" checked={checked(r.workId)} onChange={(e) => toggle([r.workId], e.target.checked)} /></td>
                                <td className="px-2">{workTitle(r)}</td>
                                <td className="whitespace-nowrap px-2">{period(r.work.periodStart, r.work.periodEnd)}</td>
                                <td className="px-2 text-right"><Money value={r.work.income} /></td>
                                <td className="px-2 text-right"><Money value={round2(r.work.income - (r as CRow).rest)} /></td>
                                <td className="px-2 text-right"><Money value={(r as CRow).rest} /></td>
                                <td className="px-2">
                                  <Input
                                    className="text-right tabular-nums"
                                    disabled={!checked(r.workId)}
                                    value={amounts[r.workId] ?? String((r as CRow).rest)}
                                    onChange={(e) => setAmounts((a) => ({ ...a, [r.workId]: e.target.value }))}
                                    onBlur={() => setAmounts((a) => (a[r.workId] === undefined ? a : { ...a, [r.workId]: String(amountOf(r as CRow)) }))}
                                  />
                                </td>
                              </tr>
                            ))}
                          </ProjectRows>
                        );
                      })}
                    </tbody>
                  );
                })}
              </table>
            </div>
          </Card>
        )}

        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <Card title="Підсумок за брендами">
            {byBrand.length ? (
              <ul className="space-y-1 text-sm">
                {byBrand.map((b) => (
                  <li key={b.brand} className="flex justify-between gap-6"><span>{b.brand}</span><Money value={b.sum} /></li>
                ))}
              </ul>
            ) : <div className="text-sm text-slate-400">Нічого не вибрано</div>}
          </Card>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Без ПДВ" value={<Money value={net} />} sub={`${selected.length} робіт`} />
            <Stat label={`ПДВ ${Math.round(VAT_RATE * 100)}%`} value={<Money value={vat} />} />
            <Stat label="З ПДВ" value={<Money value={round2(net + vat)} />} />
          </div>
        </div>

        {allErrors.length > 0 && (
          <Alert tone="red"><ul className="list-disc pl-4">{allErrors.map((e, i) => <li key={i}>{e}</li>)}</ul></Alert>
        )}
        <div className="flex justify-end gap-2">
          <Link to="/invoices"><Button variant="ghost">Скасувати</Button></Link>
          <Button variant="primary" disabled={!selected.length || preErrors.length > 0} onClick={save}>Виставити рахунок від {fmtDate(date)}</Button>
        </div>
      </div>
    </Page>
  );
}

function ProjectRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
