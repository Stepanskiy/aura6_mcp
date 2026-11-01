// Спільні UI-компоненти. Tailwind + lucide-react. Креативна тема: градієнти, насичені акценти, іконки.
import clsx from "clsx";
import type { ButtonHTMLAttributes, ComponentType, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  FileSpreadsheet,
  ListChecks,
  Settings,
  CheckCircle2,
  CircleDollarSign,
  FileClock,
  FolderKanban,
  Info,
  Layers,
  Percent,
  Receipt,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
  X,
  XCircle,
  type LucideProps,
} from "lucide-react";
import { fmtMoney, fmtMoney0 } from "../domain/calc";

export { clsx };
export type Icon = ComponentType<LucideProps>;

/** Палітра градієнтів для іконок і плиток. */
export const GRADIENTS = {
  violet: "from-violet-500 to-indigo-600",
  fuchsia: "from-fuchsia-500 to-pink-500",
  orange: "from-orange-400 to-rose-500",
  lime: "from-lime-400 to-emerald-500",
  cyan: "from-cyan-400 to-sky-600",
  amber: "from-amber-300 to-orange-500",
  rose: "from-rose-500 to-fuchsia-600",
  teal: "from-teal-400 to-cyan-600",
} as const;
export type GradientName = keyof typeof GRADIENTS;

/** Іконка у градієнтній «бульбашці». */
export function IconBubble({ icon: I, gradient = "violet", size = "md", className }: { icon: Icon; gradient?: GradientName; size?: "sm" | "md" | "lg"; className?: string }) {
  const s = size === "sm" ? "h-8 w-8 rounded-lg" : size === "lg" ? "h-14 w-14 rounded-2xl" : "h-10 w-10 rounded-xl";
  const is = size === "sm" ? 16 : size === "lg" ? 28 : 20;
  return (
    <span className={clsx("grid shrink-0 place-items-center bg-gradient-to-br text-white shadow-lg shadow-fuchsia-500/20", GRADIENTS[gradient], s, className)}>
      <I size={is} strokeWidth={2.2} />
    </span>
  );
}

/** Іконка й колір сторінки за її назвою, щоб модулі не дублювали оформлення. */
function pageLook(title: ReactNode): { icon: Icon; gradient: GradientName } | undefined {
  const t = typeof title === "string" ? title.toLowerCase() : "";
  if (!t) return undefined;
  if (t.includes("звірк")) return { icon: ListChecks, gradient: "amber" };
  if (t.includes("рахун") || t.includes("замовлення")) return { icon: Receipt, gradient: "orange" };
  if (t.includes("імпорт")) return { icon: FileSpreadsheet, gradient: "lime" };
  if (t.includes("звіт") || t.includes("конструктор")) return { icon: BarChart3, gradient: "cyan" };
  if (t.includes("чат")) return { icon: Sparkles, gradient: "rose" };
  if (t.includes("налаштув")) return { icon: Settings, gradient: "teal" };
  if (t.includes("проєкт")) return { icon: FolderKanban, gradient: "violet" };
  return undefined;
}

export function Page({ title, subtitle, actions, children, icon, gradient }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; icon?: Icon; gradient?: GradientName }) {
  const look = pageLook(title);
  const I = icon ?? look?.icon;
  return (
    <div className="mx-auto max-w-7xl px-6 py-7">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          {I && <IconBubble icon={I} size="lg" gradient={gradient ?? look?.gradient ?? "fuchsia"} />}
          <div>
            <h1 className="font-display text-[26px] font-semibold leading-tight text-slate-900">{title}</h1>
            {subtitle && <div className="mt-1.5 max-w-3xl text-sm text-slate-500">{subtitle}</div>}
          </div>
        </div>
        {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("rounded-2xl border border-white/70 bg-white/85 shadow-[0_8px_30px_-12px_rgba(122,44,245,0.18)] ring-1 ring-violet-100/60 backdrop-blur", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-violet-100/70 px-5 py-3.5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <span className="h-4 w-1.5 rounded-full bg-juicy" />
            {title}
          </h2>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({ variant = "secondary", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100",
        variant === "primary" && "bg-juicy text-white shadow-lg shadow-fuchsia-500/30 hover:shadow-xl hover:shadow-fuchsia-500/40 hover:brightness-110",
        variant === "secondary" && "border border-violet-200 bg-white text-slate-700 shadow-sm hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700",
        variant === "ghost" && "text-slate-600 hover:bg-violet-50 hover:text-violet-700",
        variant === "danger" && "border border-rose-200 bg-white text-rose-600 hover:bg-rose-50",
        className,
      )}
    />
  );
}

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={clsx("block text-sm", className)}>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-violet-200/80 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 hover:border-violet-300 focus:border-fuchsia-400 focus:ring-4 focus:ring-fuchsia-100";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(inputCls, className)} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={clsx(inputCls, className)}>
      {children}
    </select>
  );
}

type Tone = "slate" | "green" | "amber" | "red" | "indigo" | "sky";

export function Badge({ tone = "slate", children }: { tone?: Tone; children: ReactNode }) {
  const tones: Record<Tone, string> = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    green: "bg-lime-100 text-emerald-800 ring-lime-300",
    amber: "bg-amber-100 text-amber-800 ring-amber-300",
    red: "bg-rose-100 text-rose-700 ring-rose-300",
    indigo: "bg-violet-100 text-violet-700 ring-violet-300",
    sky: "bg-cyan-100 text-cyan-800 ring-cyan-300",
  };
  return <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset", tones[tone])}>{children}</span>;
}

/** Сума з вирівнюванням праворуч; від’ємні — червоним. */
export function Money({ value, whole, className }: { value: number | undefined; whole?: boolean; className?: string }) {
  const v = value ?? 0;
  return <span className={clsx("tabular-nums", v < 0 && "text-rose-600", className)}>{whole ? fmtMoney0(v) : fmtMoney(v)}</span>;
}

/** Іконка й колір плитки показника — за змістом підпису, щоб усі модулі виглядали узгоджено. */
function statLook(label: ReactNode): { icon: Icon; gradient: GradientName } {
  const t = typeof label === "string" ? label.toLowerCase() : "";
  if (t.includes("не виставл")) return { icon: FileClock, gradient: "orange" };
  if (t.includes("виставл")) return { icon: Receipt, gradient: "cyan" };
  if (t.includes("закрит")) return { icon: BadgeCheck, gradient: "lime" };
  if (t.includes("марж") && t.includes("%")) return { icon: Percent, gradient: "fuchsia" };
  if (t.includes("марж")) return { icon: Sparkles, gradient: "fuchsia" };
  if (t.includes("затрат") || t.includes("витрат") || t.includes("вартіст")) return { icon: Wallet, gradient: "rose" };
  if (t.includes("план")) return { icon: Target, gradient: "amber" };
  if (t.includes("дохід") || t.includes("сума") || t.includes("пдв")) return { icon: TrendingUp, gradient: "violet" };
  if (t.includes("проєкт")) return { icon: FolderKanban, gradient: "violet" };
  if (t.includes("робіт") || t.includes("рядк")) return { icon: Layers, gradient: "teal" };
  if (t.includes("клієнт") || t.includes("довідник")) return { icon: Users, gradient: "cyan" };
  return { icon: CircleDollarSign, gradient: "violet" };
}

export function Stat({ label, value, sub, icon, gradient }: { label: ReactNode; value: ReactNode; sub?: ReactNode; icon?: Icon; gradient?: GradientName }) {
  const look = statLook(label);
  const g = gradient ?? look.gradient;
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/70 bg-white/90 px-4 py-3.5 shadow-[0_8px_30px_-14px_rgba(122,44,245,0.25)] ring-1 ring-violet-100/60 transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-14px_rgba(217,70,239,0.35)]">
      <div className={clsx("pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-gradient-to-br opacity-15 blur-xl transition group-hover:opacity-30", GRADIENTS[g])} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
          <div className="mt-1 text-[22px] font-extrabold tabular-nums leading-tight tracking-tight text-slate-900">{value}</div>
          {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
        </div>
        <IconBubble icon={icon ?? look.icon} gradient={g} size="sm" />
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-violet-200 bg-white/70 p-10 text-center text-sm text-slate-500">
      <IconBubble icon={Sparkles} gradient="fuchsia" />
      <div>{children}</div>
    </div>
  );
}

export function Alert({ tone = "amber", children }: { tone?: "amber" | "red" | "green" | "sky"; children: ReactNode }) {
  const tones = {
    amber: { cls: "border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-900", I: AlertTriangle, ic: "text-amber-500" },
    red: { cls: "border-rose-300 bg-gradient-to-r from-rose-50 to-pink-50 text-rose-900", I: XCircle, ic: "text-rose-500" },
    green: { cls: "border-lime-300 bg-gradient-to-r from-lime-50 to-emerald-50 text-emerald-900", I: CheckCircle2, ic: "text-emerald-500" },
    sky: { cls: "border-cyan-300 bg-gradient-to-r from-cyan-50 to-violet-50 text-cyan-900", I: Info, ic: "text-cyan-500" },
  }[tone];
  return (
    <div className={clsx("flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm", tones.cls)}>
      <tones.I size={18} className={clsx("mt-px shrink-0", tones.ic)} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Таблиця з єдиним стилем. th/td стилізуються класами нижче. */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("overflow-auto rounded-xl border border-violet-100 bg-white", className)}>
      <table className="min-w-full text-sm [&_tbody_tr]:transition [&_tbody_tr:hover]:bg-violet-50/50 [&_td]:border-t [&_td]:border-violet-50 [&_td]:px-2.5 [&_td]:py-2 [&_th]:bg-gradient-to-b [&_th]:from-violet-50 [&_th]:to-fuchsia-50/40 [&_th]:px-2.5 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-violet-900/70">
        {children}
      </table>
    </div>
  );
}

export function Modal({ open, title, onClose, children, footer, wide }: { open: boolean; title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-violet-950/40 p-6 backdrop-blur-sm" onMouseDown={onClose}>
      <div className={clsx("mt-10 w-full overflow-hidden rounded-2xl bg-white shadow-2xl shadow-violet-900/30", wide ? "max-w-5xl" : "max-w-lg")} onMouseDown={(e) => e.stopPropagation()}>
        <div className="h-1.5 bg-juicy" />
        <div className="flex items-center justify-between border-b border-violet-100 px-5 py-3.5">
          <h3 className="font-display font-semibold">{title}</h3>
          <button className="rounded-lg p-1 text-slate-400 hover:bg-violet-50 hover:text-violet-700" onClick={onClose} aria-label="Закрити">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-violet-100 bg-violet-50/40 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
