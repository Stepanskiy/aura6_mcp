import { useState } from "react";
import { Link } from "react-router-dom";
import type { MediaType } from "../../domain/types";
import { Alert, Badge, Button, Card, Empty, Stat, Table, clsx } from "../../ui";
import { DICT_LABEL, MEDIA_LABEL, MEDIA_TYPES, type DictKind, type ImportMode } from "./fields";
import { options, resolveCounts, type Resolution, type ResolveItem } from "./resolve";
import type { PlanState } from "./plan";
import type { LlmCallInfo } from "./llm";
import { LlmUsage, PromptPanel, Spinner } from "./common";

function ViaBadge({ it }: { it: ResolveItem }) {
  switch (it.via) {
    case "exact": return <Badge tone="green">точний збіг</Badge>;
    case "alias": return <Badge tone="green">запамʼятовано</Badge>;
    case "prefix": return <Badge tone="green">за префіксом коду</Badge>;
    case "media": return <Badge tone="green">за видом медіа</Badge>;
    case "manual": return <Badge tone="slate">вручну</Badge>;
    case "llm": {
      const pct = it.confidence !== undefined ? ` ${Math.round(it.confidence * 100)}%` : "";
      return <Badge tone={it.confidence !== undefined && it.confidence < 0.7 ? "amber" : "indigo"}>модель{pct}</Badge>;
    }
    default: return <Badge tone="amber">не знайдено</Badge>;
  }
}

const MEDIA_KINDS: DictKind[] = ["carrier", "format", "workType"];

export function ResolveStep(props: {
  mode: ImportMode;
  resolution: Resolution;
  onChange: (r: Resolution) => void;
  refs: PlanState;
  resolving: boolean;
  llm?: LlmCallInfo;
  llmReady: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const { resolution, mode, refs } = props;
  const [showExact, setShowExact] = useState(false);
  const counts = resolveCounts(resolution);
  const kinds = (Object.keys(resolution) as DictKind[]).filter((k) => Object.keys(resolution[k] ?? {}).length);

  const update = (kind: DictKind, key: string, patch: Partial<ResolveItem>) => {
    const cur = resolution[kind]![key];
    props.onChange({ ...resolution, [kind]: { ...resolution[kind], [key]: { ...cur, ...patch } } });
  };

  const isAuto = (it: ResolveItem) => it.via === "exact" || it.via === "alias" || it.via === "prefix" || it.via === "media";

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Унікальних значень" value={counts.total} sub={kinds.map((k) => DICT_LABEL[k].toLowerCase()).join(", ") || "—"} />
        <Stat label="Знайдено одразу" value={counts.exact} sub="точний збіг або запамʼятовано" />
        <Stat label="Зіставила модель" value={counts.llm} />
        {mode === "budget" ? <Stat label="Буде створено" value={counts.create} sub="нових записів довідників" /> : <Stat label="Не зіставлено" value={counts.unmatched} sub="такі рядки не завантажаться" />}
        <Stat label="Вибрано вручну" value={counts.manual} />
      </div>

      {props.resolving ? (
        <Alert tone="sky"><Spinner>Модель зіставляє нерозпізнані значення з довідниками — один запит на весь файл, тільки назви, без сум…</Spinner></Alert>
      ) : props.llm?.error ? (
        <Alert tone="amber">Модель не відповіла ({props.llm.error.slice(0, 200)}). Зіставте значення вручну{mode === "budget" ? " — за замовчуванням буде створено нові записи" : ""}.</Alert>
      ) : props.llm ? (
        <Alert tone="sky">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Модель запропонувала відповідності для нерозпізнаних значень. Перевірте позначені <b>«модель»</b>; будь-яку можна змінити.</span>
            <LlmUsage info={props.llm} />
          </div>
        </Alert>
      ) : counts.pending > 0 && !props.llmReady ? (
        <Alert tone="sky">Ключ моделі не задано (<Link className="underline" to="/settings">Налаштування</Link>) — зіставте значення вручну{mode === "budget" ? "; за замовчуванням буде створено нові записи" : ""}.</Alert>
      ) : counts.total > 0 && counts.pending === 0 && counts.llm === 0 ? (
        <Alert tone="green">Усі значення знайдено в довідниках точним збігом — модель не знадобилась.</Alert>
      ) : null}

      {mode === "final" && <Alert tone="sky">Фінальні суми не створюють записів довідників: значення без відповідності лишаються незіставленими, а їх рядки — у списку «Не знайдено».</Alert>}

      {!kinds.length && <Empty>У файлі немає колонок довідників — зіставляти нічого.</Empty>}

      {kinds.length > 0 && (
        <div className="flex justify-end">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={showExact} onChange={(e) => setShowExact(e.target.checked)} />
            Показати знайдені одразу ({counts.exact})
          </label>
        </div>
      )}

      {kinds.map((kind) => {
        const items = Object.values(resolution[kind]!).sort((a, b) => Number(isAuto(a)) - Number(isAuto(b)) || b.count - a.count);
        const visible = items.filter((it) => showExact || !isAuto(it));
        const opts = options(refs, kind);
        const hidden = items.length - visible.length;
        return (
          <Card key={kind} title={<span>{DICT_LABEL[kind]} <span className="font-normal text-slate-400">· {items.length}</span></span>} actions={hidden ? <span className="text-xs text-slate-400">ще {hidden} з точним збігом</span> : undefined}>
            {visible.length ? (
              <Table>
                <thead>
                  <tr>
                    <th>Значення у файлі</th>
                    <th className="text-right">Рядків</th>
                    <th className="w-[38%]">Запис довідника</th>
                    {mode === "budget" && MEDIA_KINDS.includes(kind) && <th>Медіа (для нового)</th>}
                    <th>Як знайдено</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((it) => (
                    <tr key={it.key} className={clsx(it.matchId === "new" && "bg-emerald-50/40")}>
                      <td>
                        <span className="font-medium">{it.value}</span>
                        {it.fromPrefix && <span className="ml-2"><Badge tone="sky">з коду проєкту</Badge></span>}
                      </td>
                      <td className="text-right tabular-nums text-slate-500">{it.count}</td>
                      <td>
                        <select
                          className={clsx("w-full rounded-md border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-100", it.matchId === "new" ? "border-emerald-300 text-emerald-800" : !it.matchId ? "border-amber-300 text-amber-800" : "border-slate-300")}
                          value={it.matchId}
                          onChange={(e) => update(kind, it.key, { matchId: e.target.value, via: "manual", confidence: undefined })}
                        >
                          {mode === "budget" ? <option value="new">＋ Створити новий «{it.value}»</option> : <option value="">— не зіставлено —</option>}
                          {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                        {kind === "client" && it.matchId === "new" && <div className="mt-0.5 text-xs text-slate-400">префікс кодів: {it.prefix}</div>}
                      </td>
                      {mode === "budget" && MEDIA_KINDS.includes(kind) && (
                        <td>
                          {it.matchId === "new" ? (
                            <select className="rounded-md border border-slate-300 px-2 py-1 text-sm" value={it.mediaType ?? ""} onChange={(e) => update(kind, it.key, { mediaType: (e.target.value || undefined) as MediaType | undefined })}>
                              {kind === "workType" && <option value="">—</option>}
                              {MEDIA_TYPES.map((m) => <option key={m} value={m}>{MEDIA_LABEL[m]}</option>)}
                            </select>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                      )}
                      <td><ViaBadge it={it} /></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <div className="text-sm text-slate-500">Усі {items.length} значень знайдено точним збігом.</div>
            )}
          </Card>
        );
      })}

      {props.llm && <PromptPanel info={props.llm} title="Що бачила модель (довідники)" note="Тільки назви з файлу, які не знайшлися точним збігом, і назви записів довідників. Сум, дат і кодів проєктів у запиті немає." />}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={props.onBack}>← Структура</Button>
        <Button variant="primary" onClick={props.onNext} disabled={props.resolving}>Далі: перевірка →</Button>
      </div>
    </div>
  );
}
