import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { useStore } from "./store";
import { Layout } from "./shell/Layout";
import { Login } from "./shell/Login";
import { Catalog } from "./shell/Catalog";
import { SettingsPage } from "./shell/Settings";
import { ProjectsApp } from "./features/projects";
import { ImportApp } from "./features/import";
import { InvoicesApp } from "./features/invoices";
import { ReportsApp } from "./features/reports";
import { ChatApp } from "./features/chat";

export default function App() {
  const user = useStore((s) => s.session.user);
  if (!user) return <Login />;
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Catalog />} />
          <Route path="projects/*" element={<ProjectsApp />} />
          <Route path="import/*" element={<ImportApp />} />
          <Route path="invoices/*" element={<InvoicesApp />} />
          <Route path="reports/*" element={<ReportsApp />} />
          <Route path="chat" element={<ChatApp />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
