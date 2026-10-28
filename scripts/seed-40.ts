/**
 * Acceptance test 1 — 40 simulated votes with a known distribution.
 *
 *   npm run seed:40                                   # data checks only
 *   npm run seed:40 -- --app http://localhost:5173    # also checks the rendered display
 *   npm run seed:40 -- --cleanup                      # delete the event afterwards
 *
 * Checks, against exact expected values: cell counts, voter count, mean, the
 * heatmap's densest point and transparent areas (density.ts), export rows and
 * the CSV file. Also checks at HTTP level, with the publishable key only, that
 * results are hidden before the reveal (acceptance 3) and that voting is
 * refused after close (4). The rendered check (brief V5: dark concentration in
 * the right place, dot count = counter, quadrant lines in place) needs
 * Playwright (`npx playwright install chromium`).
 */
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { exportRowsToCsv } from "../src/modules/heatmap/exportCsv.ts";
import { CUTOFF, DOMAIN_MAX, DOMAIN_MIN, GRID, colour, density, intensityAt } from "../src/modules/heatmap/density.ts";
import { checker, loadConfig, readPin, rpcClient } from "./lib/env.ts";

type Cell = [number, number, number];

/** Score units per raster cell. */
const STEP = (DOMAIN_MAX - DOMAIN_MIN) / GRID;

/**
 * 40 votes. (7,8) holds the maximum (8) with populated neighbours at (8,8) and
 * (7,7): the darkest colour must sit there, not between clusters. Single votes
 * at (10,10), (2,2) and (3,1) must stay light.
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

  // --- heatmap (density.ts, as drawn by the display) ------------------------------
  const map = density(EXPECTED_CELLS);
  const peakIndex = map.values.reduce((best, v, i) => (v > map.values[best] ? i : best), 0);
  const peakX = DOMAIN_MIN + ((peakIndex % GRID) + 0.5) * STEP;
  const peakY = DOMAIN_MIN + (GRID - 1 - Math.floor(peakIndex / GRID) + 0.5) * STEP;
  t.check(
    Math.round(peakX) === 7 && Math.round(peakY) === 8,
    "darkest point of the heatmap is at the largest cluster (7, 8)",
    { x: peakX.toFixed(2), y: peakY.toFixed(2) },
  );
  t.check(intensityAt(map, 7, 8) > 0.95, "(7, 8) takes the darkest colour", intensityAt(map, 7, 8));
  t.check(
    [[10, 10], [2, 2], [3, 1]].every(([x, y]) => intensityAt(map, x, y) < 0.5),
    "single votes stay in the light colours",
  );
  t.check(
    colour(intensityAt(map, 1, 10))[3] === 0 && intensityAt(map, 1, 10) < CUTOFF,
    "areas with no respondents nearby are transparent",
  );

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
  if (appUrl) await checkRenderedDisplay(appUrl, eventId, pin, rpc, t.check);

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

async function checkRenderedDisplay(
  appUrl: string,
  eventId: string,
  pin: string,
  rpc: ReturnType<typeof rpcClient>,
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
  await page.waitForSelector(".heatmap .hm-mean");
  await page.waitForTimeout(1200); // let the reveal fade settle

  interface Rendered {
    size: number;
    grid: number;
    pixels: number[];
    dots: number[][];
    counter: string;
    quadLines: number[][];
    quadrants: (string | null)[];
    mean: string;
    meanLabel: string;
    legend: string;
    dir: string | null | undefined;
  }
  const read = (): Promise<Rendered> =>
    page.evaluate(() => {
      const plot = document.querySelector(".hm-plot") as HTMLElement;
      const canvas = document.querySelector(".hm-canvas") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      return {
        size: plot.offsetWidth,
        grid: canvas.width,
        pixels: Array.from(pixels),
        dots: [...document.querySelectorAll(".hm-plot .hm-dot")].map((c) => [
          Number(c.getAttribute("cx")),
          Number(c.getAttribute("cy")),
        ]),
        counter: document.querySelector(".results-count .count-number")?.textContent ?? "",
        quadLines: [...document.querySelectorAll(".hm-quadline")].map((l) =>
          ["x1", "y1", "x2", "y2"].map((a) => Number(l.getAttribute(a))),
        ),
        quadrants: [...document.querySelectorAll(".hm-quadrant")].map((q) => q.textContent),
        mean: document.querySelector(".hm-mean")?.getAttribute("transform") ?? "",
        meanLabel: document.querySelector(".hm-mean-label")?.textContent ?? "",
        legend: document.querySelector(".hm-legend")?.textContent ?? "",
        dir: document.querySelector(".heatmap")?.getAttribute("dir"),
      };
    });

  const r = await read();
  const unit = r.size / (DOMAIN_MAX - DOMAIN_MIN);
  const px = (x: number) => (x - DOMAIN_MIN) * unit;
  const py = (y: number) => r.size - (y - DOMAIN_MIN) * unit;

  check(r.dir === "ltr", "map container is dir=ltr (axes not mirrored)");
  check(r.dots.length === TOTAL && r.counter === String(TOTAL), `dot count = counter = ${TOTAL}`, {
    dots: r.dots.length,
    counter: r.counter,
  });
  // Each dot belongs to the score point it is nearest to.
  const perPoint = new Map<string, number>();
  for (const [cx, cy] of r.dots) {
    const key = `${Math.round(cx / unit + DOMAIN_MIN)},${Math.round((r.size - cy) / unit + DOMAIN_MIN)}`;
    perPoint.set(key, (perPoint.get(key) ?? 0) + 1);
  }
  check(
    DISTRIBUTION.every(([x, y, n]) => perPoint.get(`${x},${y}`) === n) && perPoint.size === DISTRIBUTION.length,
    "every score point shows one dot per respondent",
    Object.fromEntries(perPoint),
  );

  // Darkest rendered pixel: lowest red + green among opaque pixels (YlOrRd).
  let darkest = -1;
  for (let p = 0; p < r.pixels.length / 4; p++) {
    if (r.pixels[p * 4 + 3] < 200) continue;
    if (darkest < 0 || r.pixels[p * 4 + 1] + r.pixels[p * 4] < r.pixels[darkest * 4 + 1] + r.pixels[darkest * 4]) darkest = p;
  }
  const dx = DOMAIN_MIN + ((darkest % r.grid) + 0.5) * STEP;
  const dy = DOMAIN_MIN + (r.grid - 1 - Math.floor(darkest / r.grid) + 0.5) * STEP;
  check(Math.round(dx) === 7 && Math.round(dy) === 8, "rendered dark concentration is at (7, 8)", {
    x: dx.toFixed(2),
    y: dy.toFixed(2),
  });
  // Top-left pixel (X ≈ 0, Y ≈ 11): nobody answered anywhere near it.
  check(r.pixels[3] === 0, "rendered map is transparent where nobody answered");

  const mid = px(5.5);
  check(
    r.quadLines.some(([x1, , x2]) => x1 === mid && x2 === mid) && r.quadLines.some(([, y1, , y2]) => y1 === mid && y2 === mid),
    "dashed quadrant lines at 5.5 on both axes",
  );
  check(r.quadrants.length === 4, "four quadrant names in the corners");
  const [mx, my] = (r.mean.match(/-?[\d.]+/g) ?? []).map(Number);
  check(
    close(mx, px(MEAN_X_100 / 100)) && close(my, py(MEAN_Y_100 / 100)) && r.meanLabel === "ממוצע",
    "mean ring at the continuous mean, labelled ממוצע",
    r.mean,
  );
  check(r.legend.includes("פחות צפוף") && r.legend.includes("יותר צפוף") && r.legend.includes("נקודה אחת = משיב אחד"),
    "legend under the map");

  mkdirSync("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/seed-40-display.png" });
  console.log("Screenshot: test-results/seed-40-display.png");

  // Hide the dots: the display follows within one refetch.
  const hid = await rpc<{ status: string }>("heatmap_host_set_state", { p_pin: pin, p_event_id: eventId, p_show_dots: false });
  check(hid.status === "ok", "host hides the dots");
  await page.waitForFunction(() => document.querySelectorAll(".hm-plot .hm-dot").length === 0, null, { timeout: 8000 }).catch(
    () => undefined,
  );
  const hidden = await read();
  check(hidden.dots.length === 0 && !hidden.legend.includes("נקודה אחת"), "dots and their legend entry are hidden");
  await page.screenshot({ path: "test-results/seed-40-display-no-dots.png" });
  await rpc("heatmap_host_set_state", { p_pin: pin, p_event_id: eventId, p_show_dots: true });

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
