import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useStore } from "../../store";
import { fmtDate, round2, VAT_RATE } from "../../domain/calc";
import { Badge, Button, Card, Empty, Money, Page, Stat, Table } from "../../ui";
import { CONTRACT_LABEL, groupRows, invoiceRows, period, sumAmount, vatOf, workTitle } from "./util";
import { useDict, useWorksMap } from "./useData";

export function InvoiceView() {
  const { id } = useParams();
  const nav = useNavigate();
  const inv = useStore((s) => s.invoices.find((i) => i.id === id));
  const del = useStore((s) => s.deleteInvoice);
  const d = useDict();
  const works = useWorksMap();
  const rows = useMemo(() => (inv ? invoiceRows(inv, d, works) : []), [inv, d, works]);
  const groups = useMemo(() => groupRows(rows), [rows]);

  if (!inv) return <Page title="Рахунок не знайдено"><Empty>Рахунок було видалено або посилання хибне. <Link className="text-indigo-600 underline" to="/invoices">До списку</Link></Empty></Page>;

  const net = sumAmount(rows);
  const vat = vatOf(net);
  const remove = () => {
    if (window.confirm(`Видалити рахунок ${inv.number}? Роботи знову стануть невиставленими.`)) {
      del(inv.id);
      nav("/invoices");
    }
  };

  return (
    <Page
      title={`Рахунок № ${inv.number} від ${fmtDate(inv.date)}`}
      subtitle={<>{d.clients.get(inv.clientId)?.name} · період {period(inv.periodStart, inv.periodEnd)} · <Badge tone={inv.contractType === "commission" ? "indigo" : "slate"}>{CONTRACT_LABEL[inv.contractType]} договір</Badge></>}
      actions={
        <>
          <Link to="/invoices"><Button variant="ghost">До списку</Button></Link>
          <Link to={`/invoices/${inv.id}/print`}><Button variant="primary">Друкована форма</Button></Link>
          <Button variant="danger" onClick={remove}>Видалити</Button>
        </>
      }
    >
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Stat label="Без ПДВ" value={<Money value={net} />} />
        <Stat label={`ПДВ ${Math.round(VAT_RATE * 100)}%`} value={<Money value={vat} />} />
        <Stat label="З ПДВ" value={<Money value={round2(net + vat)} />} />
        <Stat label="Строк оплати" value={fmtDate(inv.dueDate) || "—"} sub={inv.note} />
      </div>

      <div className="grid gap-4">
        {groups.map((g) => (
          <Card key={g.brand} title={<>Бренд: {g.brand}</>} actions={<span className="text-sm font-semibold tabular-nums"><Money value={g.sum} /></span>}>
            <div className="grid gap-4">
              {g.projects.map((p) => (
                <div key={p.project.id}>
                  <div className="mb-1 text-sm font-medium text-slate-700">
                    <span className="text-slate-400">{p.project.code}</span> · {p.project.name}
                  </div>
                  <Table>
                    <thead>
                      <tr><th>Робота</th><th>Період</th><th className="text-right">Дохід</th><th className="text-right">У рахунку</th></tr>
                    </thead>
                    <tbody>
                      {p.rows.map((r) => (
                        <tr key={r.workId}>
                          <td>{workTitle(r)}</td>
                          <td className="whitespace-nowrap">{period(r.work.periodStart, r.work.periodEnd)}</td>
                          <td className="text-right"><Money value={r.work.income} /></td>
                          <td className="text-right font-medium"><Money value={r.amount} /></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="font-semibold"><td colSpan={3}>Разом по проєкту</td><td className="text-right"><Money value={p.sum} /></td></tr></tfoot>
                  </Table>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </Page>
  );
}
