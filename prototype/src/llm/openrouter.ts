// Клієнт OpenRouter (API, сумісний з OpenAI). Ключ і модель — у налаштуваннях, зберігаються в браузері.
// Для власного хостингу (vLLM) достатньо змінити BASE_URL і назву моделі.
import { useStore } from "../store";

const BASE_URL = "https://openrouter.ai/api/v1";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ToolDef {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface LlmUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

export class LlmError extends Error {}

export function llmConfigured(): boolean {
  return !!useStore.getState().settings.openRouterKey;
}

async function call(body: Record<string, unknown>): Promise<{ message: ChatMessage; usage?: LlmUsage; model: string }> {
  const { openRouterKey, model } = useStore.getState().settings;
  if (!openRouterKey) throw new LlmError("Не задано ключ OpenRouter — відкрийте Налаштування");
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openRouterKey}`,
      "Content-Type": "application/json",
      "X-Title": "Aura 6 demo",
    },
    body: JSON.stringify({ model, temperature: 0, ...body }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new LlmError(`OpenRouter ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const message = data?.choices?.[0]?.message as ChatMessage | undefined;
  if (!message) throw new LlmError("Порожня відповідь моделі");
  return { message, usage: data.usage, model: data.model ?? model };
}

/** Витягує перший JSON-обʼєкт з тексту (на випадок, якщо модель не підтримує structured outputs). */
function extractJson(text: string): unknown {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```(?:json)?/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new LlmError("Модель не повернула JSON");
  return JSON.parse(cleaned.slice(start, end + 1));
}

/**
 * Запит з відповіддю у вигляді JSON за схемою.
 * Спершу пробує structured outputs (json_schema), якщо провайдер відмовляє — звичайний запит з інструкцією.
 */
export async function chatJson<T>(opts: { system: string; user: string; schemaName: string; schema: Record<string, unknown> }): Promise<{ data: T; usage?: LlmUsage; model: string }> {
  const messages: ChatMessage[] = [
    { role: "system", content: opts.system },
    { role: "user", content: opts.user },
  ];
  try {
    const r = await call({
      messages,
      response_format: { type: "json_schema", json_schema: { name: opts.schemaName, strict: true, schema: opts.schema } },
    });
    return { data: extractJson(r.message.content ?? "") as T, usage: r.usage, model: r.model };
  } catch (e) {
    if (!(e instanceof LlmError) || !/400|response_format|json_schema/i.test(e.message)) throw e;
    const r = await call({
      messages: [
        { role: "system", content: `${opts.system}\n\nВідповідай ТІЛЬКИ JSON-обʼєктом за схемою:\n${JSON.stringify(opts.schema)}` },
        { role: "user", content: opts.user },
      ],
    });
    return { data: extractJson(r.message.content ?? "") as T, usage: r.usage, model: r.model };
  }
}

/** Один крок діалогу з інструментами (tool calling). */
export async function chatWithTools(messages: ChatMessage[], tools: ToolDef[]): Promise<{ message: ChatMessage; usage?: LlmUsage; model: string }> {
  return call({ messages, tools, tool_choice: "auto" });
}
