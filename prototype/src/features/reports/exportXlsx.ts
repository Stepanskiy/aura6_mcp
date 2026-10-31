import * as XLSX from "xlsx";
import { REPORT_DIMENSIONS, REPORT_MEASURES } from "../../shell/routes";
import { fmtDate } from "../../domain/calc";
import { flatTable, type Report, type ReportConfig } from "./engine";

export function exportReport(report: Report, cfg: ReportConfig) {
  const table = flatTable(report, REPORT_DIMENSIONS, REPORT_MEASURES);
  const period = `${cfg.from ? fmtDate(cfg.from) : "…"} – ${cfg.to ? fmtDate(cfg.to) : "…"}`;
  const aoa = [[`Звіт Аура 6 · період ${period}${cfg.prorate ? " · пропорційно дням" : ""}`], [], ...table];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = table[0].map((_, i) => ({ wch: i < report.rows.length ? 28 : 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Звіт");
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `aura6-report-${cfg.preset ?? "custom"}-${stamp}.xlsx`);
}
