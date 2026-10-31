// Помічник у бічній панелі праворуч: доступний з будь-якої SPA. Модель — навігатор, даних обліку не бачить.
// Запущений застосунок відкривається ліворуч, розмова лишається на місці.
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, MessageCircleHeart, SendHorizontal, Sparkles, Trash2, X } from "lucide-react";
import { useStore } from "../../store";
import { llmConfigured, type ChatMessage } from "../../llm/openrouter";
import { Alert, Badge, clsx } from "../../ui";
import { runTurn, type TurnInfo } from "./engine";
import { LaunchCard } from "./LaunchCard";
import { buildLaunch, describeScreen, parseArgs, systemPrompt, type ScreenContext } from "./tools";
import { useChatPanel } from "./panelState";

const EXAMPLES = [
  "Покажи проєкти Київстар за 2026 рік",
  "Відкрий проєкт KST-0015",
  "Створи проєкт для Rozetka, аналогічний RZT-0018",
  "Яка маржа по клієнтах за 3 квартал 2026?",
  "Що не виставлено по Епіцентр за вересень?",
  "Завантаж фінальні суми",
  "Виставити рахунок Rozetka за вересень",
];

// v2: у v1 автовідкриття було вимкнене за замовчуванням — старе значення не успадковуємо.
const KEY = "aura6.chat.v2";
interface Saved { messages: ChatMessage[]; turns: TurnInfo[]; error?: string; auto: boolean }

function load(): Saved {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Saved | null;
    if (s && Array.isArray(s.messages)) return { ...s, auto: s.auto ?? true };
  } catch { /* ignore */ }
  return { messages: [], turns: [], auto: true };
}
function save(s: Saved) {
  try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

/** Поточний екран з адреси: назва застосунку і коди. Тільки навігаційний контекст, без даних обліку. */
function screenOf(pathname: string, search: string): ScreenContext {
  const seg = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  let query = search.replace(/^[?]/, "") || undefined;
  try { if (query) query = decodeURIComponent(query); } catch { /* лишаємо як є */ }
  if (seg[0] === "projects") {
    if (!seg[1]) return { app: "список проєктів", query };
    if (seg[1] === "new") return { app: "форма нового проєкту", query };
    return { app: "картка проєкту", projectCode: seg[1], query };
  }
  if (seg[0] === "invoices") {
    if (!seg[1]) return { app: "список рахунків", query };
    if (seg[1] === "new") return { app: "форма нового рахунку", query };
    if (seg[1] === "reconciliation") return { app: "звірка рахунків", query };
    return { app: seg[2] === "print" ? "друкована форма рахунку" : "рахунок", invoice: seg[1], query };
  }
  if (seg[0] === "import") return { app: "імпорт з Excel", query };
  if (seg[0] === "reports") return { app: "конструктор звітів", query };
  if (seg[0] === "settings") return { app: "налаштування" };
  return { app: "каталог застосунків" };
}

/** Ширина панелі — Layout відступає на неї, щоб застосунок не ховався під панеллю. */
export const CHAT_PANEL_WIDTH = 420;

export function ChatPanel() {
  const { open, setOpen } = useChatPanel();
  const navigate = useNavigate();
  const location = useLocation();
  const screen = screenOf(location.pathname, location.search);
  const model = useStore((s) => s.settings.model);
  const key = useStore((s) => s.settings.openRouterKey);
  const configured = llmConfigured() || !!key;
  const [init] = useState(load);
  const [messages, setMessages] = useState<ChatMessage[]>(init.messages);
  const [turns, setTurns] = useState<TurnInfo[]>(init.turns);
  const [error, setError] = useState<string | undefined>(init.error);
  const [auto, setAuto] = useState(init.auto);
  const [view, setView] = useState<"chat" | "model">("chat");
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { save({ messages, turns, error, auto }); }, [messages, turns, error, auto]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages, busy, error, view, open]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && open) setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  async function send(content: string) {
    const t = content.trim();
    if (!t || busy) return;
    setText("");
    setError(undefined);
    setView("chat");
    const hist: ChatMessage[] = [...messages, { role: "user", content: t }];
    setMessages(hist);
    setBusy(true);
    const r = await runTurn(hist, screen);
    setMessages(r.messages);
    setTurns((prev) => [...prev, ...r.turns]);
    setError(r.error);
    setBusy(false);
    if (auto && r.launches.length) navigate(r.launches[0].url);
  }

  function reset() {
    setMessages([]); setTurns([]); setError(undefined);
  }

  const totalTokens = turns.reduce((s, t) => s + (t.usage?.prompt_tokens ?? 0) + (t.usage?.completion_tokens ?? 0), 0);

  return (
    <aside
      aria-hidden={!open}
      style={{ width: CHAT_PANEL_WIDTH }}
      className={clsx(
        "no-print fixed bottom-0 right-0 top-14 z-30 flex max-w-full flex-col border-l border-violet-200/70 bg-white/95 shadow-[-20px_0_40px_-20px_rgba(122,44,245,0.35)] backdrop-blur transition-transform duration-300",
        open ? "translate-x-0" : "pointer-events-none translate-x-full",
      )}
    >
      {/* Шапка панелі */}
      <div className="relative overflow-hidden bg-[#1b0d38] px-4 py-3 text-white">
        <div className="blob absolute -right-10 -top-14 h-36 w-36 rounded-full bg-fuchsia-500/50" />
        <div className="blob absolute -left-10 -bottom-16 h-32 w-32 rounded-full bg-violet-500/50 [animation-delay:-6s]" />
        <div className="relative flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-juicy shadow-lg shadow-fuchsia-500/40">
            <MessageCircleHeart size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[15px] font-semibold">Помічник</div>
            <div className="truncate text-[11px] text-violet-200/80" title="Модель бачить лише назву екрана і код з адресного рядка">Екран: {describeScreen(screen)}</div>
            <div className="truncate text-[11px] text-violet-200/60">{model} · {turns.length} запитів · {totalTokens} токенів</div>
          </div>
          <button title="Очистити розмову" onClick={reset} disabled={busy || !messages.length} className="rounded-lg p-1.5 text-violet-200 hover:bg-white/10 hover:text-white disabled:opacity-40">
            <Trash2 size={16} />
          </button>
          <button title="Закрити (Esc)" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-violet-200 hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="relative mt-3 flex items-center gap-1 rounded-xl bg-white/10 p-1 text-xs font-semibold">
          {([["chat", "Розмова", Sparkles], ["model", "Що бачила модель", Eye]] as const).map(([v, label, I]) => (
            <button key={v} onClick={() => setView(v)} className={clsx("flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 transition", view === v ? "bg-white text-violet-800 shadow" : "text-violet-100 hover:bg-white/10")}>
              <I size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      {!configured && (
        <div className="px-4 pt-3">
          <Alert tone="amber">Не задано ключ OpenRouter. <Link className="font-semibold underline" to="/settings">Налаштування</Link></Alert>
        </div>
      )}

      {/* Вміст */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {view === "chat" ? (
          <div className="space-y-3">
            {messages.length === 0 && (
              <div className="text-sm text-slate-500">
                <div className="mb-3 rounded-2xl bg-gradient-to-br from-violet-50 to-fuchsia-50 p-3.5 text-slate-600 ring-1 ring-violet-100">
                  Скажіть, що потрібно, — я відкрию потрібний застосунок з параметрами. Даних обліку я не бачу: цифри показує сам застосунок.
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLES.map((e) => (
                    <button key={e} disabled={!configured || busy} onClick={() => send(e)} className="rounded-full border border-violet-200 bg-white px-3 py-1 text-left text-xs font-medium text-slate-700 transition hover:border-fuchsia-400 hover:bg-fuchsia-50 hover:text-fuchsia-700 disabled:opacity-50">
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => {
              if (m.role === "user") return <Bubble key={i} mine>{m.content}</Bubble>;
              if (m.role === "assistant") {
                return (
                  <div key={i} className="space-y-2">
                    {m.content && <Bubble>{m.content}</Bubble>}
                    {m.tool_calls?.map((tc) => <LaunchCard key={tc.id} info={buildLaunch(tc.function.name, parseArgs(tc))} onOpen={(u) => navigate(u)} />)}
                  </div>
                );
              }
              return null;
            })}
            {busy && (
              <div className="flex items-center gap-1.5 pl-1 text-sm text-violet-500">
                <span className="h-2 w-2 animate-bounce rounded-full bg-violet-500" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-fuchsia-500 [animation-delay:120ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-orange-400 [animation-delay:240ms]" />
              </div>
            )}
            {error && <Alert tone="red">{error}</Alert>}
            <div ref={endRef} />
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="text-slate-600">Точний масив повідомлень, надісланий в OpenRouter у кожному запиті: системна інструкція, ваші слова й статуси «opened». Жодних даних обліку.</div>
            {(turns.length === 0 ? [{ sent: [{ role: "system", content: systemPrompt(new Date(), screen) }] as ChatMessage[], model, usage: undefined, fallback: false }] : turns).map((t, i) => (
              <div key={i}>
                <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs">
                  <Badge tone="indigo">{turns.length ? `запит ${i + 1}` : "системна інструкція"}</Badge>
                  {turns.length > 0 && <span className="text-slate-500">{t.usage?.prompt_tokens ?? "?"} / {t.usage?.completion_tokens ?? "?"} токенів</span>}
                  {t.fallback && <Badge tone="amber">JSON з тексту</Badge>}
                </div>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-[#160b2e] p-3 text-[11px] leading-relaxed text-violet-100">{JSON.stringify(t.sent, null, 2)}</pre>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Введення */}
      <form className="border-t border-violet-100 bg-white px-3 py-3" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
        <div className="flex items-end gap-2 rounded-2xl border border-violet-200 bg-white p-1.5 shadow-sm focus-within:border-fuchsia-400 focus-within:ring-4 focus-within:ring-fuchsia-100">
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); } }}
            disabled={!configured}
            placeholder="Яка маржа по Київстар за вересень?"
            className="max-h-32 min-h-[38px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none disabled:opacity-50"
          />
          <button type="submit" disabled={!configured || busy || !text.trim()} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-juicy text-white shadow-md shadow-fuchsia-500/30 transition hover:brightness-110 disabled:opacity-40">
            <SendHorizontal size={17} />
          </button>
        </div>
        <label className="mt-2 flex items-center gap-1.5 px-1 text-xs text-slate-500">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-fuchsia-600" /> одразу відкривати застосунок ліворуч
        </label>
      </form>
    </aside>
  );
}

/** Кругла кнопка виклику помічника, коли панель закрита. */
export function ChatFab() {
  const { open, setOpen } = useChatPanel();
  if (open) return null;
  return (
    <button
      onClick={() => setOpen(true)}
      title="Помічник"
      className="no-print fixed bottom-6 right-6 z-30 grid h-14 w-14 place-items-center rounded-2xl bg-juicy text-white shadow-xl shadow-fuchsia-500/40 transition hover:-translate-y-1 hover:rotate-[-6deg]"
    >
      <MessageCircleHeart size={26} />
      <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-lime-300 ring-2 ring-white" />
    </button>
  );
}

function Bubble({ mine, children }: { mine?: boolean; children: React.ReactNode }) {
  return (
    <div className={clsx("flex", mine && "justify-end")}>
      <div className={clsx("max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm", mine ? "rounded-br-md bg-juicy text-white shadow-md shadow-fuchsia-500/20" : "rounded-bl-md bg-violet-50 text-slate-800 ring-1 ring-violet-100")}>{children}</div>
    </div>
  );
}
