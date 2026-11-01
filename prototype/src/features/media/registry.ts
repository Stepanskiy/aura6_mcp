// Реєстр медійних вкладок. Нова вкладка = новий модуль + рядок тут; картка проєкту не змінюється.
import type { ProjectView } from "./types";
import { oohMapView } from "./ooh";
import { flowchartView } from "./flowchart";
import { digitalKpiView, digitalConnectorsView } from "./digital";

export const PROJECT_VIEWS: ProjectView[] = [flowchartView, oohMapView, digitalKpiView, digitalConnectorsView];

export type { ProjectView, ProjectViewProps } from "./types";
