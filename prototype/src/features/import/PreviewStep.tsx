import { useState } from "react";
import { fmtDate, fmtPct } from "../../domain/calc";
import { Alert, Badge, Button, Card, Money, Stat, Table, clsx } from "../../ui";
import { FINAL_STATUS_LABEL, periodLabel, refsInUse, type BudgetPlan, type BudgetProjectPlan, type BudgetRowStatus, type FinalPlan, type FinalRowPlan } from "./plan";
import { DICT_LABEL, DICT_KINDS, DICT_REF } from "./fields";
import { Delta } from "./common";

const STATUS: Record<BudgetRowStatus, { label: string; tone: "green" | "indigo" | "slate" | "amber" | "red" }> = {
  new: { label: "нова", tone: "green" },
  changed: { label: "зміна", tone: "indigo" },
  same: { label: "без змін", tone: "slate" },
  closed: { label: "закрита", tone: "amber" },
  error: { label: "помилка", tone: "red" },
};

function Amount({ before, after }: { before?: number; after: number }) {
  const changed = before !== undefined && Math.abs(before - after) >= 0.005;
  return (
    <div className="whitespace-nowrap text-right">
      {changed && <div className="text-xs text-slate-400 line-through"><Money value={before} /></div>}
      <Money value={after} className={clsx(changed && "font-semibold")} />
      {changed && <Delta before={before} after={after} />}
    </div>
  );
}

function ProjectCard({ p }: { p: BudgetProjectPlan }) {
  const [showSame, setShowSame] = useState(false);
  const same = p.rows.filter((r) => r.status === "same").length;
  const rows = p.rows.filter((r) => showSame || r.status !== "same");
  const counts = { add: p.rows.filter((r) => r.status === "new").length, change: p.rows.filter((r) => r.status === "changed").length };
  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-slate-900">{p.code}</span>
          {p.errors.length ? <Badge tone="red">Не буде імпортовано</Badge> : p.exists ? <Badge tone="indigo">Оновлення</Badge> : <Badge tone="green">Новий проєкт</Badge>}
          <span className="font-normal text-slate-600">{p.name}</span>
        </span>
      }
      actions={
        <span className="flex items-center gap-3 text-xs text-slate-500">
          {counts.add > 0 && <span>+{counts.add} нових</span>}
          {counts.change > 0 && <span>{counts.change} змін</span>}
          {same > 0 && <span>{same} без змін</span>}
        </span>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
          {p.clientName && <span>Клієнт: <b className="font-medium text-slate-800">{p.clientName}</b></span>}
          {p.brandName && <span>Бренд: <b className="font-medium text-slate-800">{p.brandName}</b></span>}
          {p.header && <span>Період: <b className="font-medium text-slate-800">{fmtDate(p.header.startDate)} – {fmtDate(p.header.endDate)}</b></span>}
          <span>
            Дохід: {p.exists && <><Money value={p.before.income} whole /> → </>}<b className="font-medium text-slate-800"><Money value={p.after.income} whole /></b>
          </span>
          <span>
            Затрата: {p.exists && <><Money value={p.before.cost} whole /> → </>}<b className="font-medium text-slate-800"><Money value={p.after.cost} whole /></b>
          </span>
        </div>
        {p.errors.map((e) => <Alert key={e} tone="red">{e}</Alert>)}
        {p.versionHint && <Alert tone="sky">ⓘ {p.versionHint}</Alert>}
        <Table>
          <thead>
            <tr>
              <th>Рядок</th><th>Статус</th><th>Вид робіт</th><th>Носій</th><th>Формат</th><th>Період</th><th className="text-right">Дохід</th><th className="text-right">Затрата</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.row.rowIndex} className={clsx(r.status === "same" && "text-slate-400")}>
                <td className="text-slate-400">{r.row.rowIndex + 1}</td>
                <td><Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge></td>
                <td>{r.labels.workType}</td>
                <td>{r.labels.carrier ?? "—"}</td>
                <td>{r.labels.format ?? "—"}</td>
                <td className="whitespace-nowrap">{periodLabel(r.work.periodStart, r.work.periodEnd)}</td>
                <td><Amount before={r.status === "closed" ? undefined : r.before?.income} after={r.income} /></td>
                <td><Amount before={r.status === "closed" ? undefined : r.before?.cost} after={r.cost} /></td>
                <td className="max-w-56 text-xs text-slate-500">{r.message}{r.row.warnings.length ? <span className="text-amber-600"> {r.row.warnings.join("; ")}</span> : null}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          {same > 0 ? (
            <button className="text-indigo-600 hover:underline" onClick={() => setShowSame(!showSame)}>{showSame ? "Сховати" : "Показати"} рядки без змін ({same})</button>
          ) : <span />}
          {p.missing.length > 0 && (
            <details className="text-slate-500">
              <summary className="cursor-pointer">Немає у файлі: {p.missing.length} робіт — залишаються без змін</summary>
              <ul className="mt-1 list-disc pl-5">
                {p.missing.map(({ work: w, label }) => <li key={w.id}>{label} · {periodLabel(w.periodStart, w.periodEnd)} · <Money value={w.income} whole /></li>)}
              </ul>
            </details>
          )}
        </div>
      </div>
    </Card>
  );
}

export function BudgetPreview({ plan, onBack, onApply, applying }: { plan: BudgetPlan; onBack: () => void; onApply: () => void; applying: boolean }) {
  const c = plan.counts;
  const refs = refsInUse(plan);
  const actionable = c.add + c.change + c.newProjects;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Нових проєктів" value={c.newProjects} />
        <Stat label="Оновлюється" value={c.updatedProjects} sub="наявних проєктів" />
        <Stat label="Нових робіт" value={c.add} />
        <Stat label="Змінених" value={c.change} sub={`${c.same} без змін`} />
        <Stat label="Дохід у файлі" value={<Money value={c.income} whole />} />
        <Stat label="Затрата у файлі" value={<Money value={c.cost} whole />} />
      </div>
      {refs.length > 0 && (
        <Alert tone="green">
          <b>Буде створено в довідниках:</b>{" "}
          {DICT_KINDS.map((k) => {
            const xs = refs.filter((r) => r.kind === DICT_REF[k]);
            return xs.length ? <span key={k} className="mr-3">{DICT_LABEL[k]}: {xs.map((x) => x.item.name).join(", ")}</span> : null;
          })}
        </Alert>
      )}
      {(c.closed > 0 || c.errors > 0) && <Alert tone="amber">{c.closed > 0 && <>Закритих робіт у файлі: {c.closed} — їх суми не змінюються. </>}{c.errors > 0 && <>Рядків або проєктів з помилками: {c.errors} — пропускаються.</>}</Alert>}
      <Alert tone="sky">Роботи, яких немає у файлі, не видаляються. Кожна зміна пишеться в історію проєкту; при суттєвій зміні сум створюється версія плану.</Alert>
      {plan.projects.map((p) => <ProjectCard key={p.code} p={p} />)}
      <div className="sticky bottom-0 -mx-6 flex items-center justify-between border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
        <Button variant="ghost" onClick={onBack}>← Довідники</Button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{c.newProjects} нових проєктів · {c.add} нових робіт · {c.change} змін</span>
          <Button variant="primary" onClick={onApply} disabled={!actionable || applying}>{applying ? "Застосовую…" : "Застосувати"}</Button>
        </div>
      </div>
    </div>
  );
}

function pct(plan: number | undefined, fin: number | undefined) {
  if (!plan || fin === undefined) return undefined;
  return (fin - plan) / plan;
}

function FinalRow({ r }: { r: FinalRowPlan }) {
  const di = (r.income ?? 0) - (r.planIncome ?? 0);
  const dc = (r.cost ?? 0) - (r.planCost ?? 0);
  return (
    <tr>
      <td className="text-slate-400">{r.row.rowIndex + 1}</td>
      <td className="font-mono">{r.code}</td>
      <td>{r.labels.carrier ?? "—"}</td>
      <td>{r.labels.format ?? "—"}</td>
      <td className="whitespace-nowrap">{periodLabel(r.row.periodStart!, r.row.periodStart!)}</td>
      <td className="text-right"><Money value={r.planIncome} /></td>
      <td className="text-right font-medium"><Money value={r.income} /></td>
      <td className={clsx("text-right tabular-nums", di > 0 ? "text-emerald-600" : di < 0 ? "text-red-600" : "text-slate-400")}><Money value={di} className={di === 0 ? "text-slate-400" : undefined} /><div className="text-xs">{fmtPct(pct(r.planIncome, r.income))}</div></td>
      <td className="text-right"><Money value={r.planCost} /></td>
      <td className="text-right font-medium"><Money value={r.cost} /></td>
      <td className={clsx("text-right tabular-nums", dc > 0 ? "text-red-600" : dc < 0 ? "text-emerald-600" : "text-slate-400")}><Money value={dc} className={dc === 0 ? "text-slate-400" : undefined} /><div className="text-xs">{fmtPct(pct(r.planCost, r.cost))}</div></td>
      <td>{r.matchedBy === "full" ? <Badge tone="green">носій+формат+місяць</Badge> : r.matchedBy === "carrier-month" ? <Badge tone="sky">носій+місяць</Badge> : <Badge tone="amber">тільки місяць</Badge>}</td>
    </tr>
  );
}

export function FinalPreview({ plan, onBack, onApply, applying }: { plan: FinalPlan; onBack: () => void; onApply: () => void; applying: boolean }) {
  const c = plan.counts;
  const matched = plan.rows.filter((r) => r.status === "matched");
  const closed = plan.rows.filter((r) => r.status === "closed");
  const other = plan.rows.filter((r) => r.status !== "matched" && r.status !== "closed");
  return (
    <div className="space-y-5">
      <Alert tone="sky">
        Фінальні суми оновлюють дохід і затрату робіт і позначають, що фінальні суми завантажено. <b>Прапорець «сума фінальна» (закриття) імпорт не ставить</b> — це окрема дія в картці проєкту.
      </Alert>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Зіставлено" value={c.matched} sub={`у ${plan.projects.length} проєктах`} />
        <Stat label="Закриті" value={c.closed} sub="пропускаються" />
        <Stat label="Не зіставлено" value={c.unmatched} />
        <Stat label="Дохід: план → фінал" value={<Money value={c.finalIncome} whole />} sub={<>план <Money value={c.planIncome} whole /> · Δ <Money value={c.finalIncome - c.planIncome} whole /></>} />
        <Stat label="Затрата: план → фінал" value={<Money value={c.finalCost} whole />} sub={<>план <Money value={c.planCost} whole /> · Δ <Money value={c.finalCost - c.planCost} whole /></>} />
        <Stat label="Маржа фінал" value={<Money value={c.finalIncome - c.finalCost} whole />} sub={<>план <Money value={c.planIncome - c.planCost} whole /></>} />
      </div>
      {plan.projects.filter((p) => p.versionHint).map((p) => <Alert key={p.code} tone="sky">ⓘ {p.code}: {p.versionHint}</Alert>)}

      <Card title={`Зіставлені роботи (${matched.length})`}>
        {matched.length ? (
          <Table>
            <thead>
              <tr>
                <th>Рядок</th><th>Проєкт</th><th>Носій</th><th>Формат</th><th>Місяць</th><th className="text-right">Дохід план</th><th className="text-right">Дохід фінал</th><th className="text-right">Δ</th><th className="text-right">Затрата план</th><th className="text-right">Затрата фінал</th><th className="text-right">Δ</th><th>Збіг за</th>
              </tr>
            </thead>
            <tbody>{matched.map((r) => <FinalRow key={r.row.rowIndex} r={r} />)}</tbody>
          </Table>
        ) : <div className="text-sm text-slate-500">Жоден рядок не зіставлено з роботами.</div>}
      </Card>

      {closed.length > 0 && (
        <Card title={`Уже закриті роботи — пропускаються (${closed.length})`}>
          <Table>
            <thead><tr><th>Рядок</th><th>Проєкт</th><th>Носій</th><th>Місяць</th><th className="text-right">Поточний дохід</th><th className="text-right">У файлі</th></tr></thead>
            <tbody>
              {closed.map((r) => (
                <tr key={r.row.rowIndex}>
                  <td className="text-slate-400">{r.row.rowIndex + 1}</td><td className="font-mono">{r.code}</td><td>{r.labels.carrier}</td>
                  <td>{periodLabel(r.row.periodStart!, r.row.periodStart!)}</td><td className="text-right"><Money value={r.planIncome} /></td><td className="text-right"><Money value={r.income} /></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {other.length > 0 && (
        <Card title={`Не зіставлено (${other.length})`}>
          <Table>
            <thead><tr><th>Рядок</th><th>Статус</th><th>Проєкт</th><th>Носій</th><th>Формат</th><th>Місяць</th><th className="text-right">Дохід</th><th className="text-right">Затрата</th><th>Причина</th></tr></thead>
            <tbody>
              {other.map((r) => (
                <tr key={r.row.rowIndex}>
                  <td className="text-slate-400">{r.row.rowIndex + 1}</td>
                  <td><Badge tone={r.status === "error" ? "red" : "amber"}>{FINAL_STATUS_LABEL[r.status]}</Badge></td>
                  <td className="font-mono">{r.code}</td><td>{r.row.text.carrier ?? "—"}</td><td>{r.row.text.format ?? "—"}</td>
                  <td>{periodLabel(r.row.periodStart!, r.row.periodStart!)}</td>
                  <td className="text-right">{r.row.income !== undefined ? <Money value={r.row.income} /> : "—"}</td>
                  <td className="text-right">{r.row.cost !== undefined ? <Money value={r.row.cost} /> : "—"}</td>
                  <td className="text-xs text-slate-500">{r.message}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <div className="sticky bottom-0 -mx-6 flex items-center justify-between border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
        <Button variant="ghost" onClick={onBack}>← Довідники</Button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{c.matched} робіт у {plan.projects.length} проєктах</span>
          <Button variant="primary" onClick={onApply} disabled={!c.matched || applying}>{applying ? "Застосовую…" : "Завантажити фінальні суми"}</Button>
        </div>
      </div>
    </div>
  );
}
