// Друкована форма «Замовлення рахунка клієнту № [Номер] від [Дата]» за макетом 1С
// (блок 1 — комісійний договір, блок 2 — звичайний договір із рядками ПДВ).
import { useMemo, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useStore } from "../../store";
import { fmtDate, fmtMoney, round2, VAT_RATE } from "../../domain/calc";
import { Button } from "../../ui";
import { CONTRACT_LABEL, groupRows, invoiceRows, period, sumAmount, vatOf, workTitle, type Row } from "./util";
import { useDict, useWorksMap } from "./useData";

const CSS = `
.pf { background:#fff; color:#000; font-family: Arial, Calibri, sans-serif; font-size:11px; width:210mm; min-height:297mm; margin:16px auto; padding:12mm 12mm; box-shadow:0 1px 8px rgba(0,0,0,.15); box-sizing:border-box; }
.pf h1 { font-size:15px; font-weight:700; margin:0 0 10px; }
.pf table { border-collapse:collapse; width:100%; margin-bottom:10px; }
.pf td, .pf th { border:1px solid #000; padding:3px 6px; vertical-align:top; }
.pf th { background:#e9e9e9; font-weight:700; text-align:center; }
.pf .sec td { background:#d9d9d9; font-weight:700; text-transform:uppercase; }
.pf .brand td { background:#f0f0f0; font-weight:700; }
.pf .num { text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
.pf .lbl { width:34%; font-weight:700; background:#f5f5f5; }
.pf .tot td { font-weight:700; }
.pf .sign { display:flex; gap:40px; margin-top:28px; }
.pf .sign div { flex:1; }
.pf .line { border-bottom:1px solid #000; height:18px; margin-top:6px; }
@page { size: A4; margin: 0; }
@media print { .pf { margin:0; box-shadow:none; width:auto; min-height:0; padding:12mm; } body { background:#fff !important; } }
`;

interface Item { brandName: string; project: Row["project"]; amount: number; cells: ReactNode[] }

type SumFn = (n: number) => string[];

function Section({ title, heads, items, numFrom, sums }: { title: string; heads: string[]; items: Item[]; numFrom: number; sums: SumFn }) {
  if (!items.length) return null;
  const groups = groupRows(items);
  const cols = heads.length;
  return (
    <table>
      <thead>
        <tr className="sec"><td colSpan={cols}>{title}</td></tr>
        <tr>{heads.map((h) => <th key={h}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <BrandBlock key={g.brand} brand={g.brand} sum={g.sum} items={g.projects.flatMap((p) => p.rows)} numFrom={numFrom} sums={sums} />
        ))}
        <tr className="tot"><td colSpan={numFrom}>Загалом:</td>{sums(sumAmount(items)).map((c, i) => <td key={i} className="num">{c}</td>)}</tr>
      </tbody>
    </table>
  );
}

function BrandBlock({ brand, sum, items, numFrom, sums }: { brand: string; sum: number; items: Item[]; numFrom: number; sums: SumFn }) {
  return (
    <>
      <tr className="brand"><td colSpan={numFrom}>{brand}</td>{sums(sum).map((c, i) => <td key={i} className="num">{c}</td>)}</tr>
      {items.map((it, i) => (
        <tr key={i}>
          {it.cells.map((c, j) => <td key={j} className={j >= numFrom ? "num" : ""}>{c}</td>)}
        </tr>
      ))}
    </>
  );
}

export function InvoicePrint() {
  const { id } = useParams();
  const inv = useStore((s) => s.invoices.find((i) => i.id === id));
  const settings = useStore((s) => s.settings);
  const d = useDict();
  const works = useWorksMap();
  const rows = useMemo(() => (inv ? invoiceRows(inv, d, works) : []), [inv, d, works]);

  if (!inv) return <div className="p-6">Рахунок не знайдено. <Link to="/invoices" className="text-indigo-600 underline">До списку</Link></div>;

  const commission = inv.contractType === "commission";
  const client = d.clients.get(inv.clientId);
  const brands = [...new Set(rows.map((r) => r.brandName))];
  const projects = [...new Map(rows.map((r) => [r.project.id, r.project])).values()];
  const managers = [...new Set(projects.map((p) => (p.managerId && d.managers.get(p.managerId)?.name) || "").filter(Boolean))];
  const names = projects.map((p) => p.name).join("; ");

  const net = sumAmount(rows);
  const vat = vatOf(net);
  const gross = round2(net + vat);
  const withVat = (n: number) => round2(n + vatOf(n));

  const placement = rows.filter((r) => r.workType?.kind !== "agency");
  const agency = rows.filter((r) => r.workType?.kind === "agency");
  const money = (n: number) => fmtMoney(commission ? withVat(n) : n);

  const placementItems: Item[] = placement.map((r) => ({
    brandName: r.brandName, project: r.project, amount: r.amount,
    cells: commission
      ? [workTitle(r), r.project.name, period(r.work.periodStart, r.work.periodEnd), money(r.amount)]
      : [workTitle(r), r.project.name, period(r.work.periodStart, r.work.periodEnd), fmtMoney(r.amount), fmtMoney(withVat(r.amount))],
  }));
  const agencyItems: Item[] = agency.map((r) => ({
    brandName: r.brandName, project: r.project, amount: r.amount,
    cells: commission
      ? [workTitle(r) || "Послуги з планування", r.project.name, period(r.work.periodStart, r.work.periodEnd), money(r.amount)]
      : [workTitle(r) || "Послуги з планування", r.project.name, period(r.work.periodStart, r.work.periodEnd), fmtMoney(r.amount), fmtMoney(withVat(r.amount))],
  }));
  const heads = commission
    ? ["Формулювання для рахунку клієнта", "Кампанія", "Період", "Сума для рахунку клієнта, гривня"]
    : ["Формулювання для рахунку клієнта", "Кампанія", "Період", "Сума без ПДВ", "Сума з ПДВ"];
  const numFrom = 3;
  const sums: SumFn = commission ? (n) => [fmtMoney(withVat(n))] : (n) => [fmtMoney(n), fmtMoney(withVat(n))];
  const sums1: SumFn = (n) => [fmtMoney(n)];
  const sumsCost: SumFn = (n) => [fmtMoney(n), fmtMoney(vatOf(n))];

  // Комісійна винагорода: частина виставленого, що перевищує вартість підрядника.
  const commItems: Item[] = placement
    .map((r) => ({ r, c: round2(r.amount - r.costShare) }))
    .filter((x) => x.c > 0)
    .map(({ r, c }) => ({
      brandName: r.brandName, project: r.project, amount: c,
      cells: [workTitle(r), r.project.name, period(r.work.periodStart, r.work.periodEnd), money(c)],
    }));
  // Треті особи: вартість підрядника пропорційно виставленій частці.
  const thirdItems: Item[] = placement
    .filter((r) => r.costShare > 0)
    .map((r) => ({
      brandName: r.brandName, project: r.project, amount: r.costShare,
      cells: [r.contractor?.name ?? "—", r.project.name, fmtMoney(r.costShare), fmtMoney(vatOf(r.costShare))],
    }));

  return (
    <div className="bg-slate-200 py-2 print:bg-white">
      <style>{CSS}</style>
      <div className="no-print mx-auto flex max-w-[210mm] justify-between pt-2">
        <Link to={`/invoices/${inv.id}`}><Button>Назад до рахунку</Button></Link>
        <Button variant="primary" onClick={() => window.print()}>Друкувати</Button>
      </div>
      <div className="pf">
        <h1>Замовлення рахунка клієнту № {inv.number} від {fmtDate(inv.date)}</h1>
        <table>
          <tbody>
            <tr><td className="lbl">Агенція</td><td>{settings.agencyName}</td></tr>
            <tr><td className="lbl">Клієнт</td><td>{client?.name}</td></tr>
            <tr><td className="lbl">Бренд</td><td>{brands.join(", ")}</td></tr>
            <tr><td className="lbl">Проект</td><td>{projects.map((p) => p.code).join(", ")}</td></tr>
            <tr><td className="lbl">Менеджер</td><td>{managers.join(", ")}</td></tr>
            <tr><td className="lbl">Найменування проекту</td><td>{names}</td></tr>
            <tr><td className="lbl">Період виконання робіт</td><td>{period(inv.periodStart, inv.periodEnd)}</td></tr>
            <tr><td className="lbl">Платник</td><td>{client?.name}{client?.edrpou ? `, ЄДРПОУ ${client.edrpou}` : ""}</td></tr>
            <tr><td className="lbl">Валюта розрахунків</td><td>гривня</td></tr>
            <tr><td className="lbl">Тип договору</td><td>{CONTRACT_LABEL[inv.contractType]}</td></tr>
            <tr><td className="lbl">Договір/додаток</td><td>Договір № ________ від ________, додаток № ____</td></tr>
            <tr><td className="lbl">Строк оплати</td><td>{fmtDate(inv.dueDate)}</td></tr>
            <tr><td className="lbl">Передплата</td><td>{inv.dueDate && inv.dueDate < inv.periodStart ? "так" : "ні"}</td></tr>
          </tbody>
        </table>

        {brands.length > 0 && (
          <table>
            <thead><tr><th>Бренд</th><th>Кампанія</th><th>Період</th><th>Сума без ПДВ</th></tr></thead>
            <tbody>
              {groupRows(rows).map((g) => (
                <BrandBlock
                  key={g.brand}
                  brand={g.brand}
                  sum={g.sum}
                  numFrom={3}
                  sums={sums1}
                  items={g.projects.map((p) => ({
                    brandName: g.brand, project: p.project, amount: p.sum,
                    cells: [p.project.code, p.project.name, period(inv.periodStart, inv.periodEnd), fmtMoney(p.sum)],
                  }))}
                />
              ))}
            </tbody>
          </table>
        )}

        <Section title="Послуги з розміщення" heads={heads} items={placementItems} numFrom={numFrom} sums={sums} />
        <Section title="Послуги агентства" heads={heads} items={agencyItems} numFrom={numFrom} sums={sums} />
        {commission && (
          <>
            <Section title="Комісійна винагорода" heads={["Формулювання для рахунку клієнта", "Кампанія", "Період", "Сума для рахунку клієнта, гривня"]} items={commItems} numFrom={numFrom} sums={sums} />
            <Section title="Треті особи" heads={["Підрядник", "Кампанія", "Вартість розміщення постачальника (без ПДВ, гривня)", "ПДВ вартості розміщення (гривня)"]} items={thirdItems} numFrom={2} sums={sumsCost} />
          </>
        )}

        <table>
          <tbody>
            {commission ? (
              <tr className="tot"><td className="lbl">Загальна сума для рахунку клієнта</td><td className="num">{fmtMoney(gross)} грн</td></tr>
            ) : (
              <>
                <tr><td className="lbl">Загальна сума рахунку без податків</td><td className="num">{fmtMoney(net)} грн</td></tr>
                <tr><td className="lbl">Податки (ПДВ, {Math.round(VAT_RATE * 100)}%)</td><td className="num">{fmtMoney(vat)} грн</td></tr>
                <tr className="tot"><td className="lbl">Загальна сума рахунку з ПДВ</td><td className="num">{fmtMoney(gross)} грн</td></tr>
              </>
            )}
          </tbody>
        </table>
        {inv.note && <p>Примітка: {inv.note}</p>}

        <div className="sign">
          <div>Менеджер<div className="line" /></div>
          <div>Фінансовий директор<div className="line" /></div>
        </div>
      </div>
    </div>
  );
}
