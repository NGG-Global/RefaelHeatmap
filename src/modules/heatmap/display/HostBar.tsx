/**
 * Host controls on the display: shown only when a valid host PIN is in this
 * tab's session. Hides itself (and the cursor) after IDLE_MS without mouse
 * movement, so the projected image stays clean.
 */
import { useEffect, useState } from "react";
import { clearHostPin } from "../../../platform/hostSession";
import { hostSetState } from "../api";
import { DISPLAY_UI } from "../content";

const IDLE_MS = 3000;

interface Props {
  pin: string;
  eventId: string;
  revealed: boolean;
  votingOpen: boolean;
  showMean: boolean;
  onChanged: () => void;
  onAuthLost: () => void;
}

export function HostBar({ pin, eventId, revealed, votingOpen, showMean, onChanged, onAuthLost }: Props) {
  const [visible, setVisible] = useState(true);
  const [busy, setBusy] = useState(false);

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
    return () => document.body.classList.remove("cursor-hidden");
  }, [visible]);

  async function apply(state: { voting_open?: boolean; revealed?: boolean; show_mean?: boolean }) {
    setBusy(true);
    try {
      const res = await hostSetState(pin, eventId, state);
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

  return (
    <div className={visible ? "hostbar" : "hostbar is-hidden"} role="toolbar" aria-label={DISPLAY_UI.hostControls}>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => apply({ revealed: !revealed })}>
        {revealed ? DISPLAY_UI.hide : DISPLAY_UI.reveal}
      </button>
      <button type="button" className="btn btn-light" disabled={busy} onClick={() => apply({ voting_open: !votingOpen })}>
        {votingOpen ? DISPLAY_UI.closeVoting : DISPLAY_UI.openVoting}
      </button>
      <button type="button" className="btn btn-light" disabled={busy} onClick={() => apply({ show_mean: !showMean })}>
        {showMean ? DISPLAY_UI.hideMean : DISPLAY_UI.showMean}
      </button>
    </div>
  );
}
