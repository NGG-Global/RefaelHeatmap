/**
 * Heatmap maths, as specified in brief V5 (alternative B):
 * - Gaussian kernel density on a GRID × GRID raster over the score domain
 *   0–11 on both axes (one unit of margin beyond 1 and 10, so the corner
 *   labels sit clear of scores 1 and 10), bandwidth BANDWIDTH score units.
 * - Each respondent adds a kernel with peak 1, so the density reads in
 *   "respondents nearby". Colour intensity is density / max(peak, FLOOR), so a
 *   single vote never takes the darkest colour.
 * - Colour: ColorBrewer YlOrRd (9 classes), light yellow → dark red; fully
 *   transparent where nobody answered.
 * Pure functions only: no DOM, unit-tested in density.test.ts.
 */
import type { Cell } from "./api";

/** Raster resolution per axis. Drop to 100 if a host laptop stutters at 60+ votes. */
export const GRID = 140;
/** Kernel bandwidth (standard deviation), in score units. */
export const BANDWIDTH = 0.9;
/** Normalisation floor, in respondents. */
export const FLOOR = 2.5;
/** Score domain shown on each axis; 5.5 stays the exact centre. */
export const DOMAIN_MIN = 0;
export const DOMAIN_MAX = 11;

const STEP = (DOMAIN_MAX - DOMAIN_MIN) / GRID;

/** Centre of raster column/row `i`, in score units. */
export const gridCentre = (i: number) => DOMAIN_MIN + (i + 0.5) * STEP;

/** kernel[s - 1][i]: 1-D Gaussian weight of score s at raster position i. */
const KERNEL: Float64Array[] = Array.from({ length: 10 }, (_, k) => {
  const row = new Float64Array(GRID);
  for (let i = 0; i < GRID; i++) {
    const d = gridCentre(i) - (k + 1);
    row[i] = Math.exp(-(d * d) / (2 * BANDWIDTH * BANDWIDTH));
  }
  return row;
});

export interface Density {
  /** Row-major, row 0 = top of the map (Y = DOMAIN_MAX), column 0 = left (X = DOMAIN_MIN). */
  values: Float64Array;
  /** Highest value in `values`. */
  peak: number;
}

/**
 * Density of the given cells. The 2-D Gaussian is separable, so the raster is
 * K_yᵀ · C · K_x: about 200 k multiplications whatever the number of votes.
 */
export function density(cells: readonly Cell[]): Density {
  // Per Y score, the X profile of all votes at that Y.
  const rows = Array.from({ length: 10 }, () => new Float64Array(GRID));
  for (const [x, y, n] of cells) {
    if (n <= 0 || x < 1 || x > 10 || y < 1 || y > 10) continue;
    const kx = KERNEL[x - 1];
    const row = rows[y - 1];
    for (let i = 0; i < GRID; i++) row[i] += n * kx[i];
  }

  const values = new Float64Array(GRID * GRID);
  let peak = 0;
  for (let r = 0; r < GRID; r++) {
    const j = GRID - 1 - r; // raster row r shows Y position j, counted from the bottom
    for (let s = 0; s < 10; s++) {
      const w = KERNEL[s][j];
      if (w < 1e-9) continue;
      const row = rows[s];
      const base = r * GRID;
      for (let i = 0; i < GRID; i++) values[base + i] += w * row[i];
    }
    for (let i = 0; i < GRID; i++) if (values[r * GRID + i] > peak) peak = values[r * GRID + i];
  }
  return { values, peak };
}

/** The value that maps to the darkest colour. */
export const normaliser = (peak: number) => Math.max(peak, FLOOR);

/** ColorBrewer YlOrRd, 9 classes (lightest → darkest). */
export const YLORRD: readonly (readonly [number, number, number])[] = [
  [255, 255, 204],
  [255, 237, 160],
  [254, 217, 118],
  [254, 178, 76],
  [253, 141, 60],
  [252, 78, 42],
  [227, 26, 28],
  [189, 0, 38],
  [128, 0, 38],
];

/** Below this intensity the map is fully transparent ("nobody here"). */
export const CUTOFF = 0.03;
/** Intensity at which the colour reaches full opacity. */
const OPAQUE_AT = 0.3;

/** RGBA (0–255) for an intensity in 0–1. */
export function colour(t: number): [number, number, number, number] {
  if (!(t > CUTOFF)) return [0, 0, 0, 0];
  const u = Math.min(t, 1) * (YLORRD.length - 1);
  const k = Math.min(Math.floor(u), YLORRD.length - 2);
  const f = u - k;
  const a = YLORRD[k];
  const b = YLORRD[k + 1];
  const alpha = Math.min(1, (t - CUTOFF) / (OPAQUE_AT - CUTOFF));
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
    Math.round(255 * alpha),
  ];
}

/**
 * Paints `values / norm` into an RGBA buffer of GRID × GRID pixels.
 * `from` (optional) is blended in with weight 1 - mix, for the fade between
 * two states; `norm` is blended the same way by the caller.
 */
export function paint(
  out: Uint8ClampedArray,
  values: Float64Array,
  norm: number,
  from?: Float64Array,
  mix = 1,
): void {
  for (let p = 0; p < values.length; p++) {
    const v = from ? from[p] + (values[p] - from[p]) * mix : values[p];
    const [r, g, b, a] = colour(v / norm);
    const o = p * 4;
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = a;
  }
}

/** CSS gradient of the colour ramp, for the legend (lightest first). */
export const legendGradient = (direction: string) =>
  `linear-gradient(${direction}, ${YLORRD.map(([r, g, b]) => `rgb(${r} ${g} ${b})`).join(", ")})`;

/**
 * Fixed offset of the k-th dot (k = 0, 1, …) at one score point, in units of
 * `spacing`: a sunflower spiral, so dots never sit on top of each other and an
 * existing dot never moves when another respondent picks the same point.
 * The brief keys the offset to the device id; here it is keyed to the dot's
 * index within the point instead, because the public display function never
 * returns device ids.
 */
export function dotOffset(k: number, spacing: number): [number, number] {
  if (k === 0) return [0, 0];
  const r = spacing * Math.sqrt(k);
  const angle = k * 2.399963229728653; // golden angle, radians
  return [r * Math.cos(angle), r * Math.sin(angle)];
}

/** Intensity at one score point, for tests and checks: density there / norm. */
export function intensityAt(d: Density, x: number, y: number): number {
  const i = Math.round((x - DOMAIN_MIN) / STEP - 0.5);
  const j = Math.round((y - DOMAIN_MIN) / STEP - 0.5);
  const r = GRID - 1 - Math.min(GRID - 1, Math.max(0, j));
  const c = Math.min(GRID - 1, Math.max(0, i));
  return d.values[r * GRID + c] / normaliser(d.peak);
}
