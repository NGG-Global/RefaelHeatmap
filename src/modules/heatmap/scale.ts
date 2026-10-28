/**
 * Bubble-chart geometry, in pixels of the 1920 × 1080 display stage.
 * Tune after the dry run: these constants are the only place sizes are set.
 */

export const GRID_POINTS = 10;

/** Distance between adjacent score points. */
export const SPACING = 84;

/** Largest bubble diameter as a share of SPACING; < 1 so neighbours never touch. */
export const CAP_RATIO = 0.9;

/** Sizes scale against max(highest count, COUNT_FLOOR), so early votes stay small. */
export const COUNT_FLOOR = 5;

/** Smallest bubble: a two-digit count at LABEL_SIZE stays legible inside it. */
export const MIN_DIAMETER = 46;

/** Count label font size inside every bubble. */
export const LABEL_SIZE = 30;

export const MAX_DIAMETER = SPACING * CAP_RATIO;

/** Area encodes count: diameter ∝ √count, capped and floored as above. */
export function bubbleDiameter(count: number, highestCount: number): number {
  if (count <= 0) return 0;
  const scaleTo = Math.max(highestCount, COUNT_FLOOR);
  return Math.max(MIN_DIAMETER, MAX_DIAMETER * Math.sqrt(count / scaleTo));
}

/** Centre of score point `score` (1–10) along an axis that starts at 0. */
export function pointOffset(score: number): number {
  return (score - 0.5) * SPACING;
}

export const PLOT_SIZE = GRID_POINTS * SPACING;
