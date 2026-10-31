// Стан бічної панелі помічника: відкрита чи ні. Переживає переходи між SPA і перезавантаження вкладки.
import { create } from "zustand";

const KEY = "aura6.chat.panel";

interface PanelState {
  open: boolean;
  setOpen(v: boolean): void;
  toggle(): void;
}

const initial = (() => {
  try { return sessionStorage.getItem(KEY) === "1"; } catch { return false; }
})();

export const useChatPanel = create<PanelState>()((set, get) => ({
  open: initial,
  setOpen: (v) => {
    try { sessionStorage.setItem(KEY, v ? "1" : "0"); } catch { /* немає sessionStorage */ }
    set({ open: v });
  },
  toggle: () => get().setOpen(!get().open),
}));
