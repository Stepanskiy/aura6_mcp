// Перевірка чистої логіки імпорту на зразках із samples/ (без моделі: евристика + детермінований розбір).
// Запуск: node --experimental-strip-types scripts/test-import.ts
import { register } from "node:module";
import { readFileSync } from "node:fs";

// Імпорти в src без розширень (стиль Vite) — дописуємо «.ts» при розвʼязанні.
register(
  "data:text/javascript," +
    encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (e) {
    if ((spec.startsWith(".") || spec.startsWith("/")) && !/\\.[cm]?[jt]sx?$/.test(spec)) return next(spec + ".ts", ctx);
    throw e;
  }
}`),
  import.meta.url,
);

const { readWorkbook } = await import("../src/features/import/workbook.ts");
const { heuristicMapping, validateMapping } = await import("../src/features/import/mapping.ts");
const { extractRows, parseAmount, parseMonth, parseDate, SKIP_LABEL } = await import("../src/features/import/parse.ts");
const { collectResolution, resolutionItems } = await import("../src/features/import/resolve.ts");
const { buildBudgetPlan, buildFinalPlan, refsInUse } = await import("../src/features/import/plan.ts");
const { buildMappingPrompt } = await import("../src/features/import/prompts.ts");
const { createSeed } = await import("../src/data/seed.ts");

let fails = 0;
const eq = (name: string, got: unknown, exp: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  if (!ok) fails++;
  console.log(`${ok ? "  ok " : "  FAIL"} ${name}${ok ? "" : ` — got ${JSON.stringify(got)}, expected ${JSON.stringify(exp)}`}`);
};

console.log("Парсери:");
eq("amount 1 234 567,89", parseAmount("1 234 567,89"), 1234567.89);
eq("amount 1,234,567.89", parseAmount("1,234,567.89"), 1234567.89);
eq("amount 1.234.567,89", parseAmount("1.234.567,89"), 1234567.89);
eq("amount (1 200) грн", parseAmount("(1 200) грн"), -1200);
eq("amount 345 000", parseAmount("345 000"), 345000);
eq("amount nbsp", parseAmount(`1${String.fromCharCode(160)}234${String.fromCharCode(0x202f)}567,5`), 1234567.5);
eq("amount text", parseAmount("немає"), undefined);
eq("month лют.27", parseMonth("лют.27"), { start: "2027-02-01", end: "2027-02-28" });
eq("month березень 2027", parseMonth("березень 2027"), { start: "2027-03-01", end: "2027-03-31" });
eq("month 02.2027", parseMonth("02.2027"), { start: "2027-02-01", end: "2027-02-28" });
eq("month 2027-02", parseMonth("2027-02"), { start: "2027-02-01", end: "2027-02-28" });
eq("month Feb-27", parseMonth("Feb-27"), { start: "2027-02-01", end: "2027-02-28" });
eq("month листопад 2026", parseMonth("листопад 2026"), { start: "2026-11-01", end: "2026-11-30" });
eq("date serial 46398", parseDate(46398), "2027-01-11");
eq("date 15.02.2027", parseDate("15.02.2027"), "2027-02-15");

const seed = createSeed();
const files: [string, "budget" | "final"][] = [
  ["бюджети-формат-A.xlsx", "budget"],
  ["бюджети-формат-B.xlsx", "budget"],
  ["фінальні-суми.xlsx", "final"],
];

for (const [f, mode] of files) {
  const buf = readFileSync(new URL(`../samples/${f}`, import.meta.url));
  const sheets = readWorkbook(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, f);
  const sh = sheets[0];
  const m = heuristicMapping(sh.rows, sh.name);
  const v = validateMapping(m, sh.rows, mode);
  const ex = extractRows(sh.rows, m);
  console.log(`\n${f} [${mode}] аркуш «${sh.name}», рядків ${sh.rows.length}; заголовки — рядок ${m.headerRow + 1}, дані з ${m.firstDataRow + 1}`);
  console.log("  колонки:", Object.entries(m.columns).map(([i, fl]) => `${i}:${fl}`).join(" "));
  console.log("  помилки:", v.errors, "попередження:", v.warnings);
  const skipped = ex.skipped.filter((s) => s.reason !== "empty").map((s) => `r${s.rowIndex + 1} ${SKIP_LABEL[s.reason]}`);
  console.log(`  прочитано ${ex.rows.length}, пропущено: ${skipped.join(", ")}`);
  console.log(`  Σ дохід ${ex.rows.reduce((s, r) => s + (r.income ?? 0), 0)}, Σ затрата ${ex.rows.reduce((s, r) => s + (r.cost ?? 0), 0)}`);
  for (const r of ex.rows.slice(0, 3)) console.log("   ", r.rowIndex + 1, r.text.projectCode, r.text.workType, r.text.carrier, r.periodStart, r.periodEnd, r.income, r.cost, r.warnings.join("; "));
  const res = collectResolution(ex.rows, mode, seed);
  const items = resolutionItems(res);
  console.log(`  довідники: ${items.length} значень, точних ${items.filter((i) => i.via !== "default").length}; нерозвʼязані:`, items.filter((i) => i.via === "default").map((i) => `${i.kind}:${i.value}`).join(", "));
  if (mode === "budget") {
    const plan = buildBudgetPlan(ex.rows, res, seed, 10);
    console.log("  план:", JSON.stringify(plan.counts));
    for (const p of plan.projects) console.log(`   ${p.code} ${p.exists ? "оновлення" : "новий"} «${p.name}» рядків ${p.rows.length} [${p.rows.map((r) => r.status).join(",")}] ${p.errors.join(";")} ${p.versionHint ?? ""}`);
    console.log("  нові записи довідників:", refsInUse(plan).map((r) => `${r.kind}:${r.item.name}`).join(", "));
  } else {
    const plan = buildFinalPlan(ex.rows, res, seed, 10, new Date().toISOString());
    console.log("  план:", JSON.stringify(plan.counts));
    for (const r of plan.rows) console.log(`   r${r.row.rowIndex + 1} ${r.code} ${r.labels.carrier} ${r.status} ${r.matchedBy ?? ""} ${r.planIncome ?? ""}→${r.income ?? ""} ${r.message ?? ""}`);
  }
  if (f.includes("B")) console.log("  зразок для моделі (байт):", buildMappingPrompt(sh.rows, sh.name, mode).user.length);
}

// ── Відповідь моделі, шаблон, повторний імпорт ──
{
  const { mappingFromResponse } = await import("../src/features/import/prompts.ts");
  const { findTemplate } = await import("../src/features/import/mapping.ts");
  const { headerSignature } = await import("../src/features/import/parse.ts");
  const { applyLlmSuggestions, aliasesFrom } = await import("../src/features/import/resolve.ts");
  const { executeBudget } = await import("../src/features/import/execute.ts");
  console.log("\nМодель / шаблони / повторний імпорт:");
  const buf = readFileSync(new URL("../samples/бюджети-формат-A.xlsx", import.meta.url));
  const sh = readWorkbook(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, "a.xlsx")[0];
  const m = heuristicMapping(sh.rows, sh.name);
  const resp = { headerRow: m.headerRow, firstDataRow: m.firstDataRow, columns: Object.entries(m.columns).map(([i, field]) => ({ index: Number(i), field })), skipRowPatterns: ["Разом по проекту"], notes: "" };
  eq("валідна відповідь моделі приймається", mappingFromResponse(resp as never, sh.rows, sh.name, "budget").errors, []);
  const bad = { ...resp, columns: [...resp.columns.filter((c) => c.field !== "income"), { index: 99, field: "cost" }] };
  eq("погана відповідь відхиляється", mappingFromResponse(bad as never, sh.rows, sh.name, "budget").errors.length > 0, true);
  const tpl = { id: "t", name: "A", signature: headerSignature(sh.rows, m.headerRow), mapping: m, createdAt: "" };
  eq("шаблон знаходиться за підписом", findTemplate([tpl], sh.rows)?.name, "A");
  eq("шаблон не знаходиться для іншого файлу", findTemplate([tpl], [["x", "y"], ["1", "2"]]), undefined);

  // Імітація сховища: застосувати план A, потім імпортувати той самий файл ще раз зі зміною суми.
  const state = createSeed();
  const ex = extractRows(sh.rows, m);
  let res = collectResolution(ex.rows, "budget", state);
  const carrier1 = state.carriers.find((c) => c.name.startsWith("1+1"));
  res = applyLlmSuggestions(res, carrier1 ? [{ kind: "carrier", value: "1+1", match: carrier1.id, confidence: 0.95 }] : [], "budget");
  const plan = buildBudgetPlan(ex.rows, res, state, 10);
  let seq = 0;
  const actions = {
    upsertRef: (kind: string, item: { id: string }) => { (state as never as Record<string, unknown[]>)[kind].push(item); return item.id; },
    createProject: (p: Record<string, unknown>) => { const pr = { ...p, id: `p${++seq}`, createdAt: "", status: "active" }; state.projects.push(pr as never); return pr; },
    applyWorkChanges: (projectId: string, changes: { op: string; work?: Record<string, unknown>; id?: string; patch?: Record<string, unknown> }[]) => {
      const added: string[] = [], updated: string[] = [];
      for (const ch of changes) {
        if (ch.op === "add") { const id = `w${++seq}`; state.works.push({ closed: false, ...ch.work, id, projectId } as never); added.push(id); }
        else if (ch.op === "update") { const w = state.works.find((x) => x.id === ch.id)!; Object.assign(w, ch.patch); updated.push(w.id); }
      }
      return { batchId: "b", added, updated, deleted: [], errors: [] };
    },
  };
  const r1 = executeBudget(plan, actions as never);
  eq("створено 5 проєктів", r1.projects.filter((p) => p.created).length, 5);
  eq("додано 20 робіт", r1.projects.reduce((s, p) => s + p.added, 0), 20);
  eq("1+1 зіставлено з наявним носієм (не створено)", r1.createdRefs.some((x) => x.item.name === "1+1"), !carrier1);
  const res2 = collectResolution(ex.rows, "budget", state, aliasesFrom(res));
  eq("повторно — усі значення знайдено (точно або запамʼятовано)", resolutionItems(res2).filter((i) => i.via === "default").length, 0);
  const rows2 = ex.rows.map((r, i) => (i === 0 ? { ...r, income: (r.income ?? 0) + 100000 } : r));
  const plan2 = buildBudgetPlan(rows2, res2, state, 10);
  eq("повторний імпорт: 1 зміна, 19 без змін, 0 нових", [plan2.counts.change, plan2.counts.same, plan2.counts.add], [1, 19, 0]);
  eq("нових записів довідників немає", refsInUse(plan2).length, 0);
}

console.log(fails ? `\n${fails} FAIL` : "\nOK");
process.exit(fails ? 1 : 0);
