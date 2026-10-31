import { useRef, useState } from "react";
import { Alert, Badge, Button, Card, clsx } from "../../ui";
import { fmtDate } from "../../domain/calc";
import type { ImportTemplate } from "../../domain/types";
import type { ImportMode } from "./fields";

export function FileStep({ mode, onFile, error, busy, templates, llmReady }: { mode: ImportMode; onFile: (f: File) => void; error?: string; busy?: boolean; templates: ImportTemplate[]; llmReady: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onFile(f);
          }}
          onClick={() => input.current?.click()}
          className={clsx(
            "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-16 text-center transition",
            over ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50",
          )}
        >
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-2xl text-indigo-600">⇪</div>
          <div className="text-lg font-semibold text-slate-800">{busy ? "Читаю файл…" : "Перетягніть файл сюди або натисніть, щоб вибрати"}</div>
          <div className="mt-1 text-sm text-slate-500">.xlsx, .xls, .csv — {mode === "budget" ? "бюджети (медіаплани) одного чи багатьох проєктів" : "фінальні суми по роботах проєктів"}</div>
          <Button variant="primary" className="mt-5" onClick={(e) => { e.stopPropagation(); input.current?.click(); }}>
            Вибрати файл
          </Button>
          <input
            ref={input}
            type="file"
            accept=".xlsx,.xls,.csv,.xlsm"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
        </div>
        {error && <Alert tone="red">{error}</Alert>}
        <div className="text-xs text-slate-400">Демо-файли: папка <code>prototype/samples</code> — бюджети-формат-A.xlsx, бюджети-формат-B.xlsx, фінальні-суми.xlsx.</div>
      </div>

      <div className="space-y-4">
        <Card title="Як це працює">
          <ol className="space-y-3 text-sm text-slate-600">
            <li className="flex gap-2"><Badge tone="indigo">1</Badge><span>Файл читається <b>у браузері</b> — нікуди не надсилається.</span></li>
            <li className="flex gap-2"><Badge tone="indigo">2</Badge><span>Модель бачить лише <b>перші 30 рядків</b> і пропонує <b>структуру</b>: де заголовки і що означає кожна колонка. Ви її бачите і можете змінити.</span></li>
            <li className="flex gap-2"><Badge tone="indigo">3</Badge><span>Суми, дати й коди з усіх рядків читає <b>програма</b> за цією структурою. Модель не переписує даних — тому суми не спотворюються, а вартість не залежить від розміру файлу.</span></li>
            <li className="flex gap-2"><Badge tone="indigo">4</Badge><span>Знайомий формат — зі збереженого <b>шаблону</b>, без моделі взагалі.</span></li>
          </ol>
          {!llmReady && <div className="mt-3"><Alert tone="sky">Ключ моделі не задано — структуру буде визначено евристикою за назвами колонок, ви її перевірите вручну.</Alert></div>}
        </Card>
        <Card title={`Шаблони форматів (${templates.length})`}>
          {templates.length ? (
            <ul className="space-y-1.5 text-sm">
              {templates.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-slate-700">{t.name}</span>
                  <span className="shrink-0 text-xs text-slate-400">{fmtDate(t.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-slate-500">Поки немає. Після розпізнавання файлу моделлю його формат можна зберегти — наступний такий файл імпортується без моделі.</div>
          )}
        </Card>
      </div>
    </div>
  );
}
