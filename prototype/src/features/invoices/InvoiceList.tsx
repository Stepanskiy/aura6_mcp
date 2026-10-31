import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useStore } from "../../store";
import { resolveHint } from "../../shell/hooks";
import { fmtDate, round2, overlaps } from "../../domain/calc";
import { Badge, Button, Empty, Field, Input, Money, Page, Select, Table } from "../../ui";
import { CONTRACT_LABEL, invoiceNet, invoiceRows, period, vatOf } from "./util";
import { useDict, useWorksMap } from "./useData";

export function InvoiceList() {
  const [sp] = useSearchParams();
  const st = useStore();
  const d = useDict();
  const works = useWorksMap();
  const [clientId, setClientId] = useState(() => resolveHint(st.clients, sp.get("client"))?.id ?? "");
  const [code, setCode] = useState(sp.get("project") ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    return st.invoices
      .filter((i) => !clientId || i.clientId === clientId)
      .filter((i) => !q || i.number.toLowerCase().includes(q.toLowerCase()))
      .filter((i) => overlaps({ periodStart: i.periodStart, periodEnd: i.periodEnd }, from || undefined, to || undefined))
      .map((i) => {
        const rows = invoiceRows(i, d, works);
        return { inv: i, rows };
      })
      .filter((x) => !code.trim() || x.rows.some((r) => r.project.code.toLowerCase().includes(code.trim().toLowerCase())))
      .sort((a, b) => b.inv.date.localeCompare(a.inv.date) || b.inv.number.localeCompare(a.inv.number));
  }, [st.invoices, clientId, code, from, to, q, d, works]);

  const net = round2(list.reduce((s, x) => s + invoiceNet(x.inv), 0));
  const vat = round2(list.reduce((s, x) => s + vatOf(invoiceNet(x.inv)), 0));

  return (
    <Page
      title="Рахунки клієнтам"
      subtitle={`${list.length} з ${st.invoices.length}`}
      actions={
        <>
          <Link to="/invoices/reconciliation"><Button>Звірка</Button></Link>
          <Link to="/invoices/new"><Button variant="primary">Новий рахунок</Button></Link>
        </>
      }
    >
      <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-5">
        <Field label="Клієнт">
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Усі клієнти</option>
            {st.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Код проєкту"><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="KST-0012" /></Field>
        <Field label="Період з"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Період по"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="Номер"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="РК-2026-…" /></Field>
      </div>

      {!list.length ? (
        <Empty>Рахунків не знайдено. <Link className="text-indigo-600 underline" to="/invoices/new">Створити рахунок</Link></Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Номер</th><th>Дата</th><th>Клієнт</th><th>Період</th><th>Бренди</th>
              <th className="text-right">Проєктів</th><th className="text-right">Без ПДВ</th><th className="text-right">З ПДВ</th>
            </tr>
          </thead>
          <tbody>
            {list.map(({ inv, rows }) => {
              const brands = [...new Set(rows.map((r) => r.brandName))];
              const projects = new Set(rows.map((r) => r.project.id)).size;
              const n = invoiceNet(inv);
              return (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="font-medium"><Link className="text-indigo-600 hover:underline" to={`/invoices/${inv.id}`}>{inv.number}</Link> <Badge tone={inv.contractType === "commission" ? "indigo" : "slate"}>{CONTRACT_LABEL[inv.contractType]}</Badge></td>
                  <td className="whitespace-nowrap">{fmtDate(inv.date)}</td>
                  <td>{d.clients.get(inv.clientId)?.name}</td>
                  <td className="whitespace-nowrap">{period(inv.periodStart, inv.periodEnd)}</td>
                  <td>{brands.join(", ")}</td>
                  <td className="text-right tabular-nums">{projects}</td>
                  <td className="text-right"><Money value={n} /></td>
                  <td className="text-right"><Money value={round2(n + vatOf(n))} /></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td colSpan={6}>Разом</td>
              <td className="text-right"><Money value={net} /></td>
              <td className="text-right"><Money value={round2(net + vat)} /></td>
            </tr>
          </tfoot>
        </Table>
      )}
    </Page>
  );
}
