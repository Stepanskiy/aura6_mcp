import type { MediaType, Refs, Work } from "../../domain/types";

/** Вид медіа роботи: з виду робіт, інакше з носія. */
export function mediaOfWork(w: Work, refs: { workTypes: Map<string, Refs["workTypes"][number]>; carriers: Map<string, Refs["carriers"][number]> }): MediaType | undefined {
  return refs.workTypes.get(w.workTypeId)?.mediaType ?? (w.carrierId ? refs.carriers.get(w.carrierId)?.mediaType : undefined);
}

/** Валідована категоріальна палітра для графіків (dataviz reference, світла тема), фіксований порядок. */
export const CHART_SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"] as const;
/** Колір «плану» поруч із фактом: нейтральний, щоб факт був головним. */
export const CHART_PLAN = "#b9b8b0";
export const CHART_GRID = "#e8e7e1";
