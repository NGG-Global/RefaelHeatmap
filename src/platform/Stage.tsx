/**
 * A fixed 1920 × 1080 canvas (the design system's authoring size), scaled to
 * fit the window and letterboxed in the ground colour. Projector screens get
 * the exact layout; a laptop preview gets the same layout, smaller.
 */
import { useEffect, useState, type ReactNode } from "react";
import "./stage.css";

export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;

function fitScale(): number {
  return Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT);
}

interface Props {
  ground: string;
  children: ReactNode;
}

export function Stage({ ground, children }: Props) {
  const [scale, setScale] = useState(fitScale);

  useEffect(() => {
    const onResize = () => setScale(fitScale());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="stage-viewport" style={{ background: ground }}>
      <div className="stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}
