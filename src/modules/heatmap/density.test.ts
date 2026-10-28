import assert from "node:assert/strict";
import { test } from "node:test";
import type { Cell } from "./api.ts";
import {
  CUTOFF,
  DOMAIN_MAX,
  DOMAIN_MIN,
  FLOOR,
  GRID,
  YLORRD,
  colour,
  density,
  dotOffset,
  intensityAt,
  normaliser,
} from "./density.ts";

const argmax = (v: Float64Array) => v.reduce((best, x, i) => (x > v[best] ? i : best), 0);
const STEP = (DOMAIN_MAX - DOMAIN_MIN) / GRID;
const toScore = (i: number) => DOMAIN_MIN + (i + 0.5) * STEP;

test("an empty event paints nothing", () => {
  const d = density([]);
  assert.equal(d.peak, 0);
  assert.ok(d.values.every((v) => v === 0));
});

test("a single vote peaks at its own point and never reaches the darkest colour", () => {
  const d = density([[7, 8, 1]]);
  const p = argmax(d.values);
  const x = toScore(p % GRID);
  const y = DOMAIN_MAX - (Math.floor(p / GRID) + 0.5) * STEP;
  assert.ok(Math.abs(x - 7) < 0.1 && Math.abs(y - 8) < 0.1, `peak at (${x}, ${y})`);
  assert.ok(Math.abs(d.peak - 1) < 0.01, "kernel peak is one respondent");
  assert.equal(normaliser(d.peak), FLOOR);
  assert.ok(intensityAt(d, 7, 8) <= 1 / FLOOR + 1e-9);
});

test("the densest cluster is darkest, wherever the stragglers are", () => {
  const cells: Cell[] = [
    [7, 8, 6],
    [8, 8, 4],
    [7, 7, 3],
    [2, 3, 1],
    [9, 2, 1],
  ];
  const d = density(cells);
  assert.ok(intensityAt(d, 7, 8) > 0.9);
  assert.ok(intensityAt(d, 2, 3) < 0.3);
  assert.ok(intensityAt(d, 7, 8) > intensityAt(d, 9, 2));
});

test("areas with nobody nearby are fully transparent", () => {
  const d = density([[1, 1, 5]]);
  assert.equal(colour(intensityAt(d, 10, 10))[3], 0);
  assert.ok(intensityAt(d, 10, 10) < CUTOFF);
});

test("X runs left to right and Y bottom to top", () => {
  const d = density([[10, 1, 3]]);
  const p = argmax(d.values);
  assert.ok(p % GRID > GRID * 0.8, "high X is at the right");
  assert.ok(Math.floor(p / GRID) > GRID * 0.8, "low Y is at the bottom (last rows)");
});

test("colour ramp runs from light yellow to dark red", () => {
  assert.deepEqual(colour(1).slice(0, 3), [...YLORRD[YLORRD.length - 1]]);
  assert.equal(colour(1)[3], 255);
  assert.deepEqual(colour(0), [0, 0, 0, 0]);
  const low = colour(CUTOFF + 0.01);
  assert.ok(low[0] > 250 && low[1] > 240, "lowest visible colour is pale yellow");
  assert.ok(low[3] < 64, "and nearly transparent");
});

test("out-of-range cells are ignored", () => {
  assert.equal(density([[0, 5, 3], [5, 11, 2], [5, 5, 0]]).peak, 0);
});

test("dot offsets are fixed, distinct and keep earlier dots in place", () => {
  const spacing = 14;
  const first = Array.from({ length: 12 }, (_, k) => dotOffset(k, spacing));
  assert.deepEqual(first[0], [0, 0]);
  assert.deepEqual(dotOffset(5, spacing), first[5]);
  for (let a = 0; a < first.length; a++) {
    for (let b = a + 1; b < first.length; b++) {
      const d = Math.hypot(first[a][0] - first[b][0], first[a][1] - first[b][1]);
      assert.ok(d > spacing * 0.9, `dots ${a} and ${b} are ${d.toFixed(1)} apart`);
    }
  }
});
