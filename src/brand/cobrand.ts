/**
 * Co-brand lockup for this deployment: the client's wordmark shown beside the
 * NGG mark in the projector footer (design-system footer: NGG mark at x 26,
 * wordmark at x 96, 72 px tall).
 *
 * The only place the client's mark and name live in the code (owner's
 * decision, 28 Oct 2026; see CLAUDE.md → Confidentiality). To reuse this front
 * end for another client, replace the two images and `alt`, or set
 * `COBRAND = null` to show the NGG mark alone.
 */
import onDark from "./cobrand-on-dark.png";
import onLight from "./cobrand-on-light.png";

export interface Cobrand {
  /** White artwork for the navy lobby. */
  onDark: string;
  /** Colour artwork for the white results screen. */
  onLight: string;
  alt: string;
}

export const COBRAND: Cobrand | null = {
  onDark,
  onLight,
  alt: "רפאל",
};
