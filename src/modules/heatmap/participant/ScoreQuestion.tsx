import type { Question } from "../content";
import { PARTICIPANT_UI } from "../content";

interface Props {
  index: number;
  question: Question;
  value: number | null;
  onChange: (score: number) => void;
}

/** One question: ten large score buttons, two per anchor band, band text beside them. */
export function ScoreQuestion({ index, question, value, onChange }: Props) {
  const titleId = `q-${question.axis}-title`;
  return (
    <section className="q" aria-labelledby={titleId}>
      <p className="q-kicker">
        <span className="q-index" aria-hidden="true">
          {index}
        </span>
        {question.axisLabel}
      </p>
      <h2 id={titleId} className="q-title">
        {question.question}
      </h2>
      <div className="bands" role="radiogroup" aria-labelledby={titleId}>
        {question.bands.map((band) => {
          const active = value !== null && value >= band.from && value <= band.to;
          const bandId = `q-${question.axis}-band-${band.from}`;
          return (
            <div key={band.from} className={active ? "band is-active" : "band"}>
              <div className="band-scores">
                {[band.from, band.to].map((score) => (
                  <label key={score} className="score">
                    <input
                      className="score-input"
                      type="radio"
                      name={`q-${question.axis}`}
                      value={score}
                      checked={value === score}
                      onChange={() => onChange(score)}
                      aria-label={PARTICIPANT_UI.scoreLabel(score)}
                      aria-describedby={bandId}
                    />
                    <span className="score-face" aria-hidden="true">
                      {score}
                    </span>
                  </label>
                ))}
              </div>
              <p id={bandId} className="band-text">
                {band.text}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
