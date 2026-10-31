// Памʼять відповідностей довідників між імпортами («Ютуб» → «YouTube»): наступний файл
// з тими самими назвами зіставляється без моделі. Зберігається в браузері поруч із даними демо.
import type { DictKind } from "./fields";
import type { Aliases } from "./resolve";

const KEY = "aura6-import-aliases";

export function loadAliases(): Aliases {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Aliases;
  } catch {
    return {};
  }
}

export function saveAliases(add: Aliases): void {
  try {
    const cur = loadAliases();
    for (const k of Object.keys(add) as DictKind[]) cur[k] = { ...(cur[k] ?? {}), ...add[k] };
    localStorage.setItem(KEY, JSON.stringify(cur));
  } catch {
    /* сховище недоступне — не критично */
  }
}
