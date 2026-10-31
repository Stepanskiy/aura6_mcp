import { useMemo } from "react";
import { useStore } from "../../store";
import { useRefs } from "../../shell/hooks";
import { byId } from "../../domain/calc";
import type { Dict } from "./util";

export function useDict(): Dict {
  return useRefs() as unknown as Dict;
}

export function useWorksMap() {
  const works = useStore((s) => s.works);
  return useMemo(() => byId(works), [works]);
}
