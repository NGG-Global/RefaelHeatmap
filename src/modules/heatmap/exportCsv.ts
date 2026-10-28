import { downloadCsv, toCsv } from "../../platform/csv";
import { israelDateTime } from "../../platform/time";
import type { ExportRow } from "./api";
import { CSV_HEADER } from "./content";

/** Columns: event id, X score, Y score, time (Israel time). Never the device id. */
export function exportRowsToCsv(rows: readonly ExportRow[]): string {
  return toCsv(
    CSV_HEADER,
    rows.map((r) => [r.event_id, r.x, r.y, israelDateTime(r.updated_at)]),
  );
}

export function downloadEventCsv(shortCode: string, rows: readonly ExportRow[]): void {
  const date = israelDateTime(new Date().toISOString()).slice(0, 10);
  downloadCsv(`heatmap-${shortCode}-${date}.csv`, exportRowsToCsv(rows));
}
