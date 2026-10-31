// SPA «Імпорт з Excel»: бюджети проєктів (mode=budget) і фінальні суми (mode=final).
// Модель пропонує тільки СТРУКТУРУ файлу; усі рядки читає і застосовує детермінований код.
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useStore } from "../../store";
import { llmConfigured } from "../../llm/openrouter";
import { nowIso } from "../../domain/calc";
import type { SheetMapping } from "../../domain/types";
import { Alert, Badge, Button, Page, Select, clsx } from "../../ui";
import type { ImportMode } from "./fields";
import { extractRows, headerSignature, type SheetData } from "./parse";
import { readWorkbook } from "./workbook";
import { findTemplate, heuristicMapping, validateMapping } from "./mapping";
import { llmDetectMapping, llmResolve, type LlmCallInfo } from "./llm";
import { aliasesFrom, applyLlmSuggestions, collectResolution, unresolvedRequest, type Resolution } from "./resolve";
import { loadAliases, saveAliases } from "./aliases";
import { buildBudgetPlan, buildFinalPlan } from "./plan";
import { executeBudget, executeFinal, type ImportResult } from "./execute";
import { Stepper, type Step } from "./common";
import { FileStep } from "./FileStep";
import { StructureStep, type SourceInfo } from "./StructureStep";
import { ResolveStep } from "./ResolveStep";
import { BudgetPreview, FinalPreview } from "./PreviewStep";
import { DoneStep } from "./DoneStep";

interface LoadedFile {
  name: string;
  size: number;
  sheets: SheetData[];
}

const MODES: { id: ImportMode; title: string; sub: string }[] = [
  { id: "budget", title: "Бюджети проєктів", sub: "медіаплани: створення і оновлення проєктів" },
  { id: "final", title: "Фінальні суми", sub: "факт по роботах наявних проєктів" },
];

export function ImportApp() {
  const [params, setParams] = useSearchParams();
  const mode: ImportMode = params.get("mode") === "final" ? "final" : "budget";
  const store = useStore();
  const llmReady = llmConfigured() && !!store.settings.openRouterKey;

  const [step, setStep] = useState<Step>(1);
  const [maxStep, setMaxStep] = useState<Step>(1);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [fileError, setFileError] = useState<string>();
  const [reading, setReading] = useState(false);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [mapping, setMapping] = useState<SheetMapping | null>(null);
  const [source, setSource] = useState<SourceInfo>({ source: "heuristic" });
  const [detecting, setDetecting] = useState(false);
  const [savedTemplate, setSavedTemplate] = useState<string>();
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [resolveLlm, setResolveLlm] = useState<LlmCallInfo>();
  const [resolving, setResolving] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [applying, setApplying] = useState(false);
  const reqId = useRef(0);

  const go = (s: Step) => {
    setStep(s);
    setMaxStep((m) => (s > m ? s : m));
  };

  const sheet = file?.sheets[sheetIdx];
  const grid = sheet?.rows ?? [];
  const extract = useMemo(() => (mapping && sheet ? extractRows(sheet.rows, mapping) : { rows: [], skipped: [] }), [mapping, sheet]);
  const issues = useMemo(() => (mapping && sheet ? validateMapping(mapping, sheet.rows, mode) : { errors: [], warnings: [] }), [mapping, sheet, mode]);

  // ── Крок 2: визначення структури ──
  async function detect(sh: SheetData, how?: "llm" | "heuristic") {
    const id = ++reqId.current;
    setDetecting(false);
    setResolving(false);
    setSavedTemplate(undefined);
    setResolution(null);
    setResolveLlm(undefined);
    setMaxStep(2);
    if (!how) {
      const tpl = findTemplate(useStore.getState().templates, sh.rows);
      if (tpl) {
        setMapping({ ...tpl.mapping, sheetName: sh.name });
        setSource({ source: "template", templateName: tpl.name });
        return;
      }
    }
    if (how !== "heuristic" && llmConfigured()) {
      setMapping(heuristicMapping(sh.rows, sh.name));
      setSource({ source: "heuristic" });
      setDetecting(true);
      const r = await llmDetectMapping(sh.rows, sh.name, mode);
      if (id !== reqId.current) return;
      setDetecting(false);
      if (r.mapping) {
        setMapping(r.mapping);
        setSource({ source: "llm", llm: r.info });
      } else {
        setSource({ source: "heuristic", llm: r.info });
      }
      return;
    }
    setMapping(heuristicMapping(sh.rows, sh.name));
    setSource({ source: "heuristic" });
  }

  async function onFile(f: File) {
    setFileError(undefined);
    setReading(true);
    try {
      const buf = await f.arrayBuffer();
      const sheets = readWorkbook(buf, f.name).filter((s) => s.rows.some((r) => r?.some((c) => c !== null && c !== undefined && String(c).trim() !== "")));
      if (!sheets.length) throw new Error("У файлі немає аркушів з даними");
      setFile({ name: f.name, size: f.size, sheets });
      setResult(null);
      // Аркуш за замовчуванням — той, де найбільше рядків.
      const best = sheets.reduce((bi, s, i) => (s.rows.length > sheets[bi].rows.length ? i : bi), 0);
      setSheetIdx(best);
      go(2);
      void detect(sheets[best]);
    } catch (e) {
      setFileError(`Не вдалося прочитати файл: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setReading(false);
    }
  }

  function changeSheet(i: number) {
    if (!file) return;
    setSheetIdx(i);
    setStep(2);
    void detect(file.sheets[i]);
  }

  function reset() {
    reqId.current++;
    setFile(null);
    setMapping(null);
    setResolution(null);
    setResolveLlm(undefined);
    setResult(null);
    setDetecting(false);
    setResolving(false);
    setStep(1);
    setMaxStep(1);
  }

  // Зміна режиму (вкладки або параметр запуску): структура лишається, довідники й перевірка — заново.
  const prevMode = useRef(mode);
  useEffect(() => {
    if (prevMode.current === mode) return;
    prevMode.current = mode;
    if (step === 5) reset();
    else if (step > 2) {
      setResolution(null);
      setResolveLlm(undefined);
      setStep(2);
      setMaxStep(2);
    } else if (step === 2) setMaxStep(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ── Крок 3: довідники ──
  async function toResolve() {
    const st = useStore.getState();
    const res = collectResolution(extract.rows, mode, st, loadAliases());
    setResolution(res);
    setResolveLlm(undefined);
    setResolving(false);
    go(3);
    const id = ++reqId.current;
    const req = unresolvedRequest(res, st);
    if (!req.length || !llmConfigured()) return;
    setResolving(true);
    const r = await llmResolve(req);
    if (id !== reqId.current) return;
    setResolving(false);
    setResolveLlm(r.info);
    if (r.items.length) setResolution((cur) => (cur ? applyLlmSuggestions(cur, r.items, mode) : cur));
  }

  // ── Крок 4: план ──
  const threshold = store.settings.autoVersionThresholdPct;
  const budgetPlan = useMemo(
    () => (step >= 4 && mode === "budget" && resolution ? buildBudgetPlan(extract.rows, resolution, store, threshold) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step, mode, resolution, extract, store.projects, store.works, store.versions, store.invoices, store.carriers, store.workTypes, store.clients, threshold],
  );
  const finalPlan = useMemo(
    () => (step >= 4 && mode === "final" && resolution ? buildFinalPlan(extract.rows, resolution, store, threshold, nowIso()) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step, mode, resolution, extract, store.projects, store.works, store.versions, store.invoices, threshold],
  );

  function apply() {
    setApplying(true);
    try {
      const a = useStore.getState();
      const r = mode === "budget" && budgetPlan ? executeBudget(budgetPlan, a) : finalPlan ? executeFinal(finalPlan, a) : null;
      if (r) {
        if (resolution) saveAliases(aliasesFrom(resolution));
        setResult(r);
        setStep(5);
        setMaxStep(5);
      }
    } finally {
      setApplying(false);
    }
  }

  function saveTemplate(name: string) {
    if (!mapping || !sheet) return;
    const tpl = store.saveTemplate({ name, signature: headerSignature(sheet.rows, mapping.headerRow), mapping });
    setSavedTemplate(tpl.name);
  }

  return (
    <Page
      title="Імпорт з Excel"
      subtitle="Один файл — багато проєктів. Модель пропонує структуру файлу, дані читає програма."
      actions={file && step !== 1 ? <Button variant="ghost" onClick={reset}>Почати заново</Button> : undefined}
    >
      <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:max-w-2xl">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setParams((p) => { const n = new URLSearchParams(p); n.set("mode", m.id); return n; })}
            className={clsx(
              "rounded-xl border px-4 py-2.5 text-left transition",
              mode === m.id ? "border-indigo-600 bg-indigo-50 ring-2 ring-indigo-100" : "border-slate-200 bg-white hover:border-slate-300",
            )}
          >
            <div className={clsx("text-sm font-semibold", mode === m.id ? "text-indigo-800" : "text-slate-700")}>{m.title}</div>
            <div className="text-xs text-slate-500">{m.sub}</div>
          </button>
        ))}
      </div>

      <Stepper step={step} maxStep={maxStep} onGo={(s) => (s === 1 ? reset() : setStep(s))} />

      {file && step > 1 && step < 5 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm">
          <span className="text-lg">▦</span>
          <span className="font-medium text-slate-800">{file.name}</span>
          <span className="text-slate-400">{(file.size / 1024).toFixed(0)} КБ</span>
          {file.sheets.length > 1 ? (
            <span className="flex items-center gap-2">
              <span className="text-slate-500">Аркуш:</span>
              <Select className="w-auto py-1" value={sheetIdx} onChange={(e) => changeSheet(Number(e.target.value))}>
                {file.sheets.map((s, i) => <option key={s.name} value={i}>{s.name} ({s.rows.length} рядків)</option>)}
              </Select>
            </span>
          ) : (
            <Badge>{sheet?.name} · {grid.length} рядків</Badge>
          )}
        </div>
      )}

      {step === 1 && <FileStep mode={mode} onFile={onFile} error={fileError} busy={reading} templates={store.templates} llmReady={llmReady} />}

      {step === 2 && sheet && mapping && (
        <StructureStep
          mode={mode}
          grid={grid}
          sheetName={sheet.name}
          mapping={mapping}
          onChange={(m) => {
            setMapping(m);
            setSavedTemplate(undefined);
            setMaxStep(2);
          }}
          source={source}
          detecting={detecting}
          issues={issues}
          extract={extract}
          llmReady={llmReady}
          onRedetect={(how) => void detect(sheet, how)}
          onSaveTemplate={saveTemplate}
          savedTemplate={savedTemplate}
          onBack={reset}
          onNext={() => void toResolve()}
        />
      )}

      {step === 3 && resolution && (
        <ResolveStep
          mode={mode}
          resolution={resolution}
          onChange={setResolution}
          refs={store}
          resolving={resolving}
          llm={resolveLlm}
          llmReady={llmReady}
          onBack={() => setStep(2)}
          onNext={() => go(4)}
        />
      )}

      {step === 4 && budgetPlan && <BudgetPreview plan={budgetPlan} onBack={() => setStep(3)} onApply={apply} applying={applying} />}
      {step === 4 && finalPlan && <FinalPreview plan={finalPlan} onBack={() => setStep(3)} onApply={apply} applying={applying} />}
      {step === 4 && !budgetPlan && !finalPlan && <Alert tone="amber">Немає даних для перевірки — поверніться на крок «Довідники».</Alert>}

      {step === 5 && result && <DoneStep result={result} onAgain={reset} />}
    </Page>
  );
}
