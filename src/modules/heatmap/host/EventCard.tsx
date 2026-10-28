/** One event in the host console: state, participant link and every host action. */
import { useState } from "react";
import { publicBaseUrl } from "../../../platform/env";
import { israelShort } from "../../../platform/time";
import { hostDeleteEvent, hostExport, hostResetEvent, hostSetState, type AuthFailure, type HostEvent } from "../api";
import { HOST_UI } from "../content";
import { downloadEventCsv } from "../exportCsv";
import { ConfirmDialog } from "./ConfirmDialog";

interface Props {
  pin: string;
  event: HostEvent;
  onChanged: () => void;
  onAuthFailure: (status: AuthFailure) => void;
}

type Confirm = "reset" | "delete" | null;

const isAuthFailure = (s: string): s is AuthFailure =>
  s === "unauthorized" || s === "locked" || s === "not_configured";

export function EventCard({ pin, event, onChanged, onAuthFailure }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const url = `${publicBaseUrl()}/v/${event.short_code}`;

  async function run(action: () => Promise<{ status: string }>) {
    setBusy(true);
    setError(null);
    try {
      const res = await action();
      if (isAuthFailure(res.status)) onAuthFailure(res.status);
      else if (res.status !== "ok") setError(HOST_UI.actionFailed);
    } catch {
      setError(HOST_UI.actionFailed);
    } finally {
      setBusy(false);
      onChanged();
    }
  }

  const setState = (state: Parameters<typeof hostSetState>[2]) => run(() => hostSetState(pin, event.id, state));

  const exportCsv = () =>
    run(async () => {
      const res = await hostExport(pin, event.id);
      if (res.status === "ok") downloadEventCsv(event.short_code, res.rows);
      return res;
    });

  const openDisplay = () => {
    // No "noopener": the new window must start with a copy of this tab's
    // sessionStorage, which carries the PIN for the display's control bar.
    window.open(`/heatmap/display/${event.id}`, `ngg-display-${event.id}`);
  };

  return (
    <article className="h-card" aria-labelledby={`ev-${event.id}`} aria-busy={busy}>
      <div className="h-card-head">
        <div className="h-card-heading">
          <h3 id={`ev-${event.id}`} className="h-card-title">
            {event.name}
          </h3>
          <p className="h-card-meta">
            {HOST_UI.created} {israelShort(event.created_at)} · {HOST_UI.code}{" "}
            <strong className="ltr">{event.short_code}</strong>
          </p>
        </div>
        <p className="h-card-count">
          <span className="h-card-count-number">{event.voters}</span>
          <span>{HOST_UI.voters}</span>
        </p>
      </div>

      <ul className="h-chips">
        <li className={event.voting_open ? "h-chip" : "h-chip is-strong"}>
          {event.voting_open ? HOST_UI.open : HOST_UI.closed}
        </li>
        <li className={event.revealed ? "h-chip is-blue" : "h-chip"}>
          {event.revealed ? HOST_UI.revealed : HOST_UI.hidden}
        </li>
        {event.show_mean ? <li className="h-chip">{HOST_UI.meanOn}</li> : null}
        {event.show_dots === false ? <li className="h-chip">{HOST_UI.dotsOff}</li> : null}
      </ul>

      <p className="h-link">
        <span>{HOST_UI.link}</span>{" "}
        <a className="ltr" href={url} target="_blank" rel="noreferrer">
          {url.replace(/^https?:\/\//, "")}
        </a>
      </p>

      <div className="h-actions">
        <div className="h-actions-group">
          <button type="button" className="btn btn-primary" onClick={openDisplay}>
            {HOST_UI.openDisplay}
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setState({ revealed: !event.revealed })}>
            {event.revealed ? HOST_UI.hide : HOST_UI.reveal}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => setState({ voting_open: !event.voting_open })}
          >
            {event.voting_open ? HOST_UI.closeVoting : HOST_UI.reopenVoting}
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setState({ show_mean: !event.show_mean })}>
            {event.show_mean ? HOST_UI.hideMean : HOST_UI.showMean}
          </button>
          {/* Left out until the show_dots migration is applied. */}
          {event.show_dots !== undefined ? (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => setState({ show_dots: !event.show_dots })}
            >
              {event.show_dots ? HOST_UI.hideDots : HOST_UI.showDots}
            </button>
          ) : null}
        </div>
        <div className="h-actions-group">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={exportCsv}>
            {HOST_UI.exportCsv}
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setConfirm("reset")}>
            {HOST_UI.reset}
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setConfirm("delete")}>
            {HOST_UI.delete}
          </button>
        </div>
      </div>

      {error ? (
        <p className="h-error" role="alert">
          {error}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "delete" ? HOST_UI.deleteTitle : HOST_UI.resetTitle}
        body={confirm === "delete" ? HOST_UI.deleteBody(event.name) : HOST_UI.resetBody(event.name)}
        confirmLabel={confirm === "delete" ? HOST_UI.delete : HOST_UI.reset}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          await run(() => (confirm === "delete" ? hostDeleteEvent(pin, event.id) : hostResetEvent(pin, event.id)));
          setConfirm(null);
        }}
      />
    </article>
  );
}
