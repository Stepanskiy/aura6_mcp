// Контракт медійних вкладок картки проєкту. Картка показує вкладку, лише якщо вона застосовна
// до медіаплану проєкту: інтерфейс варіюється за типом медіа, ядро даних — те саме.
import type { ComponentType } from "react";
import type { MediaType, Project, Work } from "../../domain/types";
import type { Icon } from "../../ui";

export interface ProjectViewProps {
  project: Project;
  works: Work[];
}

export interface ProjectView {
  /** Ідентифікатор вкладки в ?tab=. */
  id: string;
  title: string;
  icon: Icon;
  /** Короткий підпис-бейдж біля назви вкладки, напр. «OOH». */
  badge?: string;
  /** Чи показувати вкладку для цього проєкту. mediaOf — вид медіа кожної роботи. */
  applies(works: Work[], mediaOf: (w: Work) => MediaType | undefined): boolean;
  Component: ComponentType<ProjectViewProps>;
}
