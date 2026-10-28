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

/**
 * One dot with its trail, paired the way the template pairs them: the dot at
 * (x, y), the trail running out of it in direction `angle` (0 = right), its
 * transparent end on the dot. Use one of the template's angles.
 */
export function Comet({ x, y, angle, color = "blue" }: { x: number; y: number; angle: number; color?: MotifColor }) {
  const tw = 273;
  const th = 89;
  const ds = 93;
  const cx = x + ds / 2;
  const cy = y + ds / 2;
  const rad = (angle * Math.PI) / 180;
  const tx = cx + Math.cos(rad) * (tw / 2) - tw / 2;
  const ty = cy + Math.sin(rad) * (tw / 2) - th / 2;
  return (
    <>
      <Trail x={tx} y={ty} rot={angle + 180} color={color} />
      <Dot x={x} y={y} color={color} />
    </>
  );
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
