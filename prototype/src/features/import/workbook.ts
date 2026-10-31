// Читання файлу в браузері (SheetJS). Файл нікуди не надсилається.
import * as XLSX from "xlsx";
import type { Grid, SheetData } from "./parse";

function decodeText(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(buf);
  // Якщо CSV збережено в Windows-1251 (типово для Excel у UA/RU), UTF-8 дасть символи заміни.
  if (utf8.includes("�")) {
    try {
      return new TextDecoder("windows-1251").decode(buf);
    } catch {
      return utf8;
    }
  }
  return utf8.replace(/^﻿/, "");
}

/** Розібрати .xlsx / .xls / .csv у масив аркушів (сирі значення: числа, рядки; клітинки з форматом дати — Date). */
export function readWorkbook(buf: ArrayBuffer, fileName: string): SheetData[] {
  const isCsv = /\.(csv|txt)$/i.test(fileName);
  const wb = isCsv ? XLSX.read(decodeText(buf), { type: "string", raw: true }) : XLSX.read(buf, { type: "array", cellDates: true });
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const rows = (ws ? XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: true, defval: null }) : []) as Grid;
    return { name, rows };
  });
}
