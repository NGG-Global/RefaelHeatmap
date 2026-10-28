/**
 * The 10 × 10 result matrix as a bubble chart.
 * - dir="ltr": X runs 1 → 10 left to right, Y runs 1 → 10 bottom to top.
 * - One circle per populated score point, area ∝ count (see scale.ts).
 * - Quadrant names sit in bands above and below the grid, inside their
 *   quadrant's columns, so they can never collide with a bubble.
 */
import type { Cell } from "../api";
import { MEAN_LABEL, QUADRANTS, QUESTION_X, QUESTION_Y } from "../content";
import { GRID_POINTS, LABEL_SIZE, MAX_DIAMETER, PLOT_SIZE, bubbleDiameter, pointOffset } from "../scale";

/** Matrix placement on the stage (px). */
export const PLOT_LEFT = 150;
export const PLOT_TOP = 70;
const BAND = 48;
const MID = PLOT_SIZE / 2;

const SCORES = Array.from({ length: GRID_POINTS }, (_, i) => i + 1);

interface Props {
  cells: readonly Cell[];
  mean: { x: number; y: number } | null;
}

const cx = (x: number) => pointOffset(x);
const cy = (y: number) => PLOT_SIZE - pointOffset(y);

export function BubbleMatrix({ cells, mean }: Props) {
  const highest = cells.reduce((m, [, , n]) => Math.max(m, n), 0);

  return (
    <div className="matrix" dir="ltr">
      <p className="matrix-axis-y">{QUESTION_Y.axisLabel}</p>

      {SCORES.map((s) => (
        <span key={`yt${s}`} className="matrix-tick matrix-tick-y" style={{ top: PLOT_TOP + cy(s) }}>
          {s}
        </span>
      ))}

      <div className="matrix-quadrants" dir="rtl">
        <p className="matrix-quadrant" style={{ top: PLOT_TOP - BAND, left: PLOT_LEFT + MID, width: MID, height: BAND }}>
          {QUADRANTS.topRight}
        </p>
        <p className="matrix-quadrant" style={{ top: PLOT_TOP - BAND, left: PLOT_LEFT, width: MID, height: BAND }}>
          {QUADRANTS.topLeft}
        </p>
        <p className="matrix-quadrant" style={{ top: PLOT_TOP + PLOT_SIZE, left: PLOT_LEFT + MID, width: MID, height: BAND }}>
          {QUADRANTS.bottomRight}
        </p>
        <p className="matrix-quadrant" style={{ top: PLOT_TOP + PLOT_SIZE, left: PLOT_LEFT, width: MID, height: BAND }}>
          {QUADRANTS.bottomLeft}
        </p>
      </div>

      <svg
        className="matrix-plot"
        style={{ left: PLOT_LEFT, top: PLOT_TOP - BAND }}
        width={PLOT_SIZE}
        height={PLOT_SIZE + 2 * BAND}
        viewBox={`0 ${-BAND} ${PLOT_SIZE} ${PLOT_SIZE + 2 * BAND}`}
        role="img"
        aria-label={`${QUESTION_X.axisLabel} / ${QUESTION_Y.axisLabel}`}
      >
        {/* grid through every score point, and the plot frame */}
        <g className="matrix-grid">
          <rect x={0} y={0} width={PLOT_SIZE} height={PLOT_SIZE} />
          {SCORES.map((s) => (
            <line key={`gx${s}`} x1={cx(s)} y1={0} x2={cx(s)} y2={PLOT_SIZE} />
          ))}
          {SCORES.map((s) => (
            <line key={`gy${s}`} x1={0} y1={cy(s)} x2={PLOT_SIZE} y2={cy(s)} />
          ))}
        </g>

        {/* midlines at 5.5; the vertical one runs through the quadrant bands */}
        <g className="matrix-midlines">
          <line x1={MID} y1={-BAND} x2={MID} y2={PLOT_SIZE + BAND} />
          <line x1={0} y1={MID} x2={PLOT_SIZE} y2={MID} />
        </g>

        <g className="matrix-bubbles">
          {cells.map(([x, y, n]) => {
            const d = bubbleDiameter(n, highest);
            return (
              <g key={`${x}-${y}`} transform={`translate(${cx(x)} ${cy(y)})`}>
                <circle className="bubble" r={MAX_DIAMETER / 2} style={{ transform: `scale(${d / MAX_DIAMETER})` }} />
                <text className="bubble-count" fontSize={LABEL_SIZE} textAnchor="middle" dominantBaseline="central">
                  {n}
                </text>
              </g>
            );
          })}
        </g>

        {mean ? <MeanMarker x={cx(mean.x)} y={cy(mean.y)} /> : null}
      </svg>

      {SCORES.map((s) => (
        <span key={`xt${s}`} className="matrix-tick matrix-tick-x" style={{ left: PLOT_LEFT + cx(s) }}>
          {s}
        </span>
      ))}
      <p className="matrix-axis-x">{QUESTION_X.axisLabel}</p>
    </div>
  );
}

/** Navy ring with a cross on a white halo: never mistaken for a blue bubble. */
function MeanMarker({ x, y }: { x: number; y: number }) {
  const labelOnLeft = x > PLOT_SIZE - 150;
  return (
    <g className="mean" transform={`translate(${x} ${y})`}>
      <circle r={25} className="mean-halo" />
      <circle r={17} className="mean-ring" />
      <line x1={-11} y1={0} x2={11} y2={0} className="mean-cross" />
      <line x1={0} y1={-11} x2={0} y2={11} className="mean-cross" />
      <text
        className="mean-label"
        x={labelOnLeft ? -34 : 34}
        textAnchor={labelOnLeft ? "end" : "start"}
        dominantBaseline="central"
      >
        {MEAN_LABEL}
      </text>
    </g>
  );
}
