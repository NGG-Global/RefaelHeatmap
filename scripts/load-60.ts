/**
 * Acceptance test 2 — 60 concurrent voters, including vote changes.
 *
 *   npm run load:60              # creates a test event, deletes it at the end
 *   npm run load:60 -- --keep    # keep the event for inspection
 *
 * A "display" in this script behaves like the real one: it subscribes to the
 * event's public channel and refetches heatmap_display() on every signal,
 * coalesced (one fetch in flight, one follow-up), with a 5 s fallback poll.
 * Pass criteria: every vote lands, one row per device, the display reflects the
 * final state within ~2 s of the last vote. Needs Node 22+ (global WebSocket).
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { coalesce } from "../src/platform/coalesce.ts";
import { checker, loadConfig, readPin, rpcClient } from "./lib/env.ts";

const VOTERS = 60;
const CHANGERS = 30; // change their vote in phase 2
const REPEATERS = 10; // send the same vote twice at once in phase 2
const TARGET_MS = 2000;
const POLL_MS = 5000;

type Cell = [number, number, number];
interface Display {
  status: string;
  voters: number;
  revealed: boolean;
  cells: Cell[] | null;
}

const rand = () => 1 + Math.floor(Math.random() * 10);
const percentile = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))];

async function main() {
  const keep = process.argv.includes("--keep");
  const config = loadConfig();
  const rpc = rpcClient(config);
  const t = checker();
  const pin = await readPin();

  const created = await rpc<{ status: string; id: string; short_code: string }>("heatmap_host_create_event", {
    p_pin: pin,
    p_name: `בדיקת עומס 60 ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
  });
  if (created.status !== "ok") {
    console.error(`Could not create the event: ${created.status}`);
    process.exit(1);
  }
  const { id: eventId, short_code: code } = created;
  console.log(`\nEvent ${code} created. Starting the display watcher…`);

  // --- simulated display ------------------------------------------------------
  let latest: Display | null = null;
  const listeners = new Set<() => void>();
  let signals = 0;
  let fetches = 0;
  const fetcher = coalesce(async () => {
    fetches++;
    latest = await rpc<Display>("heatmap_display", { p_event_id: eventId });
    listeners.forEach((l) => l());
  });
  const supabase = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            "Realtime subscribe timed out. Check that Realtime is enabled and that " +
              "'Allow public access to channels' is on (Project Settings → Realtime). " +
              "Right after a local `supabase db reset`, wait ~20 s for Realtime to restart.",
          ),
        ),
      15_000,
    );
    supabase
      .channel(`heatmap:${eventId}`, { config: { private: false } })
      .on("broadcast", { event: "changed" }, () => {
        signals++;
        fetcher.run();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timer);
          resolve();
        }
      });
  });
  const poll = setInterval(fetcher.run, POLL_MS);
  fetcher.run();

  /** Resolves with the time at which `predicate` first holds for display data. */
  const seenWhen = (predicate: (d: Display) => boolean, timeoutMs = 15_000) =>
    new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("display did not converge")), timeoutMs);
      const test = () => {
        if (latest && predicate(latest)) {
          clearTimeout(timer);
          listeners.delete(test);
          resolve(Date.now());
        }
      };
      listeners.add(test);
      test();
    });

  // --- phase 1: 60 voters at once -------------------------------------------------
  const devices = Array.from({ length: VOTERS }, () => ({ id: randomUUID(), x: rand(), y: rand() }));
  const cast = async (d: { id: string; x: number; y: number }) => {
    const start = Date.now();
    const res = await rpc<{ status: string }>("heatmap_cast_vote", { p_short_code: code, p_device_id: d.id, p_x: d.x, p_y: d.y });
    return { status: res.status, ms: Date.now() - start, end: Date.now() };
  };

  const p1 = await Promise.all(devices.map(cast));
  const p1Last = Math.max(...p1.map((r) => r.end));
  t.check(p1.every((r) => r.status === "ok"), `phase 1: all ${VOTERS} concurrent votes accepted`);
  const p1Seen = await seenWhen((d) => d.voters === VOTERS);
  const p1Delay = Math.max(0, p1Seen - p1Last);
  t.check(p1Delay <= TARGET_MS, `phase 1: display shows ${VOTERS} voters ${p1Delay} ms after the last vote (≤ ${TARGET_MS})`);

  // --- reveal, then phase 2: changes and duplicate submissions -----------------------
  await rpc("heatmap_host_set_state", { p_pin: pin, p_event_id: eventId, p_revealed: true });
  await seenWhen((d) => d.revealed);

  for (const d of devices.slice(0, CHANGERS)) {
    d.x = rand();
    d.y = rand();
  }
  const phase2 = [...devices.slice(0, CHANGERS), ...devices.slice(CHANGERS, CHANGERS + REPEATERS)];
  const p2 = await Promise.all([...phase2, ...devices.slice(CHANGERS, CHANGERS + REPEATERS)].map(cast));
  const p2Last = Math.max(...p2.map((r) => r.end));
  t.check(p2.every((r) => r.status === "ok"), `phase 2: ${CHANGERS} changes + ${REPEATERS * 2} duplicate submissions accepted`);

  const expected = new Map<string, number>();
  for (const d of devices) expected.set(`${d.x},${d.y}`, (expected.get(`${d.x},${d.y}`) ?? 0) + 1);
  const matches = (d: Display) =>
    d.voters === VOTERS &&
    !!d.cells &&
    d.cells.length === expected.size &&
    d.cells.every(([x, y, n]) => expected.get(`${x},${y}`) === n);
  const p2Seen = await seenWhen(matches);
  const p2Delay = Math.max(0, p2Seen - p2Last);
  t.check(p2Delay <= TARGET_MS, `phase 2: display shows the final distribution ${p2Delay} ms after the last vote (≤ ${TARGET_MS})`);

  // --- data integrity ----------------------------------------------------------------
  const exported = await rpc<{ status: string; rows: unknown[] }>("heatmap_host_export", { p_pin: pin, p_event_id: eventId });
  t.check(exported.status === "ok" && exported.rows.length === VOTERS, `exactly ${VOTERS} rows stored (no duplicates per device)`, exported.rows?.length);

  const latencies = [...p1, ...p2].map((r) => r.ms);
  console.log(
    `\nVote request latency: median ${percentile(latencies, 0.5)} ms, p95 ${percentile(latencies, 0.95)} ms, max ${Math.max(...latencies)} ms`,
  );
  console.log(`Realtime signals received: ${signals}; display fetches: ${fetches} (coalesced)`);

  clearInterval(poll);
  fetcher.stop();
  await supabase.removeAllChannels();
  if (!keep) {
    const del = await rpc<{ status: string }>("heatmap_host_delete_event", { p_pin: pin, p_event_id: eventId });
    t.check(del.status === "ok", "load-test event deleted");
  } else {
    console.log(`Event kept: ${code} (${eventId})`);
  }

  console.log(t.failed === 0 ? "\nALL CHECKS PASSED" : `\n${t.failed} CHECK(S) FAILED`);
  process.exit(t.failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
