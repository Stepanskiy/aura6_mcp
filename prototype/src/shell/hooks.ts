import { useMemo } from "react";
import { useStore } from "../store";
import { byId, invoicedByWork, normName } from "../domain/calc";

/** Довідники з картами id → запис. */
export function useRefs() {
  const s = useStore();
  return useMemo(
    () => ({
      clients: byId(s.clients),
      brands: byId(s.brands),
      contractors: byId(s.contractors),
      carriers: byId(s.carriers),
      formats: byId(s.formats),
      directions: byId(s.directions),
      workTypes: byId(s.workTypes),
      managers: byId(s.managers),
      projects: byId(s.projects),
    }),
    [s.clients, s.brands, s.contractors, s.carriers, s.formats, s.directions, s.workTypes, s.managers, s.projects],
  );
}

/** Виставлено по роботах. */
export function useInvoiced() {
  const invoices = useStore((s) => s.invoices);
  return useMemo(() => invoicedByWork(invoices), [invoices]);
}

/**
 * Знайти запис за підказкою користувача: точний збіг, потім початок назви, потім входження.
 * Повертає один запис або undefined, якщо збігів немає чи їх кілька однаково добрих.
 */
export function resolveHint<T extends { id: string; name: string }>(items: T[], hint: string | null | undefined): T | undefined {
  if (!hint) return undefined;
  const h = normName(hint);
  const exact = items.filter((x) => normName(x.name) === h);
  if (exact.length === 1) return exact[0];
  const starts = items.filter((x) => normName(x.name).startsWith(h));
  if (starts.length === 1) return starts[0];
  const inc = items.filter((x) => normName(x.name).includes(h));
  if (inc.length === 1) return inc[0];
  return undefined;
}
