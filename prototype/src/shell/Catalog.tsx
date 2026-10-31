import { Link } from "react-router-dom";
import { useMemo } from "react";
import {
  ArrowUpRight,
  BarChart3,
  FilePlus2,
  FileSpreadsheet,
  FolderKanban,
  ListChecks,
  MessageCircleHeart,
  RefreshCcw,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useStore } from "../store";
import { fmtMoney0, fmtPct, totals } from "../domain/calc";
import { useInvoiced } from "./hooks";
import { GRADIENTS, IconBubble, Stat, clsx, type GradientName, type Icon } from "../ui";

interface Tile {
  to: string;
  title: string;
  text: string;
  group: string;
  icon: Icon;
  gradient: GradientName;
  tag?: string;
}

const TILES: Tile[] = [
  { group: "Проєкти", to: "/projects", title: "Проєкти", text: "Медіаплан, маржа, версії плану, історія змін", icon: FolderKanban, gradient: "violet" },
  { group: "Проєкти", to: "/projects/new", title: "Новий проєкт", text: "З нуля або копією вдалої кампанії", icon: FilePlus2, gradient: "fuchsia" },
  { group: "Дані", to: "/import?mode=budget", title: "Імпорт бюджетів", text: "Excel будь-якого формату: модель розбирає структуру", icon: FileSpreadsheet, gradient: "lime", tag: "AI" },
  { group: "Дані", to: "/import?mode=final", title: "Фінальні суми", text: "Ефірні довідки й акти — факт по роботах", icon: RefreshCcw, gradient: "teal" },
  { group: "Фінанси", to: "/invoices/new", title: "Рахунок клієнту", text: "За період, кілька брендів — один документ", icon: Wand2, gradient: "orange" },
  { group: "Фінанси", to: "/invoices/reconciliation", title: "Звірка", text: "План — виставлено — не виставлено", icon: ListChecks, gradient: "amber" },
  { group: "Аналітика", to: "/reports", title: "Конструктор звітів", text: "Клієнти, бренди, носії, місяці — будь-які розрізи", icon: BarChart3, gradient: "cyan" },
  { group: "Аналітика", to: "/chat", title: "Чат-помічник", text: "Скажіть, що потрібно, — відкриє потрібний екран", icon: MessageCircleHeart, gradient: "rose", tag: "AI" },
];

export function Catalog() {
  const s = useStore();
  const invoiced = useInvoiced();
  const t = useMemo(() => totals(s.works, invoiced), [s.works, invoiced]);
  const groups = [...new Set(TILES.map((x) => x.group))];
  const first = (s.session.user ?? "").split(/\s+/)[0];
  const active = s.projects.filter((p) => p.status === "active").length;
  return (
    <div className="mx-auto max-w-7xl px-6 py-7">
      <section className="relative mb-7 overflow-hidden rounded-3xl bg-[#1b0d38] px-8 py-9 text-white shadow-2xl shadow-violet-900/30">
        <div className="blob absolute -left-16 -top-20 h-72 w-72 rounded-full bg-violet-500/60" />
        <div className="blob absolute right-10 -top-16 h-72 w-72 rounded-full bg-fuchsia-500/50 [animation-delay:-5s]" />
        <div className="blob absolute -bottom-24 right-1/3 h-72 w-72 rounded-full bg-orange-400/40 [animation-delay:-9s]" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold ring-1 ring-white/20">
              <Sparkles size={14} className="text-lime-300" /> {s.settings.agencyName}
            </div>
            <h1 className="font-display text-4xl font-semibold leading-tight">
              Привіт{first ? `, ${first}` : ""}!{" "}
              <span className="bg-gradient-to-r from-lime-300 via-cyan-300 to-fuchsia-300 bg-clip-text text-transparent">Що запускаємо?</span>
            </h1>
            <p className="mt-2 max-w-xl text-violet-100/80">
              {active} активних кампаній · маржа {fmtPct(t.marginPct)} · {fmtMoney0(t.uninvoiced)} грн чекають на рахунок
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/import?mode=budget" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-violet-800 shadow-lg transition hover:-translate-y-0.5">
              <FileSpreadsheet size={17} /> Завантажити Excel
            </Link>
            <Link to="/chat" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white ring-1 ring-white/25 transition hover:bg-white/20">
              <MessageCircleHeart size={17} /> Спитати помічника
            </Link>
          </div>
        </div>
      </section>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Проєктів" value={s.projects.length} sub={`${s.works.length} робіт у медіапланах`} />
        <Stat label="Дохід, грн" value={fmtMoney0(t.income)} sub={`маржа ${fmtMoney0(t.margin)}`} />
        <Stat label="Виставлено, грн" value={fmtMoney0(t.invoiced)} sub={`ще не виставлено ${fmtMoney0(t.uninvoiced)}`} />
        <Stat label="Закрито, грн" value={fmtMoney0(t.closedIncome)} sub="фінальні суми доходу" />
      </div>

      {groups.map((g) => (
        <div key={g} className="mb-7">
          <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-widest text-violet-900/60">{g}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TILES.filter((x) => x.group === g).map((x) => (
              <Link
                key={x.to}
                to={x.to}
                className="group relative overflow-hidden rounded-2xl border border-white/70 bg-white/90 p-5 shadow-[0_8px_30px_-14px_rgba(122,44,245,0.25)] ring-1 ring-violet-100/60 transition duration-200 hover:-translate-y-1 hover:shadow-[0_20px_40px_-16px_rgba(217,70,239,0.45)]"
              >
                <div className={clsx("pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-20 blur-2xl transition duration-300 group-hover:scale-150 group-hover:opacity-40", GRADIENTS[x.gradient])} />
                <div className="relative mb-4 flex items-start justify-between">
                  <IconBubble icon={x.icon} gradient={x.gradient} className="transition duration-200 group-hover:rotate-[-6deg] group-hover:scale-110" />
                  <span className="flex items-center gap-1.5">
                    {x.tag && <span className="rounded-full bg-gradient-to-r from-lime-300 to-cyan-300 px-2 py-0.5 text-[10px] font-extrabold text-[#160b2e]">{x.tag}</span>}
                    <ArrowUpRight size={18} className="text-slate-300 transition group-hover:text-fuchsia-500" />
                  </span>
                </div>
                <div className="relative font-display text-[15px] font-semibold text-slate-900">{x.title}</div>
                <div className="relative mt-1 text-sm text-slate-500">{x.text}</div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
