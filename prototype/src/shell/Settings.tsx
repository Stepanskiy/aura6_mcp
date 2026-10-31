import { useState } from "react";
import { useStore } from "../store";
import { chatJson } from "../llm/openrouter";
import { Alert, Button, Card, Field, Input, Page } from "../ui";

const MODELS = ["qwen/qwen3-30b-a3b", "qwen/qwen3-8b", "qwen/qwen3-14b", "google/gemma-3-12b-it", "google/gemma-3-27b-it"];

export function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const reset = useStore((s) => s.resetDemoData);
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function runTest() {
    setBusy(true);
    setTest(null);
    try {
      const r = await chatJson<{ answer: string }>({
        system: "Ти перевіряєш з’єднання.",
        user: "Відповідай словом «готово».",
        schemaName: "ping",
        schema: { type: "object", properties: { answer: { type: "string" } }, required: ["answer"], additionalProperties: false },
      });
      setTest({ ok: true, text: `Модель ${r.model} відповіла: ${r.data.answer}` });
    } catch (e) {
      setTest({ ok: false, text: String((e as Error).message) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title="Налаштування">
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Модель (OpenRouter)">
          <div className="space-y-3">
            <Field label="Ключ API" hint="Зберігається тільки в цьому браузері. Демо без даних клієнтів — ізоляція не потрібна.">
              <Input type="password" value={settings.openRouterKey} onChange={(e) => update({ openRouterKey: e.target.value })} placeholder="sk-or-…" />
            </Field>
            <Field label="Модель" hint="Будь-яка модель OpenRouter; перемикається одним рядком.">
              <Input list="models" value={settings.model} onChange={(e) => update({ model: e.target.value })} />
              <datalist id="models">
                {MODELS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>
            <Button onClick={runTest} disabled={busy || !settings.openRouterKey}>
              {busy ? "Перевірка…" : "Перевірити з’єднання"}
            </Button>
            {test && <Alert tone={test.ok ? "green" : "red"}>{test.text}</Alert>}
          </div>
        </Card>
        <Card title="Облік">
          <div className="space-y-3">
            <Field label="Назва агенції" hint="Друкується в рахунках">
              <Input value={settings.agencyName} onChange={(e) => update({ agencyName: e.target.value })} />
            </Field>
            <Field label="Поріг автоматичної версії плану, %" hint="Нова версія плану створюється, коли сума доходів або витрат проєкту змінилась більше ніж на цей відсоток">
              <Input type="number" min={1} max={100} value={settings.autoVersionThresholdPct} onChange={(e) => update({ autoVersionThresholdPct: Number(e.target.value) || 10 })} />
            </Field>
            <div className="pt-2">
              <Button
                variant="danger"
                onClick={() => {
                  if (confirm("Скинути всі дані до демо-набору? Ваші зміни буде втрачено.")) reset();
                }}
              >
                Скинути демо-дані
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </Page>
  );
}
