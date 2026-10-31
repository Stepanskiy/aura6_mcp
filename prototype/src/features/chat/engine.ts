// Цикл діалогу: модель ↔ інструменти open_*. Модель отримує тільки слова користувача і статус «opened».
import { chatWithTools, type ChatMessage, type LlmUsage } from "../../llm/openrouter";
import { TOOLS, buildLaunch, parseArgs, parseFallbackToolCall, systemPrompt, toolResult, type LaunchInfo, type ScreenContext } from "./tools";

export interface TurnInfo {
  model: string;
  usage?: LlmUsage;
  /** Точний масив повідомлень, надісланий в OpenRouter у цьому запиті. */
  sent: ChatMessage[];
  fallback?: boolean;
}

export interface TurnResult {
  messages: ChatMessage[]; // нова історія (без system)
  turns: TurnInfo[];
  launches: LaunchInfo[]; // у порядку запуску
  error?: string;
}

const MAX_STEPS = 4;

export async function runTurn(history: ChatMessage[], screen?: ScreenContext): Promise<TurnResult> {
  const messages = [...history];
  const turns: TurnInfo[] = [];
  const launches: LaunchInfo[] = [];
  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const sent: ChatMessage[] = [{ role: "system", content: systemPrompt(new Date(), screen) }, ...messages];
      const r = await chatWithTools(sent, TOOLS);
      const turn: TurnInfo = { model: r.model, usage: r.usage, sent };
      turns.push(turn);
      let msg: ChatMessage = { role: "assistant", content: r.message.content ?? null };
      if (r.message.tool_calls?.length) msg.tool_calls = r.message.tool_calls;
      if (!msg.tool_calls) {
        const fb = parseFallbackToolCall(msg.content);
        if (fb) {
          msg = { role: "assistant", content: null, tool_calls: [fb] };
          turn.fallback = true;
        }
      }
      messages.push(msg);
      if (!msg.tool_calls?.length) break;
      for (const tc of msg.tool_calls) {
        const info = buildLaunch(tc.function.name, parseArgs(tc));
        if (!info.error) launches.push(info);
        messages.push({ role: "tool", tool_call_id: tc.id, content: toolResult(info) });
      }
    }
    return { messages, turns, launches };
  } catch (e) {
    return { messages, turns, launches, error: e instanceof Error ? e.message : String(e) };
  }
}
