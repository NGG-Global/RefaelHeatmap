import { keepHyphenated } from "../../../platform/text";
import type { Question } from "../content";
import { PARTICIPANT_UI } from "../content";
import { ScoreSlider } from "./ScoreSlider";

interface Props {
  index: number;
  question: Question;
  value: number | null;
  onChange: (score: number) => void;
}

/**
 * One question: a 1–10 gauge, with the anchor-band text for the chosen score
 * shown above it (above, so the dragging finger never covers it).
 */
export function ScoreQuestion({ index, question, value, onChange }: Props) {
  const titleId = `q-${question.axis}-title`;
  const bandFor = (v: number) => question.bands.find((b) => v >= b.from && v <= b.to)!;
  const band = value === null ? null : bandFor(value);

  return (
    <section className="q" aria-labelledby={titleId}>
      <p className="q-kicker">
        <span className="q-index" aria-hidden="true">
          {index}
        </span>
        {/* one element, so the kicker's flex gap never splits the label */}
        <span>{keepHyphenated(question.axisLabel)}</span>
      </p>
      <h2 id={titleId} className="q-title">
        {keepHyphenated(question.question)}
      </h2>

      <div className={band ? "q-readout is-set" : "q-readout"} aria-hidden="true">
        {band ? (
          <>
            <span className="q-readout-range">
              {band.from}–{band.to}
            </span>
            <span className="q-readout-text">{keepHyphenated(band.text)}</span>
          </>
        ) : (
          <span className="q-readout-prompt">{PARTICIPANT_UI.slidePrompt}</span>
        )}
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
