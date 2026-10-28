/**
 * Acceptance test 1 — 40 simulated votes with a known distribution.
 *
 *   npm run seed:40                                   # data checks only
 *   npm run seed:40 -- --app http://localhost:5173    # also checks the rendered display
 *   npm run seed:40 -- --cleanup                      # delete the event afterwards
 *
 * Checks, against exact expected values: cell counts, voter count, mean,
 * bubble positions / labels / diameters (√count, cap, floor, minimum), no
 * overlap, midlines, mean marker, export rows and the CSV file. Also checks at
 * HTTP level, with the publishable key only, that results are hidden before
 * the reveal (acceptance 3) and that voting is refused after close (4).
 * The rendered check needs Playwright (`npx playwright install chromium`).
 */
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { exportRowsToCsv } from "../src/modules/heatmap/exportCsv.ts";
import {
  COUNT_FLOOR,
  MAX_DIAMETER,
  MIN_DIAMETER,
  PLOT_SIZE,
  SPACING,
  bubbleDiameter,
  pointOffset,
} from "../src/modules/heatmap/scale.ts";
import { checker, loadConfig, readPin, rpcClient } from "./lib/env.ts";

type Cell = [number, number, number];

/**
 * 40 votes. (7,8) holds the maximum (8) and has populated neighbours at (8,8)
 * and (7,7), so the largest bubble sits next to others: they must not overlap.
 * Mean: x = 242 / 40 = 6.05, y = 260 / 40 = 6.50 (between grid points).
 */
const DISTRIBUTION: Cell[] = [
  [7, 8, 8],
  [8, 8, 5],
  [3, 7, 4],
  [7, 7, 3],
  [6, 6, 3],
  [3, 3, 3],
  [4, 8, 2],
  [6, 5, 2],
  [9, 3, 2],
  [5, 6, 2],
  [9, 9, 2],
  [5, 5, 1],
  [2, 2, 1],
  [10, 10, 1],
  [3, 1, 1],
];

const TOTAL = DISTRIBUTION.reduce((s, [, , n]) => s + n, 0);
const EXPECTED_CELLS = [...DISTRIBUTION].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
const HIGHEST = Math.max(...DISTRIBUTION.map(([, , n]) => n));
// Means in hundredths, with integer arithmetic (as the database rounds).
const MEAN_X_100 = Math.round((DISTRIBUTION.reduce((s, [x, , n]) => s + x * n, 0) * 100) / TOTAL);
const MEAN_Y_100 = Math.round((DISTRIBUTION.reduce((s, [, y, n]) => s + y * n, 0) * 100) / TOTAL);

const close = (a: number, b: number, eps = 0.01) => Math.abs(a - b) <= eps;

async function main() {
  const args = process.argv.slice(2);
  const appUrl = args.includes("--app") ? args[args.indexOf("--app") + 1] : null;
  const cleanup = args.includes("--cleanup");

  const config = loadConfig();
  const rpc = rpcClient(config);
  const t = checker();
  const pin = await readPin();

  console.log(`\nSeeding ${TOTAL} votes into a new event at ${config.url}\n`);

  const created = await rpc<{ status: string; id: string; short_code: string }>("heatmap_host_create_event", {
    p_pin: pin,
    p_name: `בדיקת 40 הצבעות ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
  });
  if (created.status !== "ok") {
    console.error(`Could not create the event: ${created.status}`);
    process.exit(1);
  }
  const eventId = created.id;
  const code = created.short_code;

  // --- votes -----------------------------------------------------------------
  const ballots = DISTRIBUTION.flatMap(([x, y, n]) => Array.from({ length: n }, () => ({ x, y })));
  const statuses = await Promise.all(
    ballots.map((b) =>
      rpc<{ status: string }>("heatmap_cast_vote", { p_short_code: code, p_device_id: randomUUID(), p_x: b.x, p_y: b.y }),
    ),
  );
  t.check(statuses.every((s) => s.status === "ok"), `all ${TOTAL} votes accepted`);

  // --- rule 3: hidden before reveal, with the publishable key -------------------
  type Display = {
    status: string;
    voters: number;
    revealed: boolean;
    cells: Cell[] | null;
    mean: { x: number; y: number } | null;
  };
  const before = await rpc<Display>("heatmap_display", { p_event_id: eventId });
  t.check(before.voters === TOTAL, `voter count before reveal = ${TOTAL}`, before.voters);
  t.check(before.cells === null && before.mean === null, "no cells and no mean before reveal (direct RPC call)", before);

  // --- reveal ----------------------------------------------------------------------
  const revealed = await rpc<{ status: string }>("heatmap_host_set_state", {
    p_pin: pin,
    p_event_id: eventId,
    p_revealed: true,
    p_show_mean: true,
  });
  t.check(revealed.status === "ok", "host reveals and shows the mean");

  const after = await rpc<Display>("heatmap_display", { p_event_id: eventId });
  t.check(JSON.stringify(after.cells) === JSON.stringify(EXPECTED_CELLS), "cell counts match exactly", after.cells);
  t.check(after.voters === TOTAL, `counter = ${TOTAL}`, after.voters);
  t.check(
    !!after.mean && Math.round(after.mean.x * 100) === MEAN_X_100 && Math.round(after.mean.y * 100) === MEAN_Y_100,
    `mean = (${MEAN_X_100 / 100}, ${MEAN_Y_100 / 100})`,
    after.mean,
  );

  // --- bubble geometry -----------------------------------------------------------
  const geometry = EXPECTED_CELLS.map(([x, y, n]) => ({
    x,
    y,
    n,
    cx: pointOffset(x),
    cy: PLOT_SIZE - pointOffset(y),
    d: bubbleDiameter(n, HIGHEST),
  }));
  console.log("\nExpected bubbles (stage px, plot origin top-left):");
  console.table(
    geometry.map((g) => ({
      point: `(${g.x}, ${g.y})`,
      count: g.n,
      centre: `${g.cx}, ${g.cy}`,
      diameter: Number(g.d.toFixed(2)),
      "area vs max": Number(((g.d * g.d) / (MAX_DIAMETER * MAX_DIAMETER)).toFixed(3)),
    })),
  );

  const scaleTo = Math.max(HIGHEST, COUNT_FLOOR);
  const biggest = geometry.find((g) => g.n === HIGHEST)!;
  t.check(close(biggest.d, MAX_DIAMETER), `largest bubble capped at ${MAX_DIAMETER.toFixed(1)} px (< ${SPACING} px spacing)`);
  for (const g of geometry) {
    const raw = MAX_DIAMETER * Math.sqrt(g.n / scaleTo);
    if (raw >= MIN_DIAMETER) {
      t.check(
        close((g.d * g.d) / (biggest.d * biggest.d), g.n / HIGHEST, 1e-9),
        `(${g.x},${g.y}) area ∝ count: ${g.n}/${HIGHEST}`,
      );
    } else {
      t.check(g.d === MIN_DIAMETER, `(${g.x},${g.y}) count ${g.n} drawn at the ${MIN_DIAMETER} px minimum`);
    }
  }
  t.check(
    close(bubbleDiameter(2, 2), MAX_DIAMETER * Math.sqrt(2 / COUNT_FLOOR)),
    `floor: with a top count of 2, sizes scale against ${COUNT_FLOOR}`,
  );
  let overlaps = 0;
  for (const a of geometry) {
    for (const b of geometry) {
      if (a === b) continue;
      if (Math.hypot(a.cx - b.cx, a.cy - b.cy) < a.d / 2 + b.d / 2) overlaps++;
    }
  }
  t.check(overlaps === 0, "no two bubbles overlap (max-count point has populated neighbours)", overlaps);

  // --- export --------------------------------------------------------------------
  const exported = await rpc<{ status: string; rows: { event_id: string; x: number; y: number; updated_at: string }[] }>(
    "heatmap_host_export",
    { p_pin: pin, p_event_id: eventId },
  );
  t.check(exported.status === "ok" && exported.rows.length === TOTAL, `export has ${TOTAL} rows`);
  t.check(
    exported.rows.every((r) => Object.keys(r).sort().join(",") === "event_id,updated_at,x,y"),
    "export columns are event_id, x, y, updated_at (no device_id)",
  );
  const exportedCells = new Map<string, number>();
  for (const r of exported.rows) exportedCells.set(`${r.x},${r.y}`, (exportedCells.get(`${r.x},${r.y}`) ?? 0) + 1);
  t.check(
    DISTRIBUTION.every(([x, y, n]) => exportedCells.get(`${x},${y}`) === n) && exportedCells.size === DISTRIBUTION.length,
    "export rows match the distribution",
  );
  const csv = exportRowsToCsv(exported.rows);
  const lines = csv.slice(1).trimEnd().split("\r\n");
  t.check(csv.startsWith("\uFEFF"), "CSV starts with a UTF-8 BOM");
  t.check(lines.length === TOTAL + 1 && lines[0] === "מזהה אירוע,ציון X,ציון Y,זמן (שעון ישראל)", "CSV header + 40 rows");
  t.check(
    lines.slice(1).every((l) => /^[0-9a-f-]{36},([1-9]|10),([1-9]|10),\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(l)),
    "CSV rows: event id, X, Y, Israel time",
  );

  // --- rendered display (optional) -------------------------------------------------
  if (appUrl) await checkRenderedDisplay(appUrl, eventId, geometry, t.check);

  // --- rule 4: closed voting refuses votes (direct RPC call) ---------------------------
  await rpc("heatmap_host_set_state", { p_pin: pin, p_event_id: eventId, p_voting_open: false });
  const refused = await rpc<{ status: string }>("heatmap_cast_vote", {
    p_short_code: code,
    p_device_id: randomUUID(),
    p_x: 5,
    p_y: 5,
  });
  t.check(refused.status === "closed", "after close, a direct vote call is refused", refused);
  const stillForty = await rpc<{ voters: number }>("heatmap_display", { p_event_id: eventId });
  t.check(stillForty.voters === TOTAL, "the refused vote was not stored", stillForty.voters);
  await rpc("heatmap_host_set_state", { p_pin: pin, p_event_id: eventId, p_voting_open: true });

  if (cleanup) {
    const del = await rpc<{ status: string }>("heatmap_host_delete_event", { p_pin: pin, p_event_id: eventId });
    t.check(del.status === "ok", "seed event deleted (--cleanup)");
  } else {
    console.log(`\nEvent kept for a visual check: short code ${code}`);
    console.log(`Display: <app>/heatmap/display/${eventId}`);
  }

  console.log(t.failed === 0 ? "\nALL CHECKS PASSED" : `\n${t.failed} CHECK(S) FAILED`);
  process.exit(t.failed === 0 ? 0 : 1);
}

interface Geometry {
  x: number;
  y: number;
  n: number;
  cx: number;
  cy: number;
  d: number;
}

async function checkRenderedDisplay(
  appUrl: string,
  eventId: string,
  geometry: Geometry[],
  check: (ok: boolean, label: string, detail?: unknown) => void,
) {
  // Optional dependency: imported by name so the build does not require it.
  const moduleName = "playwright";
  let playwright: any;
  try {
    playwright = await import(moduleName);
  } catch {
    try {
      // A globally installed Playwright (NODE_PATH) is visible to require only.
      playwright = createRequire(import.meta.url)(moduleName);
    } catch {
      playwright = null;
    }
  }
  if (!playwright) {
    console.log("\nPlaywright is not installed: skipping the rendered-display check (see docs/acceptance.md).");
    return;
  }
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`${appUrl.replace(/\/+$/, "")}/heatmap/display/${eventId}`);
  await page.waitForSelector(".results .mean");
  await page.waitForTimeout(500); // let the 250 ms resize transition settle

  const rendered: {
    bubbles: { transform: string; scale: string; r: number; label: string }[];
    counter: string;
    midlines: number[][];
    mean: string;
    meanLabel: string;
    axisDir: string | null | undefined;
  } = await page.evaluate(() => {
    const groups = [...document.querySelectorAll(".matrix-bubbles > g")];
    return {
      bubbles: groups.map((g) => ({
        transform: g.getAttribute("transform") ?? "",
        scale: (g.querySelector("circle") as SVGCircleElement).style.transform,
        r: Number(g.querySelector("circle")?.getAttribute("r")),
        label: g.querySelector("text")?.textContent ?? "",
      })),
      counter: document.querySelector(".results-count .count-number")?.textContent ?? "",
      midlines: [...document.querySelectorAll(".matrix-midlines line")].map((l) =>
        ["x1", "y1", "x2", "y2"].map((a) => Number(l.getAttribute(a))),
      ),
      mean: document.querySelector(".mean")?.getAttribute("transform") ?? "",
      meanLabel: document.querySelector(".mean-label")?.textContent ?? "",
      axisDir: document.querySelector(".matrix")?.getAttribute("dir"),
    };
  });

  const parse = (t: string) => t.match(/-?[\d.]+/g)!.map(Number);
  check(rendered.bubbles.length === geometry.length, `display draws ${geometry.length} bubbles`, rendered.bubbles.length);
  let positionsOk = true;
  let labelsOk = true;
  let sizesOk = true;
  for (const g of geometry) {
    const b = rendered.bubbles.find((r) => {
      const [x, y] = parse(r.transform);
      return close(x, g.cx) && close(y, g.cy);
    });
    if (!b) {
      positionsOk = false;
      continue;
    }
    if (b.label !== String(g.n)) labelsOk = false;
    const s = parse(b.scale)[0];
    if (!close(s * b.r * 2, g.d)) sizesOk = false;
  }
  check(positionsOk, "every bubble is centred on its grid point");
  check(labelsOk, "every bubble prints its count");
  check(sizesOk, "every bubble has the expected diameter");
  check(rendered.counter === String(TOTAL), `counter shows ${TOTAL}`, rendered.counter);
  const mid = PLOT_SIZE / 2;
  check(
    rendered.midlines.some(([x1, , x2]) => x1 === mid && x2 === mid) &&
      rendered.midlines.some(([, y1, , y2]) => y1 === mid && y2 === mid),
    "midlines at 5.5 on both axes",
  );
  const [mx, my] = parse(rendered.mean);
  check(
    close(mx, pointOffset(MEAN_X_100 / 100)) && close(my, PLOT_SIZE - pointOffset(MEAN_Y_100 / 100)) && rendered.meanLabel === "ממוצע",
    "mean marker at the continuous mean, labelled ממוצע",
    rendered.mean,
  );
  check(rendered.axisDir === "ltr", "matrix container is dir=ltr (axes not mirrored)");

  mkdirSync("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/seed-40-display.png" });
  console.log("Screenshot: test-results/seed-40-display.png");
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
