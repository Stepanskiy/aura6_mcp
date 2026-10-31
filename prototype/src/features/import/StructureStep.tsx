import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ImportField, SheetMapping } from "../../domain/types";
import { fmtDate } from "../../domain/calc";
import { Alert, Button, Card, Field, Input, Money, Stat, Table, clsx } from "../../ui";
import { FIELDS, type ImportMode } from "./fields";
import { SKIP_LABEL, cellText, gridWidth, type ExtractResult, type Grid, type SkipReason } from "./parse";
import type { MappingIssues, MappingSource } from "./mapping";
import type { LlmCallInfo } from "./llm";
import { SAMPLE_ROWS } from "./prompts";
import { LlmUsage, PromptPanel, Spinner, colLetter } from "./common";

export interface SourceInfo {
  source: MappingSource;
  templateName?: string;
  llm?: LlmCallInfo;
}

const PREVIEW_ROWS = 14;

export function StructureStep(props: {
  mode: ImportMode;
  grid: Grid;
  sheetName: string;
  mapping: SheetMapping;
  onChange: (m: SheetMapping) => void;
  source: SourceInfo;
  detecting: boolean;
  issues: MappingIssues;
  extract: ExtractResult;
  llmReady: boolean;
  onRedetect: (how: "llm" | "heuristic") => void;
  onSaveTemplate: (name: string) => void;
  savedTemplate?: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const { grid, mapping, extract, issues, source, mode } = props;
  const width = gridWidth(grid);
  const [tplName, setTplName] = useState(`${props.sheetName} · ${mode === "budget" ? "бюджети" : "фінальні суми"}`);
  const skipped = useMemo(() => new Map(extract.skipped.map((s) => [s.rowIndex, s.reason])), [extract]);
  const parsedIdx = useMemo(() => new Set(extract.rows.map((r) => r.rowIndex)), [extract]);
  const setCol = (i: number, f: ImportField) => props.onChange({ ...mapping, columns: { ...mapping.columns, [i]: f } });

  const skipCounts = useMemo(() => {
    const m = new Map<SkipReason, number>();
    for (const s of extract.skipped) if (s.reason !== "empty") m.set(s.reason, (m.get(s.reason) ?? 0) + 1);
    return [...m];
  }, [extract]);
  const codes = new Set(extract.rows.map((r) => r.text.projectCode));
  const income = extract.rows.reduce((s, r) => s + (r.income ?? 0), 0);
  const cost = extract.rows.reduce((s, r) => s + (r.cost ?? 0), 0);
  const rowWarnings = extract.rows.filter((r) => r.warnings.length);

  const from = Math.max(0, mapping.headerRow - 2);
  const previewIdx: number[] = [];
  for (let r = from; r < grid.length && previewIdx.length < PREVIEW_ROWS; r++) previewIdx.push(r);

  return (
    <div className="space-y-5">
      {/* Джерело структури */}
      {props.detecting ? (
        <Alert tone="sky"><Spinner>Модель аналізує структуру аркуша «{props.sheetName}» — надсилаю тільки перші {SAMPLE_ROWS} рядків…</Spinner></Alert>
      ) : source.source === "template" ? (
        <Alert tone="green">
          <b>Шаблон «{source.templateName}»</b> — формат упізнано за заголовками, модель не викликалась (0 токенів).
        </Alert>
      ) : source.source === "llm" && source.llm ? (
        <Alert tone="sky">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              <b>Структуру запропонувала модель.</b> Вона бачила {Math.min(SAMPLE_ROWS, grid.length)} з {grid.length} рядків; дані всіх рядків прочитано програмою за цією структурою.
            </span>
            <LlmUsage info={source.llm} />
          </div>
          {source.llm.notes && <div className="mt-1 text-sky-900/80">«{source.llm.notes}»</div>}
        </Alert>
      ) : source.llm?.error ? (
        <Alert tone="amber">
          Модель не впоралась ({source.llm.error.slice(0, 220)}). Відповідність заповнено евристикою за назвами колонок — перевірте її нижче.
        </Alert>
      ) : (
        <Alert tone="sky">
          {props.llmReady ? "Відповідність заповнено евристикою за назвами колонок." : <>Ключ моделі не задано (<Link className="underline" to="/settings">Налаштування</Link>) — відповідність заповнено евристикою за назвами колонок.</>} Перевірте її і за потреби змініть.
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Рядків даних" value={extract.rows.length} sub={`з ${grid.length} рядків аркуша`} />
        <Stat label="Пропущено" value={extract.skipped.filter((s) => s.reason !== "empty").length} sub={skipCounts.map(([r, n]) => `${SKIP_LABEL[r]}: ${n}`).join(", ") || "службових рядків немає"} />
        <Stat label="Проєктів" value={codes.size} />
        <Stat label="Дохід у файлі" value={<Money value={income} whole />} />
        <Stat label="Затрата у файлі" value={<Money value={cost} whole />} />
      </div>

      {issues.errors.length > 0 && <Alert tone="red"><ul className="list-disc pl-4">{issues.errors.map((e) => <li key={e}>{e}</li>)}</ul></Alert>}
      {issues.warnings.length > 0 && <Alert tone="amber"><ul className="list-disc pl-4">{issues.warnings.map((e) => <li key={e}>{e}</li>)}</ul></Alert>}

      <Card
        title={`Відповідність колонок — аркуш «${props.sheetName}»`}
        actions={
          <>
            {props.llmReady && <Button onClick={() => props.onRedetect("llm")} disabled={props.detecting}>Розпізнати моделлю</Button>}
            <Button variant="ghost" onClick={() => props.onRedetect("heuristic")} disabled={props.detecting}>Евристика за заголовками</Button>
          </>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Field label="Рядок заголовків" hint="Номер як в Excel">
            <Input type="number" min={1} max={grid.length} value={mapping.headerRow + 1} onChange={(e) => props.onChange({ ...mapping, headerRow: Math.max(0, Number(e.target.value) - 1) })} />
          </Field>
          <Field label="Перший рядок даних">
            <Input type="number" min={1} max={grid.length} value={mapping.firstDataRow + 1} onChange={(e) => props.onChange({ ...mapping, firstDataRow: Math.max(0, Number(e.target.value) - 1) })} />
          </Field>
          <Field label="Пропускати рядки, що містять" hint="Через кому. Підсумки «Разом / Всього / Итого / Total» пропускаються завжди">
            <Input value={mapping.skipRowPatterns.join(", ")} onChange={(e) => props.onChange({ ...mapping, skipRowPatterns: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
          </Field>
        </div>

        <div className="overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-50">
                <th className="sticky left-0 z-10 w-10 bg-slate-50 px-2 py-2 text-slate-400">#</th>
                {Array.from({ length: width }, (_, i) => {
                  const f = mapping.columns[i] ?? "ignore";
                  return (
                    <th key={i} className="min-w-36 px-1.5 py-1.5 text-left align-bottom font-normal">
                      <div className="mb-1 text-[10px] font-semibold text-slate-400">{colLetter(i)}</div>
                      <select
                        value={f}
                        onChange={(e) => setCol(i, e.target.value as ImportField)}
                        className={clsx(
                          "w-full rounded-md border px-1.5 py-1 text-xs outline-none focus:ring-2 focus:ring-indigo-100",
                          f === "ignore" ? "border-slate-200 bg-white text-slate-400" : "border-indigo-300 bg-indigo-50 font-medium text-indigo-800",
                        )}
                      >
                        {FIELDS.map((x) => <option key={x.field} value={x.field}>{x.label}</option>)}
                      </select>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {previewIdx.map((r) => {
                const isHeader = r === mapping.headerRow;
                const reason = skipped.get(r);
                const parsed = parsedIdx.has(r);
                const before = r < mapping.firstDataRow && !isHeader;
                return (
                  <tr key={r} className={clsx(isHeader && "bg-indigo-50/60 font-semibold", (reason || before) && "text-slate-400", reason === "subtotal" && "italic")}>
                    <td className="sticky left-0 border-t border-slate-100 bg-inherit px-2 py-1 text-right text-slate-400">
                      <div className="flex items-center justify-end gap-1">
                        {parsed && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="рядок даних" />}
                        {r + 1}
                      </div>
                    </td>
                    {Array.from({ length: width }, (_, i) => (
                      <td key={i} className={clsx("max-w-52 truncate border-t border-slate-100 px-2 py-1", mapping.columns[i] && mapping.columns[i] !== "ignore" && !isHeader && !reason && !before && "text-slate-800")} title={cellText(grid[r]?.[i])}>
                        {cellText(grid[r]?.[i])}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />рядок даних</span>
          <span className="rounded bg-indigo-50 px-1 font-semibold text-indigo-800">рядок заголовків</span>
          <span className="text-slate-400">сірим — пропускається (заголовок звіту, підсумок, порожній)</span>
        </div>
      </Card>

      <Card title={`Як прочитано (перші ${Math.min(10, extract.rows.length)} з ${extract.rows.length})`}>
        {extract.rows.length ? (
          <Table>
            <thead>
              <tr>
                <th>Рядок</th><th>Код</th><th>Вид / медіа</th><th>Носій</th><th>Формат</th><th>Період</th><th className="text-right">Дохід</th><th className="text-right">Затрата</th>
              </tr>
            </thead>
            <tbody>
              {extract.rows.slice(0, 10).map((r) => (
                <tr key={r.rowIndex}>
                  <td className="text-slate-400">{r.rowIndex + 1}</td>
                  <td className="font-medium">{r.text.projectCode}</td>
                  <td>{r.text.workType}</td>
                  <td>{r.text.carrier}</td>
                  <td>{r.text.format}</td>
                  <td className="whitespace-nowrap">{fmtDate(r.periodStart)} – {fmtDate(r.periodEnd)}</td>
                  <td className="text-right">{r.income !== undefined ? <Money value={r.income} /> : "—"}</td>
                  <td className="text-right">{r.cost !== undefined ? <Money value={r.cost} /> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="text-sm text-slate-500">Жодного рядка не прочитано — перевірте рядок заголовків і відповідність колонок.</div>
        )}
        {rowWarnings.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-amber-700">Попередження в {rowWarnings.length} рядках</summary>
            <ul className="mt-1 max-h-40 list-disc overflow-auto pl-5 text-xs text-slate-600">
              {rowWarnings.slice(0, 50).map((r) => <li key={r.rowIndex}>Рядок {r.rowIndex + 1}: {r.warnings.join("; ")}</li>)}
            </ul>
          </details>
        )}
      </Card>

      {source.llm && <PromptPanel info={source.llm} note={<>Це весь запит. Рядки після {SAMPLE_ROWS}-го і повні значення клітинок моделі не передавались.</>} />}

      {source.source !== "template" && !props.detecting && (
        <Card title="Шаблон формату">
          {props.savedTemplate ? (
            <Alert tone="green">Збережено шаблон «{props.savedTemplate}». Наступний файл з такими заголовками імпортується без моделі.</Alert>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Назва шаблону" className="min-w-72 flex-1" hint={`Підпис формату: ${Object.values(mapping.columns).filter((f) => f !== "ignore").length} колонок, заголовки з рядка ${mapping.headerRow + 1}`}>
                <Input value={tplName} onChange={(e) => setTplName(e.target.value)} />
              </Field>
              <Button onClick={() => props.onSaveTemplate(tplName.trim() || props.sheetName)} disabled={issues.errors.length > 0}>
                Зберегти як шаблон формату
              </Button>
            </div>
          )}
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={props.onBack}>← Інший файл</Button>
        <Button variant="primary" onClick={props.onNext} disabled={props.detecting || issues.errors.length > 0 || !extract.rows.length}>
          Далі: довідники →
        </Button>
      </div>
    </div>
  );
}
