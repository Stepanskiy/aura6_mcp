import { NavLink, Outlet } from "react-router-dom";
import { BarChart3, FileSpreadsheet, FolderKanban, LayoutGrid, LogOut, Receipt, Settings, Sparkles } from "lucide-react";
import { useStore } from "../store";
import { CHAT_PANEL_WIDTH, ChatFab, ChatPanel, useChatPanel } from "../features/chat";
import { clsx, type Icon } from "../ui";
import { A6_PATH, A6_VIEWBOX } from "./a6-path";

const NAV: { to: string; label: string; icon: Icon; end?: boolean }[] = [
  { to: "/", label: "Каталог", icon: LayoutGrid, end: true },
  { to: "/projects", label: "Проєкти", icon: FolderKanban },
  { to: "/import", label: "Імпорт", icon: FileSpreadsheet },
  { to: "/invoices", label: "Рахунки", icon: Receipt },
  { to: "/reports", label: "Звіти", icon: BarChart3 },
];

/** Знак «А6» без фону. Колір — currentColor або градієнт (gradient). */
export function A6Mark({ className, gradient, title }: { className?: string; gradient?: boolean; title?: string }) {
  const id = "a6g";
  return (
    <svg viewBox={A6_VIEWBOX} className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {gradient && (
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#a678ff" />
            <stop offset=".5" stopColor="#f0abfc" />
            <stop offset="1" stopColor="#ffb38a" />
          </linearGradient>
        </defs>
      )}
      <path fill={gradient ? `url(#${id})` : "currentColor"} d={A6_PATH} />
    </svg>
  );
}

/** Іконка застосунку: градієнтний квадрат з білим знаком. */
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <span className="relative grid place-items-center rounded-[30%] bg-juicy text-white shadow-lg shadow-fuchsia-500/40" style={{ width: size, height: size }}>
      <A6Mark className="w-[72%]" title="Аура 6" />
      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-lime-300 ring-2 ring-[#160b2e]" />
    </span>
  );
}

export function Layout() {
  const user = useStore((s) => s.session.user);
  const logout = useStore((s) => s.logout);
  const agency = useStore((s) => s.settings.agencyName);
  const chatOpen = useChatPanel((s) => s.open);
  const toggleChat = useChatPanel((s) => s.toggle);
  const initials = (user ?? "?").split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-40 border-b border-white/10 bg-[#160b2e]/95 text-white shadow-lg shadow-violet-950/20 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-5 px-6">
          <NavLink to="/" className="flex items-center gap-2.5">
            <A6Mark gradient className="h-9 w-auto drop-shadow-[0_2px_10px_rgba(217,70,239,0.55)] transition hover:scale-105" title="Аура 6" />
            <span className="leading-tight">
              <span className="block font-display text-[15px] font-semibold">Аура 6</span>
              <span className="hidden text-[11px] text-violet-200/70 md:block">{agency}</span>
            </span>
          </NavLink>
          <nav className="flex flex-1 gap-1 overflow-x-auto">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-semibold transition",
                    isActive ? "bg-juicy text-white shadow-md shadow-fuchsia-500/30" : "text-violet-100/80 hover:bg-white/10 hover:text-white",
                  )
                }
              >
                <n.icon size={16} strokeWidth={2.3} />
                <span className="hidden lg:inline">{n.label}</span>
              </NavLink>
            ))}
          </nav>
          <button
            onClick={toggleChat}
            title="Помічник"
            className={clsx(
              "flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-semibold transition",
              chatOpen ? "bg-white text-violet-800 shadow-md" : "bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20",
            )}
          >
            <Sparkles size={16} strokeWidth={2.3} />
            <span className="hidden lg:inline">Помічник</span>
          </button>
          <NavLink to="/settings" title="Налаштування" className={({ isActive }) => clsx("rounded-xl p-2 transition hover:bg-white/10", isActive ? "text-lime-300" : "text-violet-100/80")}>
            <Settings size={18} />
          </NavLink>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-lime-300 to-cyan-400 text-xs font-bold text-[#160b2e]">{initials}</span>
            <span className="hidden text-sm text-violet-100 xl:inline">{user}</span>
          </div>
          <button className="rounded-xl p-2 text-violet-200/70 transition hover:bg-white/10 hover:text-white" onClick={logout} title="Вийти">
            <LogOut size={17} />
          </button>
        </div>
      </header>
      <main className="transition-[padding] duration-300" style={chatOpen ? { paddingRight: CHAT_PANEL_WIDTH } : undefined}>
        <Outlet />
      </main>
      <ChatPanel />
      <ChatFab />
    </div>
  );
}
