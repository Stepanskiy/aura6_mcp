import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Link2Off, Loader2, Lock, PlugZap, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import { Alert, Badge, Button, Card, IconBubble, Modal, Select, Table, clsx } from "../../../ui";
import { fmtDate, fmtMoney0, fmtPct, today as todayIso } from "../../../domain/calc";
import { useStore } from "../../../store";
import type { ProjectViewProps } from "../types";
import { PLATFORMS, type Platform } from "./benchmarks";
import { genAccounts, genCampaigns } from "./campaigns";
import { fmtTime, useDigitalRows, type DRow } from "./model";
import { daysBetween, simulate } from "./simulate";
import { useDigital, type StatsEntry } from "./store";

const SYNC_STEPS = ["Отримання кампаній з кабінету", "Зіставлення кампаній з роботами", "Завантаження щоденної статистики"];

export function PlatformBadge({ p, size = 40 }: { p: Platform; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-xl text-sm font-extrabold text-white shadow-md" style={{ background: p.color, width: size, height: size }} aria-hidden>
      {p.initials}
    </span>
  );
}

export function ConnectorsTab({ project, works }: ProjectViewProps) {
  const rows = useDigitalRows(works);
  const [showOthers, setShowOthers] = useState(false);
  const [connecting, setConnecting] = useState<Platform>();
  const connections = useDigital((s) => s.connections);
  const clientName = useClientName(project.clientId);

  const relevant = PLATFORMS.filter((p) => rows.some((r) => r.platform?.id === p.id));
  const others = PLATFORMS.filter((p) => !relevant.includes(p));
  const noMatch = rows.filter((r) => !r.platform);

  return (
    <div className="space-y-4">
      <Alert tone="sky">
        Кабінети підключаються один раз на агенцію й дають статистику по цифрових роботах проєкту. У робочій системі підключення живе на сервері Аури: токен доступу туди потрапляє напряму від платформи, а модель (чат-бот) бачить лише агреговані результати.
      </Alert>
      {noMatch.length > 0 && <Alert tone="amber">Роботи без відповідного кабінету: {noMatch.map((r) => r.carrierName || r.work.description || r.work.id).join(", ")}. Статистика для них не завантажується.</Alert>}

      <div className="grid gap-4 xl:grid-cols-2">
        {relevant.map((p) => (
          <PlatformCard key={p.id} p={p} project={project} rows={rows.filter((r) => r.platform?.id === p.id)} onConnect={() => setConnecting(p)} />
        ))}
      </div>

      {others.length > 0 && (
        <div>
          <button className="flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:text-fuchsia-600" onClick={() => setShowOthers((v) => !v)}>
            {showOthers ? <ChevronUp size={16} /> : <ChevronDown size={16} />} Також доступно ({others.length})
          </button>
          {showOthers && (
            <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {others.map((p) => {
                const c = connections[p.id];
                return (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl border border-violet-100 bg-white/80 px-3 py-2.5">
                    <PlatformBadge p={p} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-800">{p.name}</div>
                      <div className="truncate text-xs text-slate-500">{c ? `Підключено: ${c.accountName}` : "Немає носіїв цієї платформи в проєкті"}</div>
                    </div>
                    {!c && <Button onClick={() => setConnecting(p)}>Підключити</Button>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      <ConnectModal p={connecting} clientName={clientName} onClose={() => setConnecting(undefined)} />
    </div>
  );
}

function useClientName(clientId: string) {
  return useStore((s) => s.clients.find((c) => c.id === clientId)?.name ?? "Клієнт");
}

function PlatformCard({ p, project, rows, onConnect }: { p: Platform; project: ProjectViewProps["project"]; rows: DRow[]; onConnect: () => void }) {
  const { connections, sync, stats, saveSync, reassign, disconnect } = useDigital();
  const applyWorkChanges = useStore((s) => s.applyWorkChanges);
  const conn = connections[p.id];
  const state = sync[project.id]?.[p.id];
  const [step, setStep] = useState<number>(-1);
  const [result, setResult] = useState<{ ok: string[]; errors: string[] }>();
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const today = todayIso();

  function runSync() {
    setResult(undefined);
    setStep(0);
    timers.current.push(window.setTimeout(() => setStep(1), 650));
    timers.current.push(window.setTimeout(() => setStep(2), 1300));
    timers.current.push(
      window.setTimeout(() => {
        const items = genCampaigns(project.code, p, rows);
        const at = new Date().toISOString();
        const entries: StatsEntry[] = [];
        for (const c of items) {
          const r = rows.find((x) => x.work.id === c.workId);
          if (r?.profile) entries.push(entryFor(r, p.id, c.id, at, today));
        }
        saveSync(project.id, p.id, at, items, entries);
        setStep(-1);
      }, 2050),
    );
  }

  function entryFor(r: DRow, platformId: string, campaignId: string, at: string, td: string): StatsEntry {
    return { workId: r.work.id, platformId, campaignId, syncedAt: at, planBudget: r.work.cost, days: simulate(r.work, r.profile!, td) };
  }

  function onReassign(campaignId: string, workId: string) {
    const r = rows.find((x) => x.work.id === workId);
    reassign(project.id, p.id, campaignId, workId, r?.profile ? entryFor(r, p.id, campaignId, new Date().toISOString(), today) : null);
  }

  const eligible = rows.filter((r) => {
    const e = stats[r.work.id];
    return e && !r.work.closed && r.work.periodEnd < today && e.days.length === daysBetween(r.work.periodStart, r.work.periodEnd) + 1;
  });

  function applyFinal() {
    const changes = eligible.map((r) => ({ op: "update" as const, id: r.work.id, patch: { cost: stats[r.work.id].days.reduce((a, d) => a + d.spend, 0), finalLoadedAt: new Date().toISOString() } }));
    const res = applyWorkChanges(project.id, changes, "final-import");
    setResult({
      ok: res.updated.map((id) => {
        const r = rows.find((x) => x.work.id === id);
        return `${r?.carrierName ?? id}: ${fmtMoney0(stats[id]?.days.reduce((a, d) => a + d.spend, 0))} грн`;
      }),
      errors: res.errors,
    });
  }

  const status = !conn ? (
    <Badge>не підключено</Badge>
  ) : state ? (
    <Badge tone="green">синхронізовано {fmtTime(state.syncedAt)}</Badge>
  ) : (
    <Badge tone="indigo">підключено</Badge>
  );

  return (
    <Card>
      <div className="flex items-start gap-3">
        <PlatformBadge p={p} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-display text-base font-semibold text-slate-900">{p.name}</h4>
            {status}
            {p.kind === "seller" && <Badge tone="sky">звіт продавця (API/файл)</Badge>}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {conn ? (
              <>
                Підключено як <b className="text-slate-700">{conn.accountName}</b> · {conn.accountId}
              </>
            ) : (
              <>Носії проєкту: {[...new Set(rows.map((r) => r.carrierName))].join(", ")}</>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!conn ? (
            <Button variant="primary" onClick={onConnect}>
              <PlugZap size={15} /> Підключити
            </Button>
          ) : (
            <>
              <Button variant="primary" disabled={step >= 0} onClick={runSync}>
                <RefreshCw size={15} className={clsx(step >= 0 && "animate-spin")} /> Синхронізувати
              </Button>
              <Button title="Відключити кабінет" onClick={() => disconnect(p.id)}>
                <Link2Off size={15} />
              </Button>
            </>
          )}
        </div>
      </div>

      {step >= 0 && (
        <ol className="mt-3 space-y-1.5 rounded-xl bg-violet-50/60 p-3 text-sm">
          {SYNC_STEPS.map((s, i) => (
            <li key={s} className={clsx("flex items-center gap-2", i > step ? "text-slate-400" : "text-slate-800")}>
              {i < step ? <CheckCircle2 size={16} className="text-emerald-500" /> : i === step ? <Loader2 size={16} className="animate-spin text-violet-600" /> : <span className="h-4 w-4 rounded-full border border-slate-300" />}
              {s}
            </li>
          ))}
          <div className="h-1.5 overflow-hidden rounded-full bg-violet-100">
            <div className="h-full rounded-full bg-juicy transition-all duration-500" style={{ width: `${((step + 1) / 3) * 100}%` }} />
          </div>
        </ol>
      )}

      {!state && step < 0 && <div className="mt-3 text-sm text-slate-500">{conn ? "Натисніть «Синхронізувати», щоб завантажити кампанії та статистику." : "Після підключення Аура зіставить кампанії кабінету з роботами медіаплану."}</div>}

      {state && (
        <div className="mt-3 space-y-3">
          <Table>
            <thead>
              <tr>
                <th>Кампанія в кабінеті</th>
                <th>Робота медіаплану</th>
                <th className="text-right">Збіг</th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((c) => (
                <tr key={c.id}>
                  <td className="font-mono text-xs text-slate-700">{c.name}</td>
                  <td>
                    <Select value={c.workId} onChange={(e) => onReassign(c.id, e.target.value)} className="!py-1 text-xs">
                      <option value="">— не зіставлено —</option>
                      {rows.map((r) => (
                        <option key={r.work.id} value={r.work.id}>
                          {r.carrierName} · {r.formatName} · {fmtDate(r.work.periodStart)}–{fmtDate(r.work.periodEnd)}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="text-right">{c.workId ? <Confidence v={c.confidence} /> : <span className="text-xs text-slate-400">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </Table>

          {eligible.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={applyFinal}>
                <Wallet size={15} /> Застосувати фактичні витрати як фінальні суми
              </Button>
              <span className="text-xs text-slate-500">Флайт завершено: {eligible.length} робіт. Сума в медіаплані стане фактичною витратою з кабінету.</span>
            </div>
          ) : (
            rows.some((r) => stats[r.work.id] && r.work.periodEnd < today) && <div className="text-xs text-slate-500">Для завершених флайтів фінальні суми вже застосовано або роботи закрито.</div>
          )}
          {result && (
            <Alert tone={result.errors.length ? "amber" : "green"}>
              {result.ok.length > 0 && (
                <div>
                  Фінальні суми застосовано до {result.ok.length} робіт: {result.ok.join("; ")}. Прапорець «сума фінальна» не встановлено: закриття робіт залишається окремою дією у медіаплані.
                </div>
              )}
              {result.errors.map((e) => (
                <div key={e}>{e}</div>
              ))}
            </Alert>
          )}
        </div>
      )}
    </Card>
  );
}

function Confidence({ v }: { v: number }) {
  const tone = v >= 0.9 ? "green" : v >= 0.75 ? "sky" : "amber";
  return <Badge tone={tone}>{fmtPct(v).replace(",0", "")}</Badge>;
}

function ConnectModal({ p, clientName, onClose }: { p?: Platform; clientName: string; onClose: () => void }) {
  const connect = useDigital((s) => s.connect);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [acc, setAcc] = useState(0);
  useEffect(() => {
    setStep(1);
    setBusy(false);
    setAcc(0);
  }, [p?.id]);
  const accounts = useMemo(() => (p ? genAccounts(p, clientName) : []), [p, clientName]);
  if (!p) return null;

  function login() {
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      setStep(2);
    }, 1100);
  }
  function finish() {
    connect(p!.id, { accountId: accounts[acc].id, accountName: accounts[acc].name, connectedAt: new Date().toISOString() });
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <PlatformBadge p={p} size={28} /> Підключення: {p.name}
        </span>
      }
      footer={
        step === 3 ? (
          <>
            <Button onClick={() => setStep(2)}>Назад</Button>
            <Button variant="primary" onClick={finish}>
              <ShieldCheck size={15} /> Дозволити й підключити
            </Button>
          </>
        ) : step === 2 ? (
          <>
            <Button onClick={onClose}>Скасувати</Button>
            <Button variant="primary" onClick={() => setStep(3)}>
              Далі
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Скасувати</Button>
        )
      }
    >
      <ol className="mb-4 flex items-center gap-2 text-xs font-semibold">
        {["Вхід", p.kind === "seller" ? "Договір" : "Акаунт", "Дозволи"].map((l, i) => (
          <li key={l} className={clsx("flex items-center gap-1.5 rounded-full px-2.5 py-1", step === i + 1 ? "bg-violet-600 text-white" : step > i + 1 ? "bg-lime-100 text-emerald-800" : "bg-slate-100 text-slate-500")}>
            {step > i + 1 ? <CheckCircle2 size={13} /> : <span>{i + 1}</span>} {l}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div className="space-y-3 text-center">
          <div className="mx-auto flex justify-center"><IconBubble icon={PlugZap} gradient="violet" size="lg" /></div>
          <p className="text-sm text-slate-600">Відкриється вікно {p.name} для входу та надання доступу. Це імітація: реальні дані не передаються.</p>
          <Button variant="primary" disabled={busy} onClick={login} className="w-full justify-center">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <PlugZap size={16} />} {p.loginLabel}
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-slate-800">Оберіть {p.accountLabel}</div>
          {accounts.map((a, i) => (
            <label key={a.id} className={clsx("flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm", acc === i ? "border-violet-400 bg-violet-50" : "border-slate-200 hover:bg-violet-50/40")}>
              <input type="radio" name="acc" checked={acc === i} onChange={() => setAcc(i)} className="accent-violet-600" />
              <span className="font-semibold text-slate-800">{a.name}</span>
              <span className="ml-auto font-mono text-xs text-slate-500">({a.id})</span>
            </label>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <div className="text-sm font-semibold text-slate-800">Аура 6 запитує такі дозволи</div>
          <div className="flex items-center gap-2 rounded-xl border border-lime-300 bg-lime-50 px-3 py-2.5 text-sm text-emerald-900">
            <Lock size={16} className="shrink-0" />
            <span>{p.scope}</span>
            <Badge tone="green">лише читання</Badge>
          </div>
          <p className="text-xs text-slate-500">Керувати кампаніями, бюджетами чи оплатою Аура не зможе: доступ тільки до звітної статистики.</p>
          <Alert tone="sky">У робочій системі токен зберігається на сервері Аури, а не в браузері; модель доступу не має.</Alert>
        </div>
      )}
    </Modal>
  );
}
