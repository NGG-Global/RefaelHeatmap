/**
 * Participant voting page — /v/:shortCode (phone, Hebrew, RTL).
 * Kept light for weak cellular reception: plain fetch, no Realtime, no
 * supabase-js. The form renders immediately; the event lookup only decides
 * whether to swap in the closed / not-found message.
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { getDeviceId } from "../../../platform/deviceId";
import { Dot, Trail } from "../../../platform/Motif";
import { RpcError } from "../../../platform/rpc";
import { SimplePage } from "../../../platform/SimplePage";
import { castVote, eventPublic } from "../api";
import { MESSAGES, OPENING_LINE, PARTICIPANT_UI, QUESTION_X, QUESTION_Y } from "../content";
import { ScoreQuestion } from "./ScoreQuestion";
import "./participant.css";

const CODE_RE = /^[A-HJ-NP-Z2-9]{5,6}$/;

type Phase = "form" | "closed" | "not_found";
interface Vote {
  x: number;
  y: number;
}

// The last vote this browser sent for this code, so a reload restores the
// answers. Only a convenience: the database holds the truth.
const voteKey = (code: string) => `ngg.heatmap.vote.${code}`;

function loadVote(code: string): Vote | null {
  try {
    const v = JSON.parse(window.localStorage.getItem(voteKey(code)) ?? "null") as Vote | null;
    return v && Number.isInteger(v.x) && Number.isInteger(v.y) ? v : null;
  } catch {
    return null;
  }
}

function saveVote(code: string, vote: Vote): void {
  try {
    window.localStorage.setItem(voteKey(code), JSON.stringify(vote));
  } catch {
    /* storage unavailable */
  }
}

export default function ParticipantPage() {
  const code = (useParams().shortCode ?? "").trim().toUpperCase();
  const validCode = CODE_RE.test(code);

  const [phase, setPhase] = useState<Phase>(validCode ? "form" : "not_found");
  const [eventName, setEventName] = useState<string | null>(null);
  const [x, setX] = useState<number | null>(() => (validCode ? loadVote(code)?.x ?? null : null));
  const [y, setY] = useState<number | null>(() => (validCode ? loadVote(code)?.y ?? null : null));
  const [submitted, setSubmitted] = useState<Vote | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!validCode) return;
    let cancelled = false;
    eventPublic(code)
      .then((res) => {
        if (cancelled) return;
        if (res.status === "not_found") setPhase("not_found");
        else {
          setEventName(res.name);
          if (!res.voting_open) setPhase("closed");
        }
      })
      .catch(() => {
        /* Weak signal: keep the form; submitting reports the real state. */
      });
    return () => {
      cancelled = true;
    };
  }, [code, validCode]);

  if (phase === "closed") return <SimplePage title={MESSAGES.votingClosed} />;
  if (phase === "not_found") return <SimplePage title={PARTICIPANT_UI.notFoundTitle} body={PARTICIPANT_UI.notFoundBody} />;

  const answered = x !== null && y !== null;
  const unchanged = submitted !== null && submitted.x === x && submitted.y === y;
  const canSubmit = answered && !unchanged && !sending;

  const choose = (setter: (v: number) => void) => (score: number) => {
    setter(score);
    setError(null);
  };

  async function submit() {
    if (x === null || y === null) return;
    if (!navigator.onLine) {
      setError(PARTICIPANT_UI.offline);
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await castVote(code, getDeviceId(), x, y);
      if (res.status === "ok") {
        setSubmitted({ x, y });
        saveVote(code, { x, y });
      } else if (res.status === "closed") {
        setPhase("closed");
      } else if (res.status === "not_found") {
        setPhase("not_found");
      } else {
        setError(PARTICIPANT_UI.sendFailed);
      }
    } catch (e) {
      setError(e instanceof RpcError && !navigator.onLine ? PARTICIPANT_UI.offline : PARTICIPANT_UI.sendFailed);
    } finally {
      setSending(false);
    }
  }

  let status: { text: string; tone: "hint" | "success" | "error" } | null = null;
  if (error) status = { text: error, tone: "error" };
  else if (unchanged) status = { text: MESSAGES.submitted, tone: "success" };
  else if (!answered) status = { text: PARTICIPANT_UI.answerBoth, tone: "hint" };

  return (
    <div className="p-page">
      <header className="p-hero">
        <div className="p-hero-motif" dir="ltr" aria-hidden="true">
          <Trail x={-96} y={-26} rot={148.5} />
          <Dot x={-34} y={74} />
        </div>
        <div className="p-hero-copy">
          {eventName ? <p className="p-event">{eventName}</p> : null}
          <h1 className="p-intro">{OPENING_LINE}</h1>
        </div>
      </header>

      <main className="p-body">
        <ScoreQuestion question={QUESTION_X} value={x} onChange={choose(setX)} />
        <ScoreQuestion question={QUESTION_Y} value={y} onChange={choose(setY)} />
      </main>

      <footer className="p-submit">
        <div className="p-submit-inner">
          <p
            className={status ? `p-status is-${status.tone}` : "p-status"}
            role={status?.tone === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {status?.text ?? ""}
          </p>
          <button type="button" className="btn btn-primary p-submit-button" disabled={!canSubmit} onClick={submit}>
            {sending ? PARTICIPANT_UI.sending : submitted ? PARTICIPANT_UI.resubmit : PARTICIPANT_UI.submit}
          </button>
        </div>
      </footer>
    </div>
  );
}
