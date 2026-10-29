import { keepHyphenated } from "../../../platform/text";
import type { Question } from "../content";
import { PARTICIPANT_UI } from "../content";

interface Props {
  question: Question;
  value: number | null;
  onChange: (score: number) => void;
}

/**
 * One question, laid out as on the slide: a header bar "ציר X | <axis name>",
 * then the five anchor bands. As the brief asks, each band row carries its two
 * of the ten large score buttons (buttons, not a slider, so a touch never picks
 * the wrong score); the chosen score's band is highlighted.
 */
export function ScoreQuestion({ question, value, onChange }: Props) {
  const titleId = `q-${question.axis}-title`;

  return (
    <section className={`q is-${question.axis}`} aria-labelledby={titleId}>
      <h2 id={titleId} className="q-head">
        <span className="q-head-tag">{question.axisTag}</span>
        <span className="q-head-sep" aria-hidden="true">
          |
        </span>
        <span>{keepHyphenated(question.axisLabel)}</span>
      </h2>
      {question.text ? <p className="q-text">{keepHyphenated(question.text)}</p> : null}
      {question.note ? <p className="q-note">{keepHyphenated(question.note)}</p> : null}

      <div className="q-bands" role="radiogroup" aria-labelledby={titleId}>
        {question.bands.map((band) => {
          const active = value !== null && value >= band.from && value <= band.to;
          const bandId = `q-${question.axis}-band-${band.from}`;
          return (
            <div key={band.from} className={active ? "q-band is-active" : "q-band"}>
              <div className="q-band-scores">
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
              <p id={bandId} className="q-band-text">
                {keepHyphenated(band.text)}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
