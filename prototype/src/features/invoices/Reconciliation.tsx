import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useStore } from "../../store";
import { useInvoiced, resolveHint } from "../../shell/hooks";
import { latestVersion, overlaps, round2, today, uninvoiced } from "../../domain/calc";
import { launchUrl } from "../../shell/routes";
import { Badge, Button, Empty, Field, Input, Money, Page, Select, Table, clsx } from "../../ui";
import { period, workTitle } from "./util";
import { useDict } from "./useData";
import type { Project, Work } from "../../domain/types";

interface Line { work: Work; plan: number; billed: number; rest: number; tone: "green" | "amber" | "red" | "none" }
interface Sums { plan: number; current: number; billed: number; rest: number }

const zero = (): Sums => ({ plan: 0, current: 0, billed: 0, rest: 0 });
const add = (s: Sums, l: Line) => {
  s.plan = round2(s.plan + l.plan);
  s.current = round2(s.current + l.work.income);
  s.billed = round2(s.billed + l.billed);
  s.rest = round2(s.rest + l.rest);
};

function SumCells({ s, bold }: { s: Sums; bold?: boolean }) {
  return (
    <>
      <td className={clsx("text-right", bold && "font-semibold")}><Money value={s.plan} /></td>
      <td className={clsx("text-right", bold && "font-semibold")}><Money value={s.current} /></td>
      <td className={clsx("text-right", bold && "font-semibold")}><Money value={s.billed} /></td>
      <td className={clsx("text-right", bold && "font-semibold")}><Money value={s.rest} /></td>
    </>
  );
}

export function Reconciliation() {
  const [sp] = useSearchParams();
  const st = useStore();
  const d = useDict();
  const invoiced = useInvoiced();
  const [clientId, setClientId] = useState(() => resolveHint(st.clients, sp.get("client"))?.id ?? "");
  const [from, setFrom] = useState(sp.get("from") ?? "");
  const [to, setTo] = useState(sp.get("to") ?? "");
  const [code, setCode] = useState(sp.get("project") ?? "");
  const [onlyOpen, setOnlyOpen] = useState(false);

  const data = useMemo(() => {
    const t = today();
    const res: { client: string; clientId: string; sums: Sums; projects: { project: Project; sums: Sums; lines: Line[] }[] }[] = [];
    for (const c of st.clients) {
      if (clientId && c.id !== clientId) continue;
      const projects: { project: Project; sums: Sums; lines: Line[] }[] = [];
      for (const p of st.projects) {
        if (p.clientId !== c.id) continue;
        if (code.trim() && !p.code.toLowerCase().includes(code.trim().toLowerCase())) continue;
        const ver = latestVersion(st.versions, p.id);
        const plan = new Map((ver?.works ?? []).map((w) => [w.id, w.income]));
        const lines: Line[] = st.works
          .filter((w) => w.projectId === p.id && overlaps(w, from || undefined, to || undefined))
          .map((w) => {
            const billed = round2(invoiced.get(w.id) ?? 0);
            const rest = uninvoiced(w, invoiced);
            const tone: Line["tone"] = rest <= 0.005 && w.income > 0 ? "green" : billed > 0 ? "amber" : w.periodEnd < t && w.income > 0 ? "red" : "none";
            return { work: w, plan: plan.get(w.id) ?? 0, billed, rest, tone };
          })
          .filter((l) => !onlyOpen || l.rest > 0.005)
          .sort((a, b) => a.work.periodStart.localeCompare(b.work.periodStart));
        if (!lines.length) continue;
        const sums = zero();
        lines.forEach((l) => add(sums, l));
        projects.push({ project: p, sums, lines });
      }
      if (!projects.length) continue;
      const sums = zero();
      projects.forEach((p) => p.lines.forEach((l) => add(sums, l)));
      res.push({ client: c.name, clientId: c.id, sums, projects });
    }
    return res;
  }, [st.clients, st.projects, st.works, st.versions, invoiced, clientId, from, to, code, onlyOpen]);

  const grand = zero();
  data.forEach((c) => { grand.plan += c.sums.plan; grand.current += c.sums.current; grand.billed += c.sums.billed; grand.rest += c.sums.rest; });

  const tones = { green: "bg-emerald-50", amber: "bg-amber-50", red: "bg-red-50", none: "" };

  return (
    <Page
      title="Звірка план — виставлено"
      subtitle="План — з останньої версії плану проєкту; поточне — з медіаплану"
      actions={<Link to="/invoices"><Button>До рахунків</Button></Link>}
    >
      <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-5">
        <Field label="Клієнт">
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Усі клієнти</option>
            {st.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Код проєкту"><Input value={code} onChange={(e) => setCode(e.target.value)} /></Field>
        <Field label="Період з"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Період по"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <label className="flex items-end gap-2 pb-2 text-sm text-slate-600"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> Лише з невиставленим залишком</label>
      </div>
      <div className="mb-3 flex flex-wrap gap-2 text-xs text-slate-500">
        <Badge tone="green">виставлено повністю</Badge>
        <Badge tone="amber">виставлено частково</Badge>
        <Badge tone="red">період минув, не виставлено</Badge>
      </div>

      {!data.length ? (
        <Empty>Немає робіт за вибраними фільтрами.</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Клієнт / проєкт / робота</th><th>Період</th>
              <th className="text-right">План</th><th className="text-right">Поточне</th><th className="text-right">Виставлено</th><th className="text-right">Не виставлено</th>
              <th className="text-center">Закрито</th><th />
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <ClientBlock key={c.clientId}>
                <tr className="bg-indigo-50/70 font-semibold text-indigo-900">
                  <td colSpan={2}>{c.client}</td><SumCells s={c.sums} bold /><td /><td />
                </tr>
                {c.projects.map((p) => {
                  const openFrom = p.lines.filter((l) => l.rest > 0.005).map((l) => l.work.periodStart).sort()[0];
                  const openTo = p.lines.filter((l) => l.rest > 0.005).map((l) => l.work.periodEnd).sort().slice(-1)[0];
                  return (
                    <ClientBlock key={p.project.id}>
                      <tr className="bg-slate-100 font-medium">
                        <td colSpan={2} className="pl-6"><span className="text-slate-400">{p.project.code}</span> · {p.project.name}</td>
                        <SumCells s={p.sums} bold /><td />
                        <td className="text-right">
                          {p.sums.rest > 0.005 && (
                            <Link className="text-indigo-600 hover:underline" to={launchUrl("/invoices/new", { client: c.client, project: p.project.code, from: from || openFrom, to: to || openTo })}>
                              Виставити
                            </Link>
                          )}
                        </td>
                      </tr>
                      {p.lines.map((l) => (
                        <tr key={l.work.id} className={tones[l.tone]}>
                          <td className="pl-12">{workTitle({ work: l.work, workType: d.workTypes.get(l.work.workTypeId), carrier: l.work.carrierId ? d.carriers.get(l.work.carrierId) : undefined, format: l.work.formatId ? d.formats.get(l.work.formatId) : undefined })}</td>
                          <td className="whitespace-nowrap">{period(l.work.periodStart, l.work.periodEnd)}</td>
                          <td className="text-right"><Money value={l.plan} /></td>
                          <td className="text-right"><Money value={l.work.income} /></td>
                          <td className="text-right"><Money value={l.billed} /></td>
                          <td className="text-right"><Money value={l.rest} /></td>
                          <td className="text-center text-emerald-600">{l.work.closed ? "✓" : ""}</td>
                          <td />
                        </tr>
                      ))}
                    </ClientBlock>
                  );
                })}
              </ClientBlock>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td colSpan={2}>Разом</td>
              <SumCells s={{ plan: round2(grand.plan), current: round2(grand.current), billed: round2(grand.billed), rest: round2(grand.rest) }} bold />
              <td /><td />
            </tr>
          </tfoot>
        </Table>
      )}
    </Page>
  );
}

function ClientBlock({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
