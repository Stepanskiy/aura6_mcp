// Дрібні спільні елементи інтерфейсу імпорту.
import type { ReactNode } from "react";
import { Badge, clsx } from "../../ui";
import type { LlmCallInfo } from "./llm";

export const STEPS = ["Файл", "Структура", "Довідники", "Перевірка", "Готово"] as const;
export type Step = 1 | 2 | 3 | 4 | 5;

export function Stepper({ step, maxStep, onGo }: { step: Step; maxStep: Step; onGo: (s: Step) => void }) {
  return (
    <ol className="mb-5 flex flex-wrap items-center gap-2">
      {STEPS.map((label, i) => {
        const n = (i + 1) as Step;
        const done = n < step;
        const active = n === step;
        const reachable = n <= maxStep && n !== step && step !== 5;
        return (
          <li key={label} className="flex items-center gap-2">
            <button
              type="button"
              disabled={!reachable}
              onClick={() => onGo(n)}
              className={clsx(
                "flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition",
                active && "border-indigo-600 bg-indigo-600 text-white shadow-sm",
                done && !active && "border-indigo-200 bg-indigo-50 text-indigo-700",
                !done && !active && "border-slate-200 bg-white text-slate-400",
                reachable && "hover:border-indigo-400 cursor-pointer",
              )}
            >
              <span className={clsx("flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold", active ? "bg-white/20" : done ? "bg-indigo-600 text-white" : "bg-slate-100")}>
                {done ? "✓" : n}
              </span>
              {label}
            </button>
            {i < STEPS.length - 1 && <span className="h-px w-6 bg-slate-200" />}
          </li>
        );
      })}
    </ol>
  );
}

export function Spinner({ children }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-600">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
      {children}
    </span>
  );
}

const fmtInt = (n: number | undefined) => (n === undefined ? "—" : new Intl.NumberFormat("uk-UA").format(n));

/** Модель, токени, час — прозорий облік вартості виклику. */
export function LlmUsage({ info }: { info: LlmCallInfo }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {info.model && <Badge tone="indigo">{info.model}</Badge>}
      <Badge>вхід {fmtInt(info.promptTokens)} ток.</Badge>
      <Badge>вихід {fmtInt(info.completionTokens)} ток.</Badge>
      {info.ms !== undefined && <Badge>{(info.ms / 1000).toFixed(1).replace(".", ",")} с</Badge>}
    </span>
  );
}

/** «Що бачила модель»: точний текст запиту. */
export function PromptPanel({ info, title = "Що бачила модель", note }: { info: LlmCallInfo; title?: string; note?: ReactNode }) {
  return (
    <details className="group rounded-lg border border-slate-200 bg-slate-50">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium text-slate-700">
        <span className="flex items-center gap-2">
          <span className="text-slate-400 transition group-open:rotate-90">▸</span>
          {title}
        </span>
        <LlmUsage info={info} />
      </summary>
      <div className="space-y-3 border-t border-slate-200 px-3 py-3 text-xs">
        {note && <div className="text-slate-600">{note}</div>}
        <div>
          <div className="mb-1 font-semibold uppercase tracking-wide text-slate-500">Системна інструкція</div>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-white p-2 font-mono text-[11px] leading-relaxed text-slate-700 ring-1 ring-slate-200">{info.prompt.system}</pre>
        </div>
        <div>
          <div className="mb-1 font-semibold uppercase tracking-wide text-slate-500">Повідомлення</div>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded bg-white p-2 font-mono text-[11px] leading-relaxed text-slate-700 ring-1 ring-slate-200">{info.prompt.user}</pre>
        </div>
        <details>
          <summary className="cursor-pointer text-slate-500">JSON-схема відповіді ({info.prompt.schemaName})</summary>
          <pre className="mt-1 max-h-64 overflow-auto rounded bg-white p-2 font-mono text-[11px] text-slate-700 ring-1 ring-slate-200">{JSON.stringify(info.prompt.schema, null, 2)}</pre>
        </details>
      </div>
    </details>
  );
}

export function colLetter(i: number): string {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Дві суми «було → стало». */
export function Delta({ before, after }: { before?: number; after: number }) {
  if (before === undefined || Math.abs(before - after) < 0.005) return null;
  const d = after - before;
  return <span className={clsx("ml-1 text-xs tabular-nums", d > 0 ? "text-emerald-600" : "text-red-600")}>{d > 0 ? "+" : ""}{new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 }).format(d)}</span>;
}
