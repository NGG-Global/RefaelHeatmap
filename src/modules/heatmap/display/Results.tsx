/**
 * After the reveal: the heatmap (or the backup bubble matrix), event name and
 * voter count. Updates live.
 */
import { Stage } from "../../../platform/Stage";
import type { Cell } from "../api";
import { DISPLAY_UI, VOTERS_SUFFIX } from "../content";
import { StageFooter } from "./StageFooter";
import { BubbleMatrix } from "./BubbleMatrix";
import { HeatmapMap } from "./HeatmapMap";

export type ResultsView = "heatmap" | "matrix";

interface Props {
  name: string;
  voters: number;
  votingOpen: boolean;
  cells: readonly Cell[];
  mean: { x: number; y: number } | null;
  showDots: boolean;
  view: ResultsView;
}

export function Results({ name, voters, votingOpen, cells, mean, showDots, view }: Props) {
  return (
    <Stage ground="var(--white)">
      <div className="results">
        {view === "matrix" ? (
          <BubbleMatrix cells={cells} mean={mean} />
        ) : (
          <HeatmapMap cells={cells} mean={mean} showDots={showDots} />
        )}

        <h1 className="results-name">{name}</h1>

        <div className="results-count" aria-live="polite">
          <span className="count-number">{voters}</span>
          <span className="count-label">{VOTERS_SUFFIX}</span>
        </div>
        {!votingOpen ? <p className="stage-badge results-badge">{DISPLAY_UI.votingClosedBadge}</p> : null}

        <StageFooter />
      </div>
    </Stage>
  );
}
