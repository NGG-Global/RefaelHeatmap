/** After the reveal: the bubble matrix, event name and voter count. Updates live. */
import { Stage } from "../../../platform/Stage";
import nggMark from "../../../platform/ngg-mark.png";
import type { Cell } from "../api";
import { DISPLAY_UI, VOTERS_SUFFIX } from "../content";
import { BubbleMatrix } from "./BubbleMatrix";

interface Props {
  name: string;
  voters: number;
  votingOpen: boolean;
  cells: readonly Cell[];
  mean: { x: number; y: number } | null;
}

export function Results({ name, voters, votingOpen, cells, mean }: Props) {
  return (
    <Stage ground="var(--white)">
      <div className="results">
        <BubbleMatrix cells={cells} mean={mean} />

        <h1 className="results-name">{name}</h1>

        <div className="results-count" aria-live="polite">
          <span className="count-number">{voters}</span>
          <span className="count-label">{VOTERS_SUFFIX}</span>
        </div>
        {!votingOpen ? <p className="stage-badge results-badge">{DISPLAY_UI.votingClosedBadge}</p> : null}

        <img className="stage-logo" src={nggMark} alt="NGG" />
      </div>
    </Stage>
  );
}
