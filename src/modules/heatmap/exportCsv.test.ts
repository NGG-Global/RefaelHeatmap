import assert from "node:assert/strict";
import { test } from "node:test";
import { exportRowsToCsv } from "./exportCsv.ts";

test("CSV: BOM, Hebrew header, Israel time, no device id", () => {
  const csv = exportRowsToCsv([
    { event_id: "7cee18fa-4d54-4b1f-9322-70a70bf57240", x: 4, y: 8, updated_at: "2026-11-02T08:15:30.123+00:00" },
    { event_id: "7cee18fa-4d54-4b1f-9322-70a70bf57240", x: 10, y: 1, updated_at: "2026-10-20T08:15:30Z" },
  ]);
  assert.ok(csv.startsWith("﻿"));
  const lines = csv.slice(1).trimEnd().split("\r\n");
  assert.equal(lines[0], "מזהה אירוע,ציון X,ציון Y,זמן (שעון ישראל)");
  // 2 Nov 2026 is after the switch to winter time: UTC+2.
  assert.equal(lines[1], "7cee18fa-4d54-4b1f-9322-70a70bf57240,4,8,2026-11-02 10:15:30");
  // 20 Oct 2026 is still summer time: UTC+3.
  assert.equal(lines[2], "7cee18fa-4d54-4b1f-9322-70a70bf57240,10,1,2026-10-20 11:15:30");
  assert.ok(!/device/i.test(csv));
});
