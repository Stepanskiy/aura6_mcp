import { Link } from "react-router-dom";
import { Alert, Badge, Button, Card, Stat, Table } from "../../ui";
import { DICT_KINDS, DICT_LABEL, DICT_REF } from "./fields";
import type { ImportResult } from "./execute";

export function DoneStep({ result, onAgain }: { result: ImportResult; onAgain: () => void }) {
  const ok = result.projects.filter((p) => !p.errors.length);
  const withErrors = result.projects.filter((p) => p.errors.length);
  const created = result.projects.filter((p) => p.created).length;
  const added = result.projects.reduce((s, p) => s + p.added, 0);
  const updated = result.projects.reduce((s, p) => s + p.updated, 0);
  const versions = result.projects.filter((p) => p.autoVersion).length;

  return (
    <div className="space-y-5">
      <Alert tone={withErrors.length ? "amber" : "green"}>
        <b>{result.mode === "budget" ? "Бюджети завантажено." : "Фінальні суми завантажено."}</b>{" "}
        {withErrors.length ? `Є повідомлення по ${withErrors.length} проєктах — див. таблицю.` : "Усі зміни записано в історію проєктів."}
        {result.mode === "final" && " Закриття («сума фінальна») — окремою дією в картці проєкту."}
      </Alert>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Проєктів" value={ok.length} sub={result.mode === "budget" ? `${created} створено` : "оновлено"} />
        {result.mode === "budget" && <Stat label="Робіт додано" value={added} />}
        <Stat label="Робіт оновлено" value={updated} />
        <Stat label="Версій плану" value={versions} sub="створено автоматично" />
        {result.mode === "budget" && <Stat label="Записів довідників" value={result.createdRefs.length} sub="створено" />}
      </div>
      {result.createdRefs.length > 0 && (
        <Card title="Нові записи довідників">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {DICT_KINDS.map((k) => {
              const xs = result.createdRefs.filter((r) => r.kind === DICT_REF[k]);
              return xs.length ? (
                <div key={k}>
                  <span className="text-slate-500">{DICT_LABEL[k]}:</span> {xs.map((x) => x.item.name).join(", ")}
                </div>
              ) : null;
            })}
          </div>
        </Card>
      )}
      <Card title="Проєкти">
        <Table>
          <thead>
            <tr>
              <th>Код</th><th>Назва</th><th></th><th className="text-right">Додано</th><th className="text-right">Оновлено</th><th>Версія плану</th><th>Повідомлення</th>
            </tr>
          </thead>
          <tbody>
            {result.projects.map((p) => (
              <tr key={p.code}>
                <td className="font-mono">
                  {p.errors.length && !p.added && !p.updated && !p.created ? p.code : <Link className="text-indigo-600 hover:underline" to={`/projects/${encodeURIComponent(p.code)}`}>{p.code}</Link>}
                </td>
                <td>{p.name}</td>
                <td>{p.created ? <Badge tone="green">створено</Badge> : p.added || p.updated ? <Badge tone="indigo">оновлено</Badge> : p.errors.length ? <Badge tone="red">пропущено</Badge> : <Badge>без змін</Badge>}</td>
                <td className="text-right tabular-nums">{p.added || "—"}</td>
                <td className="text-right tabular-nums">{p.updated || "—"}</td>
                <td>{p.autoVersion ? <Badge tone="sky">{p.autoVersion}</Badge> : <span className="text-slate-300">—</span>}</td>
                <td className="max-w-80 text-xs text-red-600">{p.errors.join("; ")}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <div className="flex justify-end gap-2">
        <Link to="/projects"><Button>До списку проєктів</Button></Link>
        <Button variant="primary" onClick={onAgain}>Імпортувати ще файл</Button>
      </div>
    </div>
  );
}
