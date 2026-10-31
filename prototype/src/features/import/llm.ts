// Виклики моделі для імпорту. Тексти і схеми — у prompts.ts; тут тільки виклик і облік токенів/часу.
import { chatJson } from "../../llm/openrouter";
import type { SheetMapping } from "../../domain/types";
import type { ImportMode } from "./fields";
import type { Grid } from "./parse";
import {
  buildMappingPrompt,
  buildResolvePrompt,
  mappingFromResponse,
  resolutionsFromResponse,
  type MappingResponse,
  type Prompt,
  type ResolveRequestKind,
  type ResolveResponse,
} from "./prompts";

export interface LlmCallInfo {
  prompt: Prompt;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  ms?: number;
  error?: string;
  notes?: string;
}

export async function llmDetectMapping(grid: Grid, sheetName: string, mode: ImportMode): Promise<{ mapping?: SheetMapping; info: LlmCallInfo }> {
  const prompt = buildMappingPrompt(grid, sheetName, mode);
  const t0 = performance.now();
  try {
    const r = await chatJson<MappingResponse>(prompt);
    const info: LlmCallInfo = {
      prompt,
      model: r.model,
      promptTokens: r.usage?.prompt_tokens,
      completionTokens: r.usage?.completion_tokens,
      ms: Math.round(performance.now() - t0),
      notes: typeof r.data?.notes === "string" ? r.data.notes : undefined,
    };
    const v = mappingFromResponse(r.data, grid, sheetName, mode);
    if (!v.mapping) return { info: { ...info, error: `Відповідь моделі не пройшла перевірку: ${v.errors.join("; ")}` } };
    return { mapping: v.mapping, info };
  } catch (e) {
    return { info: { prompt, ms: Math.round(performance.now() - t0), error: e instanceof Error ? e.message : String(e) } };
  }
}

export async function llmResolve(kinds: ResolveRequestKind[]) {
  const prompt = buildResolvePrompt(kinds);
  const t0 = performance.now();
  try {
    const r = await chatJson<ResolveResponse>(prompt);
    return {
      items: resolutionsFromResponse(r.data, kinds),
      info: { prompt, model: r.model, promptTokens: r.usage?.prompt_tokens, completionTokens: r.usage?.completion_tokens, ms: Math.round(performance.now() - t0) } as LlmCallInfo,
    };
  } catch (e) {
    return { items: [], info: { prompt, ms: Math.round(performance.now() - t0), error: e instanceof Error ? e.message : String(e) } as LlmCallInfo };
  }
}
