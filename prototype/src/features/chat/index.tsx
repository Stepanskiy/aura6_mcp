// Помічник живе в бічній панелі (ChatPanel), яку монтує Layout. Маршрут /chat лише відкриває панель —
// щоб посилання з каталогу та запуски «відкрий помічника» працювали як раніше.
import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useChatPanel } from "./panelState";

export { ChatPanel, ChatFab, CHAT_PANEL_WIDTH } from "./ChatPanel";
export { useChatPanel } from "./panelState";

export function ChatApp() {
  const setOpen = useChatPanel((s) => s.setOpen);
  useEffect(() => setOpen(true), [setOpen]);
  return <Navigate to="/" replace />;
}
