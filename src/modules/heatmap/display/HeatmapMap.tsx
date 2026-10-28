/**
 * Results as a continuous heatmap (brief V5, alternative B).
 * Layers, bottom to top: density colour (canvas), frame and dashed quadrant
 * lines at 5.5, quadrant names in the corners, one dot per respondent, mean
 * ring. dir="ltr": X runs 1 → 10 left to right, Y 1 → 10 bottom to top.
 * The maths lives in ../density.ts.
 */
import { useEffect, useMemo, useRef } from "react";
import type { Cell } from "../api";
import { DOMAIN_MAX, DOMAIN_MIN, GRID, density, dotOffset, legendGradient, normaliser, paint } from "../density";
import { DISPLAY_UI, LEGEND, MEAN_LABEL, QUADRANTS, QUESTION_X, QUESTION_Y } from "../content";

/** Map placement inside the .heatmap box (stage px). */
export const MAP_LEFT = 150;
export const MAP_TOP = 36;
export const MAP_SIZE = 840;
const UNIT = MAP_SIZE / (DOMAIN_MAX - DOMAIN_MIN);
const DOT_R = 9;
/** Sunflower-spiral spacing between dots at one score point (px). */
const DOT_SPACING = 14;
/** Fade between two density states when votes arrive. */
const FADE_MS = 700;

const SCORES = Array.from({ length: 10 }, (_, i) => i + 1);

const px = (x: number) => (x - DOMAIN_MIN) * UNIT;
const py = (y: number) => MAP_SIZE - (y - DOMAIN_MIN) * UNIT;
const MID = px(5.5);

interface Props {
  cells: readonly Cell[];
  mean: { x: number; y: number } | null;
  showDots: boolean;
}

export function HeatmapMap({ cells, mean, showDots }: Props) {
  // Polling returns a new array every few seconds; keep the old one while the
  // content is the same, so the map does not repaint for nothing.
  const key = cells.map((c) => c.join(",")).join(";");
  const stable = useMemo(() => cells, [key]);

  return (
    <div className="heatmap" dir="ltr">
      <p className="hm-axis-y">{QUESTION_Y.axisLabel}</p>
      {SCORES.map((s) => (
        <span key={`yt${s}`} className="hm-tick hm-tick-y" style={{ top: MAP_TOP + py(s) }}>
          {s}
        </span>
      ))}

      <div
        className="hm-plot"
        style={{ left: MAP_LEFT, top: MAP_TOP, width: MAP_SIZE, height: MAP_SIZE }}
        role="img"
        aria-label={`${DISPLAY_UI.mapAlt}: ${QUESTION_X.axisLabel} / ${QUESTION_Y.axisLabel}`}
      >
        <DensityCanvas cells={stable} />

        <svg className="hm-layer" width={MAP_SIZE} height={MAP_SIZE} aria-hidden="true">
          <rect className="hm-frame" x={1} y={1} width={MAP_SIZE - 2} height={MAP_SIZE - 2} />
          <line className="hm-quadline" x1={MID} y1={0} x2={MID} y2={MAP_SIZE} />
          <line className="hm-quadline" x1={0} y1={MID} x2={MAP_SIZE} y2={MID} />
        </svg>

        <div className="hm-quadrants" dir="rtl" aria-hidden="true">
          <p className="hm-quadrant is-tr">{QUADRANTS.topRight}</p>
          <p className="hm-quadrant is-tl">{QUADRANTS.topLeft}</p>
          <p className="hm-quadrant is-br">{QUADRANTS.bottomRight}</p>
          <p className="hm-quadrant is-bl">{QUADRANTS.bottomLeft}</p>
        </div>

        <svg className="hm-layer" width={MAP_SIZE} height={MAP_SIZE} aria-hidden="true">
          {showDots ? <Dots cells={stable} /> : null}
          {mean ? <MeanRing x={px(mean.x)} y={py(mean.y)} /> : null}
        </svg>
      </div>

      {SCORES.map((s) => (
        <span key={`xt${s}`} className="hm-tick hm-tick-x" style={{ left: MAP_LEFT + px(s) }}>
          {s}
        </span>
      ))}
      <p className="hm-axis-x">{QUESTION_X.axisLabel}</p>

      <div className="hm-legend" dir="rtl">
        <span>{LEGEND.less}</span>
        <span className="hm-legend-ramp" style={{ background: legendGradient("to left") }} />
        <span>{LEGEND.more}</span>
        {showDots ? (
          <span className="hm-legend-dot">
            <svg width={2 * DOT_R + 6} height={2 * DOT_R + 6} aria-hidden="true">
              <circle className="hm-dot" cx={DOT_R + 3} cy={DOT_R + 3} r={DOT_R} />
            </svg>
            {LEGEND.dot}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The density raster: GRID × GRID canvas pixels, stretched to the map by the
 * browser's smoothing. A change fades from the shown state to the new one
 * (votes "enter gradually"); with reduced motion it switches at once.
 */
function DensityCanvas({ cells }: { cells: readonly Cell[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const shown = useRef<{ values: Float64Array; norm: number } | null>(null);
  const target = useMemo(() => density(cells), [cells]);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const image = ctx.createImageData(GRID, GRID);
    const to = { values: target.values, norm: normaliser(target.peak) };
    const from = shown.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!from || reduce) {
      paint(image.data, to.values, to.norm);
      ctx.putImageData(image, 0, 0);
      shown.current = to;
      return;
    }

    const blend = new Float64Array(to.values.length);
    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / FADE_MS);
      const e = 1 - (1 - t) ** 3;
      for (let p = 0; p < blend.length; p++) blend[p] = from.values[p] + (to.values[p] - from.values[p]) * e;
      const norm = from.norm + (to.norm - from.norm) * e;
      paint(image.data, blend, norm);
      ctx.putImageData(image, 0, 0);
      // An update that arrives mid-fade starts from what is on screen now.
      shown.current = t < 1 ? { values: blend, norm } : to;
      if (t < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return <canvas ref={ref} className="hm-canvas" width={GRID} height={GRID} aria-hidden="true" />;
}

/** One dot per respondent; new dots fade in (CSS), existing ones never move. */
function Dots({ cells }: { cells: readonly Cell[] }) {
  return (
    <g>
      {cells.flatMap(([x, y, n]) =>
        Array.from({ length: n }, (_, k) => {
          const [ox, oy] = dotOffset(k, DOT_SPACING);
          return <circle key={`${x}-${y}-${k}`} className="hm-dot" cx={px(x) + ox} cy={py(y) + oy} r={DOT_R} />;
        }),
      )}
    </g>
  );
}

/** Blue ring on a white halo (brief: "טבעת כחולה"), labelled. */
function MeanRing({ x, y }: { x: number; y: number }) {
  const labelOnLeft = x > MAP_SIZE - 170;
  return (
    <g className="hm-mean" transform={`translate(${x} ${y})`}>
      <circle className="hm-mean-halo" r={22} />
      <circle className="hm-mean-ring" r={22} />
      <text
        className="hm-mean-label"
        x={labelOnLeft ? -38 : 38}
        textAnchor={labelOnLeft ? "end" : "start"}
        dominantBaseline="central"
      >
        {MEAN_LABEL}
      </text>
    </g>
  );
}
