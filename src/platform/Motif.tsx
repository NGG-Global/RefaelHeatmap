/**
 * The design system's one decorative device: a trail (stadium filled with a
 * ramp from the motif colour to transparent mist) and a separate solid dot.
 * Exact template sizes only — never scaled. On small screens, let the
 * container clip the shapes rather than shrinking them.
 */
import type { CSSProperties } from "react";

type MotifColor = "blue" | "navy" | "white";

const ink = (c: MotifColor) => (c === "navy" ? "var(--navy)" : c === "white" ? "var(--white)" : "var(--blue)");

interface TrailProps {
  x: number;
  y: number;
  rot?: number;
  color?: MotifColor;
  size?: "sm" | "md";
}

export function Trail({ x, y, rot = 0, color = "blue", size = "sm" }: TrailProps) {
  const w = size === "md" ? 292 : 273;
  const h = size === "md" ? 117 : 89;
  const style: CSSProperties = {
    position: "absolute",
    left: x,
    top: y,
    width: w,
    height: h,
    borderRadius: h / 2,
    color: ink(color),
    background: "linear-gradient(90deg, currentColor 0%, rgba(248, 250, 252, 0) 100%)",
    transform: `rotate(${rot}deg)`,
    pointerEvents: "none",
  };
  return <div aria-hidden="true" style={style} />;
}

interface DotProps {
  x: number;
  y: number;
  color?: MotifColor;
  size?: "sm" | "md";
}

export function Dot({ x, y, color = "blue", size = "sm" }: DotProps) {
  const d = size === "md" ? 123 : 93;
  const style: CSSProperties = {
    position: "absolute",
    left: x,
    top: y,
    width: d,
    height: d,
    borderRadius: "50%",
    background: ink(color),
    pointerEvents: "none",
  };
  return <div aria-hidden="true" style={style} />;
}
