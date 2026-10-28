/**
 * Host controls on the display: shown only when a valid host PIN is in this
 * tab's session. Hides itself (and the cursor) after IDLE_MS without mouse
 * movement, so the projected image stays clean.
 * Reset asks once more on the bar itself ("לאשר איפוס?") and gives up after
 * CONFIRM_MS, so the projected screen never shows a dialog.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { clearHostPin } from "../../../platform/hostSession";
import { hostResetEvent, hostSetState } from "../api";
import { DISPLAY_UI } from "../content";

const IDLE_MS = 3000;
const CONFIRM_MS = 5000;

interface Props {
  pin: string;
  eventId: string;
  revealed: boolean;
  votingOpen: boolean;
  showMean: boolean;
  /** Undefined until the show_dots migration is applied: the toggle is then left out. */
  showDots: boolean | undefined;
  onChanged: () => void;
  onAuthLost: () => void;
}

export function HostBar({ pin, eventId, revealed, votingOpen, showMean, showDots, onChanged, onAuthLost }: Props) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    let timer = window.setTimeout(() => setVisible(false), IDLE_MS);
    const wake = () => {
      setVisible(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setVisible(false), IDLE_MS);
    };
    window.addEventListener("mousemove", wake);
    window.addEventListener("keydown", wake);
    window.addEventListener("touchstart", wake);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("keydown", wake);
      window.removeEventListener("touchstart", wake);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("cursor-hidden", !visible);
    if (!visible) setConfirmReset(false);
    return () => document.body.classList.remove("cursor-hidden");
  }, [visible]);

  useEffect(() => {
    if (!confirmReset) return;
    const timer = window.setTimeout(() => setConfirmReset(false), CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [confirmReset]);

  async function run(action: () => Promise<{ status: string }>) {
    setBusy(true);
    try {
      const res = await action();
      if (res.status === "unauthorized" || res.status === "not_configured") {
        clearHostPin();
        onAuthLost();
      }
    } catch {
      /* the next refetch shows the real state */
    } finally {
      setBusy(false);
      onChanged();
    }
  }

  const apply = (state: Parameters<typeof hostSetState>[2]) => run(() => hostSetState(pin, eventId, state));

  function reset() {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    void run(() => hostResetEvent(pin, eventId));
  }

  /**
   * Back to the host console. A display opened from the console closes itself,
   * which brings the console window back without projecting the event list;
   * otherwise (or if the browser refuses to close it) navigate to the console.
   */
  function backToConsole() {
    const opener = window.opener as Window | null;
    let openedFromConsole = false;
    try {
      openedFromConsole = !!opener && !opener.closed && opener.location.pathname === "/heatmap/host";
    } catch {
      openedFromConsole = false; // cross-origin opener
    }
    if (openedFromConsole) {
      opener!.focus();
      window.close();
    }
    window.setTimeout(() => {
      if (!window.closed) navigate("/heatmap/host");
    }, 300);
  }

  return (
    <div className={visible ? "hostbar" : "hostbar is-hidden"} role="toolbar" aria-label={DISPLAY_UI.hostControls}>
      <button type="button" className="btn hostbar-back" onClick={backToConsole}>
        {DISPLAY_UI.backToConsole}
      </button>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => apply({ revealed: !revealed })}>
        {revealed ? DISPLAY_UI.hide : DISPLAY_UI.reveal}
      </button>
      <button type="button" className="btn btn-light" disabled={busy} onClick={() => apply({ voting_open: !votingOpen })}>
        {votingOpen ? DISPLAY_UI.closeVoting : DISPLAY_UI.openVoting}
      </button>
      <button type="button" className="btn btn-light" disabled={busy} onClick={() => apply({ show_mean: !showMean })}>
        {showMean ? DISPLAY_UI.hideMean : DISPLAY_UI.showMean}
      </button>
      {showDots !== undefined ? (
        <button type="button" className="btn btn-light" disabled={busy} onClick={() => apply({ show_dots: !showDots })}>
          {showDots ? DISPLAY_UI.hideDots : DISPLAY_UI.showDots}
        </button>
      ) : null}
      <button
        type="button"
        className={confirmReset ? "btn hostbar-reset is-confirming" : "btn hostbar-reset"}
        disabled={busy}
        onClick={reset}
      >
        {confirmReset ? DISPLAY_UI.resetConfirm : DISPLAY_UI.reset}
      </button>
    </div>
  );
}
