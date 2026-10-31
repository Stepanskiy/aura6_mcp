import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "../../store";
import { nextProjectCode } from "../../domain/calc";
import { Alert, Button, Card, Field, Input, Page, Select } from "../../ui";
import { resolveHint } from "../../shell/hooks";

const NEW_BRAND = "__new__";

export function ProjectNew() {
  const s = useStore();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const src = s.projects.find((p) => p.code === sp.get("copyFrom"));
  const hinted = resolveHint(s.clients, sp.get("client"));

  const [clientId, setClientId] = useState(src?.clientId ?? hinted?.id ?? "");
  const client = s.clients.find((c) => c.id === clientId);
  const [codeEdited, setCodeEdited] = useState<string | null>(null);
  const code = codeEdited ?? (client ? nextProjectCode(s.projects, client.prefix) : "");
  const [name, setName] = useState(src ? `Копія: ${src.name}` : "");
  const [brandId, setBrandId] = useState(src?.brandId ?? "");
  const [newBrand, setNewBrand] = useState("");
  const [directionId, setDirectionId] = useState(src?.directionId ?? "");
  const [managerId, setManagerId] = useState(src?.managerId ?? "");
  const [year, setYear] = useState(src?.year ?? new Date().getFullYear());
  const [startDate, setStartDate] = useState(src?.startDate ?? "");
  const [endDate, setEndDate] = useState(src?.endDate ?? "");
  const [errors, setErrors] = useState<string[]>([]);

  const brands = s.brands.filter((b) => b.clientId === clientId);

  function changeClient(id: string) {
    setClientId(id);
    setBrandId("");
    setCodeEdited(null);
  }

  function submit() {
    const errs: string[] = [];
    if (!client) errs.push("Оберіть клієнта");
    if (!code.trim()) errs.push("Вкажіть код проєкту");
    else if (s.projects.some((p) => p.code === code.trim())) errs.push(`Код ${code.trim()} вже використовується`);
    if (!name.trim()) errs.push("Вкажіть назву проєкту");
    if (startDate && endDate && endDate < startDate) errs.push("Дата завершення раніше за дату початку");
    if (brandId === NEW_BRAND && !newBrand.trim()) errs.push("Вкажіть назву нового бренду");
    setErrors(errs);
    if (errs.length || !client) return;

    let bId: string | undefined = brandId || undefined;
    if (brandId === NEW_BRAND) bId = s.upsertRef("brands", { id: "", name: newBrand.trim(), clientId: client.id });
    const data = {
      code: code.trim(),
      name: name.trim(),
      clientId: client.id,
      brandId: bId,
      directionId: directionId || undefined,
      managerId: managerId || undefined,
      year,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };
    try {
      const p = src ? s.copyProject(src.id, data) : s.createProject(data);
      nav(`/projects/${p.code}`);
    } catch (e) {
      setErrors([e instanceof Error ? e.message : String(e)]);
    }
  }

  return (
    <Page
      title={src ? `Копія проєкту ${src.code}` : "Новий проєкт"}
      subtitle={src ? "Буде скопійовано медіаплан (без позначок «закрито»)" : "Код пропонується автоматично за клієнтом"}
    >
      <Card className="max-w-3xl">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Клієнт *">
            <Select value={clientId} onChange={(e) => changeClient(e.target.value)}>
              <option value="">— оберіть —</option>
              {s.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Код проєкту *" hint="Можна змінити вручну">
            <Input value={code} onChange={(e) => setCodeEdited(e.target.value)} />
          </Field>
          <Field label="Назва *" className="md:col-span-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Бренд">
            <Select value={brandId} onChange={(e) => setBrandId(e.target.value)} disabled={!clientId}>
              <option value="">— без бренду —</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              <option value={NEW_BRAND}>＋ Новий бренд…</option>
            </Select>
          </Field>
          {brandId === NEW_BRAND ? (
            <Field label="Назва нового бренду"><Input value={newBrand} onChange={(e) => setNewBrand(e.target.value)} autoFocus /></Field>
          ) : <div />}
          <Field label="Напрям">
            <Select value={directionId} onChange={(e) => setDirectionId(e.target.value)}>
              <option value="">—</option>
              {s.directions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
          <Field label="Менеджер">
            <Select value={managerId} onChange={(e) => setManagerId(e.target.value)}>
              <option value="">—</option>
              {s.managers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
          <Field label="Рік"><Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Початок"><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
            <Field label="Завершення"><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
          </div>
        </div>
        {errors.length > 0 && <div className="mt-4"><Alert tone="red">{errors.map((e) => <div key={e}>{e}</div>)}</Alert></div>}
        <div className="mt-5 flex gap-2">
          <Button variant="primary" onClick={submit}>{src ? "Створити копію" : "Створити проєкт"}</Button>
          <Button variant="ghost" onClick={() => nav("/projects")}>Скасувати</Button>
        </div>
      </Card>
    </Page>
  );
}
