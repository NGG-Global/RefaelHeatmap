/**
 * Projector display — /heatmap/display/:eventId (1920 × 1080).
 * Shows the lobby (QR + live count) until the host reveals, then the heatmap.
 * What is visible is decided by heatmap_display() in the database.
 * ?view=matrix shows the backup bubble matrix (alternative A) instead.
 */
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { clearHostPin, getHostPin } from "../../../platform/hostSession";
import { SimplePage } from "../../../platform/SimplePage";
import { hostListEvents } from "../api";
import { DISPLAY_UI } from "../content";
import { useDisplayData } from "../useDisplayData";
import { HostBar } from "./HostBar";
import { Lobby } from "./Lobby";
import { Results, type ResultsView } from "./Results";
import "./display.css";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function DisplayPage() {
  const eventId = useParams().eventId ?? "";
  if (!UUID_RE.test(eventId)) return <SimplePage title={DISPLAY_UI.notFound} />;
  return <DisplayScreen eventId={eventId} />;
}

/** The PIN from this tab's session, once the database has accepted it. */
function useVerifiedHostPin() {
  const [pin, setPin] = useState<string | null>(null);
  useEffect(() => {
    const stored = getHostPin();
    if (!stored) return;
    hostListEvents(stored)
      .then((res) => {
        if (res.status === "ok") setPin(stored);
        else if (res.status === "unauthorized" || res.status === "not_configured") clearHostPin();
      })
      .catch(() => undefined);
  }, []);
  return { pin, clear: () => setPin(null) };
}

function DisplayScreen({ eventId }: { eventId: string }) {
  const { data, connection, refetch } = useDisplayData(eventId);
  const host = useVerifiedHostPin();
  const view: ResultsView = useSearchParams()[0].get("view") === "matrix" ? "matrix" : "heatmap";

  useEffect(() => {
    if (data?.status === "ok") document.title = data.name;
  }, [data]);

  if (!data) return <div className="display-blank" />;
  if (data.status === "not_found") return <SimplePage title={DISPLAY_UI.notFound} />;

  return (
    <>
      {data.revealed ? (
        <Results
          name={data.name}
          voters={data.voters}
          votingOpen={data.voting_open}
          cells={data.cells ?? []}
          mean={data.show_mean ? data.mean : null}
          showDots={data.show_dots ?? true}
          view={view}
        />
      ) : (
        <Lobby name={data.name} shortCode={data.short_code} voters={data.voters} votingOpen={data.voting_open} />
      )}

      {connection === "degraded" ? (
        <p className="display-offline" role="status">
          {DISPLAY_UI.offline}
        </p>
      ) : null}

      {host.pin ? (
        <HostBar
          pin={host.pin}
          eventId={eventId}
          revealed={data.revealed}
          votingOpen={data.voting_open}
          showMean={data.show_mean}
          showDots={data.show_dots}
          onChanged={refetch}
          onAuthLost={host.clear}
        />
      ) : null}
    </>
  );
}
