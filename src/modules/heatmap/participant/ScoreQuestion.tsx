import { keepHyphenated } from "../../../platform/text";
import type { Question } from "../content";
import { PARTICIPANT_UI } from "../content";
import { ScoreSlider } from "./ScoreSlider";

interface Props {
  question: Question;
  value: number | null;
  onChange: (score: number) => void;
}

/**
 * One question, laid out as on the slide: a header bar "ציר X | <axis name>",
 * the five anchor bands (the chosen score's band highlighted), then the 1–10
 * gauge below them, so the dragging finger never covers the bands.
 */
export function ScoreQuestion({ question, value, onChange }: Props) {
  const titleId = `q-${question.axis}-title`;
  const bandFor = (v: number) => question.bands.find((b) => v >= b.from && v <= b.to)!;
  const band = value === null ? null : bandFor(value);

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

      <ol className="q-bands">
        {question.bands.map((b) => (
          <li key={b.from} className={b === band ? "q-band is-active" : "q-band"} aria-current={b === band || undefined}>
            <span className="q-band-range">
              {b.from}-{b.to}
            </span>
            <span className="q-band-text">{keepHyphenated(b.text)}</span>
          </li>
        ))}
      </ol>

      <p className={value === null ? "q-hint" : "q-hint is-done"} aria-hidden="true">
        {PARTICIPANT_UI.slidePrompt}
      </p>

      <ScoreSlider
        value={value}
        onChange={onChange}
        labelledBy={titleId}
        valueText={(v) => (v === null ? PARTICIPANT_UI.sliderEmpty : `${v}: ${bandFor(v).text}`)}
      />
    </section>
  );
}
