import { Link } from "react-router";
import { Badge, Modal, Money, Table } from "../../ui";
import { fmtDate, fmtPct } from "../../domain/calc";
import type { Carrier, ID, Project } from "../../domain/types";
import type { Node } from "./engine";

export function DrillModal({ node, title, projects, carriers, onClose }: { node: Node | null; title: string; projects: Map<ID, Project>; carriers: Map<ID, Carrier>; onClose: () => void }) {
  const facts = node?.facts ?? [];
  const partial = facts.some((f) => f.w < 0.9999);
  const sorted = [...facts].sort((a, b) => a.work.periodStart.localeCompare(b.work.periodStart));
  const inc = facts.reduce((s, f) => s + f.income, 0);
  const cost = facts.reduce((s, f) => s + f.cost, 0);
  return (
    <Modal open={!!node} wide title={`Роботи · ${title}`} onClose={onClose}>
      {partial && <div className="mb-3 text-xs text-slate-500">Суми розподілено пропорційно дням: показано частку роботи, що потрапила у цей рядок.</div>}
      <div className="max-h-[60vh] overflow-auto">
        <Table>
          <thead className="sticky top-0">
            <tr>
              <th>Проєкт</th><th>Носій</th><th>Опис</th><th>Період</th>
              {partial && <th className="text-right">Частка</th>}
              <th className="text-right">Дохід</th><th className="text-right">Затрата</th><th>Стан</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((f, i) => {
              const p = projects.get(f.work.projectId);
              return (
                <tr key={f.work.id + i}>
                  <td className="whitespace-nowrap">{p ? <Link className="font-medium text-indigo-600 hover:underline" to={`/projects/${p.code}`}>{p.code}</Link> : "—"}</td>
                  <td>{f.work.carrierId ? carriers.get(f.work.carrierId)?.name ?? "—" : "—"}</td>
                  <td className="max-w-64 truncate text-slate-500" title={f.work.description}>{f.work.description ?? ""}</td>
                  <td className="whitespace-nowrap">{fmtDate(f.work.periodStart)} – {fmtDate(f.work.periodEnd)}</td>
                  {partial && <td className="text-right tabular-nums text-slate-500">{fmtPct(f.w)}</td>}
                  <td className="text-right"><Money value={f.income} /></td>
                  <td className="text-right"><Money value={f.cost} /></td>
                  <td>{f.work.closed ? <Badge tone="green">закрито</Badge> : <Badge>відкрито</Badge>}</td>
                </tr>
              );
            })}
            <tr className="font-semibold">
              <td colSpan={partial ? 5 : 4}>Разом · {new Set(facts.map((f) => f.work.id)).size} робіт</td>
              <td className="text-right"><Money value={inc} /></td>
              <td className="text-right"><Money value={cost} /></td>
              <td />
            </tr>
          </tbody>
        </Table>
      </div>
    </Modal>
  );
}
