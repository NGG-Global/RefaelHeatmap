/**
 * Live display data for one event.
 * - Refetches heatmap_display() on every "changed" broadcast, coalesced so a
 *   burst of votes costs at most one fetch in flight plus one follow-up.
 * - Fallback poll every POLL_MS, and a refetch on (re)subscribe, on tab focus
 *   and when the network returns, in case a message was missed.
 */
import { useEffect, useRef, useState } from "react";
import { coalesce } from "../../platform/coalesce";
import { subscribeToSignal } from "../../platform/realtime";
import { RpcError } from "../../platform/rpc";
import { display, type DisplayData } from "./api";

export const POLL_MS = 5000;

export type Connection = "ok" | "degraded";

export function useDisplayData(eventId: string) {
  const [data, setData] = useState<DisplayData | null>(null);
  const [connection, setConnection] = useState<Connection>("ok");
  const refetchRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    let alive = true;
    let failures = 0;

    const fetcher = coalesce(async () => {
      try {
        const next = await display(eventId);
        if (!alive) return;
        failures = 0;
        setData(next);
        setConnection("ok");
      } catch (error) {
        if (!alive) return;
        if (error instanceof RpcError && error.httpStatus === 400) {
          setData({ status: "not_found" });
          return;
        }
        failures++;
        if (failures >= 2) setConnection("degraded");
      }
    });
    refetchRef.current = fetcher.run;
    fetcher.run();

    const unsubscribe = subscribeToSignal(`heatmap:${eventId}`, "changed", fetcher.run, (status) => {
      if (status === "SUBSCRIBED") fetcher.run();
    });
    const poll = window.setInterval(fetcher.run, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetcher.run();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", fetcher.run);

    return () => {
      alive = false;
      fetcher.stop();
      unsubscribe();
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", fetcher.run);
    };
  }, [eventId]);

  return { data, connection, refetch: () => refetchRef.current() };
}
