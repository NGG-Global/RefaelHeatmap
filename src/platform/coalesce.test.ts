import assert from "node:assert/strict";
import { test } from "node:test";
import { coalesce } from "./coalesce.ts";

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("a burst of calls runs the task twice: the current run and one follow-up", async () => {
  let runs = 0;
  const c = coalesce(async () => {
    runs++;
    await tick(20);
  });
  for (let i = 0; i < 50; i++) c.run();
  await tick(80);
  assert.equal(runs, 2);
  c.stop();
});

test("never more than one run in flight", async () => {
  let active = 0;
  let maxActive = 0;
  const c = coalesce(async () => {
    active++;
    maxActive = Math.max(maxActive, active);
    await tick(10);
    active--;
  });
  for (let i = 0; i < 10; i++) {
    c.run();
    await tick(3);
  }
  await tick(60);
  assert.equal(maxActive, 1);
  c.stop();
});

test("a failing task does not block later runs", async () => {
  let runs = 0;
  const c = coalesce(async () => {
    runs++;
    throw new Error("network");
  });
  c.run();
  await tick(5);
  c.run();
  await tick(5);
  assert.equal(runs, 2);
  c.stop();
});
