import { Badge, Button } from "../../ui";
import type { LaunchInfo } from "./tools";

export function LaunchCard({ info, onOpen }: { info: LaunchInfo; onOpen: (url: string) => void }) {
  if (info.error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{info.tool}: {info.error}</div>;
  }
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-indigo-900">{info.appTitle}</span>
          <Badge tone="indigo">{info.tool}</Badge>
        </div>
        <Button variant="primary" onClick={() => onOpen(info.url)}>Відкрити</Button>
      </div>
      {info.params.length > 0 ? (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
          {info.params.map((p) => (
            <div key={p.label} className="contents">
              <dt className="text-slate-500">{p.label}</dt>
              <dd className="font-medium text-slate-800">{p.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="mt-1 text-xs text-slate-500">Без параметрів</div>
      )}
      <div className="mt-2 truncate font-mono text-[11px] text-slate-400">#{safeDecode(info.url)}</div>
    </div>
  );
}

/** Адреса для показу людині: кирилиця замість %D0%9A…. */
function safeDecode(url: string): string {
  try { return decodeURIComponent(url); } catch { return url; }
}
