/**
 * Runs `task` with at most one call in flight. Calls made while it runs
 * collapse into a single follow-up run, so a burst of signals costs two
 * fetches, not one per signal. `minGapMs` spaces consecutive runs.
 */
export function coalesce(task: () => Promise<unknown>, minGapMs = 0) {
  let inFlight = false;
  let pending = false;
  let stopped = false;
  let lastStart = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const run = (): void => {
    if (stopped) return;
    if (inFlight) {
      pending = true;
      return;
    }
    const wait = lastStart + minGapMs - Date.now();
    if (wait > 0) {
      timer ??= setTimeout(() => {
        timer = null;
        run();
      }, wait);
      return;
    }
    inFlight = true;
    lastStart = Date.now();
    task()
      .catch(() => undefined)
      .finally(() => {
        inFlight = false;
        if (pending) {
          pending = false;
          run();
        }
      });
  };

  const stop = (): void => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };

  return { run, stop };
}
