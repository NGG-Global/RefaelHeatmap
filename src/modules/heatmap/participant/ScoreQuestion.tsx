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
 * One question: the slide's header bar "ציר X | <axis name>", then the anchor
 * title for the chosen score, then the 1–10 slider (below, so the dragging
 * finger never covers the title).
 * Every title is laid out in the same grid cell and only the current one is
 * shown, so the box is as tall as the longest title and nothing below moves
 * while the score changes; titles cross-fade.
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

      {/* The slider's value text carries the same title for screen readers. */}
      <div className={band ? "q-readout is-set" : "q-readout"} aria-hidden="true">
        <span className="q-readout-score">{value ?? ""}</span>
        <div className="q-readout-titles">
          <span className={band ? "q-readout-title is-prompt" : "q-readout-title is-prompt is-current"}>
            {PARTICIPANT_UI.slidePrompt}
          </span>
          {question.bands.map((b) => (
            <span key={b.from} className={b === band ? "q-readout-title is-current" : "q-readout-title"}>
              {keepHyphenated(b.text)}
            </span>
          ))}
        </div>
      </div>

      <ScoreSlider
        value={value}
        onChange={onChange}
        labelledBy={titleId}
        valueText={(v) => (v === null ? PARTICIPANT_UI.sliderEmpty : `${v}: ${bandFor(v).text}`)}
      />
    </section>
  );
}
