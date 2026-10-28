/**
 * Home — the bare site address and any unknown path.
 * Participants can type the voting code shown on the projector (a fallback
 * when a QR scan fails); hosts get a way into the host console.
 */
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { HOME_UI } from "./content";
import { Comet } from "./Motif";
import "./simple-page.css";
import "./home.css";

const CODE_RE = /^[A-HJ-NP-Z2-9]{5,6}$/;

export default function HomePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const normalized = code.replace(/[\s-]/g, "").toUpperCase();
    if (!CODE_RE.test(normalized)) {
      setError(HOME_UI.codeInvalid);
      return;
    }
    navigate(`/v/${normalized}`);
  }

  return (
    <main className="simple-page">
      <div className="simple-page-motif" dir="ltr" aria-hidden="true">
        {/* trail at the template rotation 36.7°, running off the left edge */}
        <Comet x={64} y={176} angle={-143.3} />
      </div>
      <div className="simple-page-copy home">
        <h1 className="simple-page-title">{HOME_UI.title}</h1>

        <form className="home-form" onSubmit={submit} noValidate>
          <label className="home-label" htmlFor="home-code">
            {HOME_UI.codeLabel}
          </label>
          <div className="home-row">
            <input
              id="home-code"
              className="home-input"
              dir="ltr"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError(null);
              }}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={8}
              aria-invalid={error !== null}
              aria-describedby="home-code-error"
            />
            <button type="submit" className="btn btn-primary home-go" disabled={!code.trim()}>
              {HOME_UI.go}
            </button>
          </div>
          <p id="home-code-error" className="home-error" role="alert">
            {error ?? ""}
          </p>
        </form>

        <Link to="/heatmap/host" className="btn btn-light home-host">
          {HOME_UI.host}
        </Link>
      </div>
    </main>
  );
}
