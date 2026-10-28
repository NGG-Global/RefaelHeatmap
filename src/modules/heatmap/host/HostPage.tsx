/**
 * Host console — /heatmap/host.
 * PIN entry (kept in sessionStorage only), create / list events, and every
 * per-event action. Voter counts update live over each event's channel.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { coalesce } from "../../../platform/coalesce";
import { clearHostPin, getHostPin, setHostPin } from "../../../platform/hostSession";
import { subscribeToSignal } from "../../../platform/realtime";
import { hostCreateEvent, hostListEvents, type AuthFailure, type HostEvent } from "../api";
import { HOST_UI } from "../content";
import { EventCard } from "./EventCard";
import "./host.css";

const POLL_MS = 5000;

const authMessage = (status: AuthFailure) =>
  status === "locked" ? HOST_UI.pinLocked : status === "not_configured" ? HOST_UI.pinNotConfigured : HOST_UI.pinWrong;

export default function HostPage() {
  const [pin, setPin] = useState<string | null>(() => getHostPin());
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${HOST_UI.title} · ${HOST_UI.subtitle}`;
  }, []);

  if (!pin) {
    return (
      <PinGate
        notice={notice}
        onSignedIn={(p) => {
          setHostPin(p);
          setNotice(null);
          setPin(p);
        }}
      />
    );
  }
  return (
    <Console
      pin={pin}
      onSignOut={(message) => {
        clearHostPin();
        setNotice(message ?? null);
        setPin(null);
      }}
    />
  );
}

function PinGate({ notice, onSignedIn }: { notice: string | null; onSignedIn: (pin: string) => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(notice);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      const res = await hostListEvents(value);
      if (res.status === "ok") onSignedIn(value);
      else setError(authMessage(res.status as AuthFailure));
    } catch {
      setError(HOST_UI.actionFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="h-gate">
      <form className="h-gate-form" onSubmit={submit}>
        <p className="h-kicker">NGG Platform</p>
        <h1 className="h-gate-title">{HOST_UI.title}</h1>
        <label className="h-label" htmlFor="host-pin">
          {HOST_UI.pinLabel}
        </label>
        <input
          id="host-pin"
          className="h-input"
          type="password"
          autoComplete="current-password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          dir="ltr"
        />
        <button type="submit" className="btn btn-primary h-gate-button" disabled={busy || !value}>
          {HOST_UI.signIn}
        </button>
        <p className="h-gate-error" role="alert">
          {error ?? ""}
        </p>
      </form>
    </main>
  );
}

function Console({ pin, onSignOut }: { pin: string; onSignOut: (message?: string) => void }) {
  const [events, setEvents] = useState<HostEvent[] | null>(null);
  const [locked, setLocked] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleAuthFailure = (status: AuthFailure) => {
    if (status === "locked") setLocked(true);
    else onSignOut(status === "unauthorized" ? HOST_UI.sessionExpired : HOST_UI.pinNotConfigured);
  };
  const authFailureRef = useRef(handleAuthFailure);
  authFailureRef.current = handleAuthFailure;

  // One coalesced loader shared by polling, realtime signals and actions. It
  // lives and dies with the effect, so a remount always gets a running one.
  const loadRef = useRef<() => void>(() => undefined);
  const reload = useCallback(() => loadRef.current(), []);

  useEffect(() => {
    const loader = coalesce(async () => {
      const res = await hostListEvents(pin);
      if (res.status === "ok") {
        setEvents(res.events);
        setLocked(false);
      } else if (res.status === "unauthorized" || res.status === "locked" || res.status === "not_configured") {
        authFailureRef.current(res.status);
      }
    }, 1000);
    loadRef.current = loader.run;
    loader.run();
    const poll = window.setInterval(loader.run, POLL_MS);
    return () => {
      window.clearInterval(poll);
      loader.stop();
    };
  }, [pin]);

  const eventIds = (events ?? []).map((e) => e.id).join(",");
  useEffect(() => {
    if (!eventIds) return;
    const unsubscribes = eventIds.split(",").map((id) => subscribeToSignal(`heatmap:${id}`, "changed", reload));
    return () => unsubscribes.forEach((u) => u());
  }, [eventIds, reload]);

  async function create(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 120) {
      setCreateError(HOST_UI.nameInvalid);
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await hostCreateEvent(pin, trimmed);
      if (res.status === "ok") setName("");
      else if (res.status === "unauthorized" || res.status === "locked" || res.status === "not_configured")
        handleAuthFailure(res.status);
      else setCreateError(res.status === "invalid" ? HOST_UI.nameInvalid : HOST_UI.actionFailed);
    } catch {
      setCreateError(HOST_UI.actionFailed);
    } finally {
      setCreating(false);
      reload();
    }
  }

  return (
    <div className="h-page">
      <header className="h-header">
        <div className="h-header-inner">
          <div className="h-brand">
            <p className="h-kicker">NGG Platform</p>
            <h1 className="h-title">
              {HOST_UI.title} <span className="h-subtitle">{HOST_UI.subtitle}</span>
            </h1>
          </div>
          <button type="button" className="btn btn-light" onClick={() => onSignOut()}>
            {HOST_UI.signOut}
          </button>
        </div>

        <form className="h-create" onSubmit={create}>
          <label className="h-label" htmlFor="new-event-name">
            {HOST_UI.newEvent}
          </label>
          <div className="h-create-row">
            <input
              id="new-event-name"
              className="h-input"
              type="text"
              maxLength={120}
              placeholder={HOST_UI.eventName}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={creating || !name.trim()}>
              {HOST_UI.create}
            </button>
          </div>
          {createError ? (
            <p className="h-create-error" role="alert">
              {createError}
            </p>
          ) : null}
        </form>
      </header>

      <main className="h-main">
        {locked ? (
          <p className="h-banner" role="alert">
            {HOST_UI.pinLocked}
          </p>
        ) : null}
        <h2 className="h-section-title">{HOST_UI.events}</h2>
        {events === null ? null : events.length === 0 ? (
          <p className="h-empty">{HOST_UI.noEvents}</p>
        ) : (
          <div className="h-list">
            {events.map((ev) => (
              <EventCard key={ev.id} pin={pin} event={ev} onChanged={reload} onAuthFailure={handleAuthFailure} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
