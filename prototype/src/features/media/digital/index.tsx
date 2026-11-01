// Цифрові вкладки картки проєкту: ефективність (план/факт) та рекламні кабінети.
import { Gauge, PlugZap } from "lucide-react";
import type { ProjectView } from "../types";
import { ConnectorsTab } from "./ConnectorsTab";
import { KpiTab } from "./KpiTab";

const hasDigital: ProjectView["applies"] = (works, mediaOf) => works.some((w) => mediaOf(w) === "Digital");

export const digitalKpiView: ProjectView = {
  id: "kpi",
  title: "Ефективність",
  icon: Gauge,
  badge: "Digital",
  applies: hasDigital,
  Component: KpiTab,
};

export const digitalConnectorsView: ProjectView = {
  id: "cabinets",
  title: "Рекламні кабінети",
  icon: PlugZap,
  applies: hasDigital,
  Component: ConnectorsTab,
};
