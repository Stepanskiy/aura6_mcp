import { Badge } from "../../ui";
import type { ChangeSource, ProjectStatus } from "../../domain/types";

export const STATUS_LABEL: Record<ProjectStatus, string> = { draft: "Чернетка", active: "Активний", closed: "Закритий" };

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const tone = status === "active" ? "green" : status === "closed" ? "indigo" : "slate";
  return <Badge tone={tone}>{STATUS_LABEL[status]}</Badge>;
}

export const SOURCE_LABEL: Record<ChangeSource, string> = { manual: "вручну", import: "імпорт", "final-import": "фінальні суми", seed: "демо" };

export function SourceBadge({ source }: { source: ChangeSource }) {
  const tone = source === "manual" ? "sky" : source === "import" ? "indigo" : source === "final-import" ? "green" : "slate";
  return <Badge tone={tone}>{SOURCE_LABEL[source]}</Badge>;
}

export function period(a?: string, b?: string): string {
  const f = (s?: string) => (s ? s.slice(0, 10).split("-").reverse().join(".") : "");
  if (!a && !b) return "";
  return `${f(a)} – ${f(b)}`;
}
