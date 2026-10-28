import assert from "node:assert/strict";
import { test } from "node:test";
import { CAP_RATIO, COUNT_FLOOR, MAX_DIAMETER, MIN_DIAMETER, SPACING, bubbleDiameter, pointOffset } from "./scale.ts";

test("largest bubble is capped below the grid spacing", () => {
  assert.equal(bubbleDiameter(12, 12), SPACING * CAP_RATIO);
  assert.ok(MAX_DIAMETER < SPACING);
});

test("area, not radius, encodes the count", () => {
  // Counts chosen above the minimum-size floor.
  const d9 = bubbleDiameter(9, 16);
  const d16 = bubbleDiameter(16, 16);
  assert.ok(d9 > MIN_DIAMETER);
  assert.ok(Math.abs((d16 * d16) / (d9 * d9) - 16 / 9) < 1e-9);
});

test("scale uses a floor so the first votes stay small", () => {
  assert.equal(bubbleDiameter(COUNT_FLOOR, 1), MAX_DIAMETER);
  assert.ok(bubbleDiameter(3, 3) < MAX_DIAMETER);
});

test("minimum diameter holds a two-digit label", () => {
  assert.equal(bubbleDiameter(1, 40), MIN_DIAMETER);
  assert.equal(bubbleDiameter(0, 5), 0);
});

test("adjacent bubbles never overlap", () => {
  assert.ok(MAX_DIAMETER / 2 + MAX_DIAMETER / 2 < SPACING);
});

test("score points sit at the centre of each grid step", () => {
  assert.equal(pointOffset(1), SPACING / 2);
  assert.equal(pointOffset(10), SPACING * 9.5);
});
