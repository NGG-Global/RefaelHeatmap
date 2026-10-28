/**
 * A 1–10 gauge for phones: drag the handle or tap anywhere on the track.
 * - Before the first touch the handle idles on START (5) with no number and two
 *   animated arrows, showing what to do. That position is not a vote: the
 *   value stays null until the participant taps or drags (a tap on the idle
 *   handle records 5), so nobody is counted for a default they never chose.
 * - Snaps to whole numbers; runs 1 → 10 left to right (dir="ltr"), like a
 *   number line and like the X axis on the projector.
 * - The track is five segments, one per anchor band; the active band is blue.
 * - Custom pointer handling, because iOS Safari's native range input ignores
 *   taps on the track. role="slider" with arrow / Home / End keys; Enter or
 *   Space on the idle handle records START.
 */
import { useRef, type KeyboardEvent, type PointerEvent } from "react";

const MIN = 1;
const MAX = 10;
const STEPS = MAX - MIN;
/** Where the idle handle waits before the first touch. */
const START = 5;
/** Half the handle width: values 1 and 10 sit this far inside the track ends. */
const INSET = 24;

/** CSS position of a point at fraction `t` (0–1) of the value range. */
const at = (t: number) => `calc(${INSET}px + (100% - ${2 * INSET}px) * ${t})`;
const fraction = (v: number) => (v - MIN) / STEPS;
const clamp = (v: number) => Math.min(MAX, Math.max(MIN, v));

const BANDS = [0, 1, 2, 3, 4];
const GAP = 6;

function segmentStyle(k: number) {
  // Band k covers values 2k+1 and 2k+2; boundaries sit half a step outside them.
  const edge = `calc(${INSET}px + (100% - ${2 * INSET}px) * ${1.5 / STEPS} - ${GAP / 2}px)`;
  if (k === 0) return { left: 0, width: edge };
  if (k === BANDS.length - 1) return { right: 0, width: edge };
  return {
    left: `calc(${at((2 * k - 0.5) / STEPS)} + ${GAP / 2}px)`,
    width: `calc((100% - ${2 * INSET}px) * ${2 / STEPS} - ${GAP}px)`,
  };
}

interface Props {
  value: number | null;
  onChange: (value: number) => void;
  labelledBy: string;
  valueText: (value: number | null) => string;
}

/** Sideways movement (px) after which a touch counts as a drag, not a scroll. */
const DRAG_SLOP = 8;

export function ScoreSlider({ value, onChange, labelledBy, valueText }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  // A touch that has not yet shown whether it is a tap, a drag or a scroll.
  const pendingTouch = useRef<{ x: number; y: number } | null>(null);

  const valueAt = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    const t = (clientX - rect.left - INSET) / (rect.width - 2 * INSET);
    return clamp(Math.round(t * STEPS) + MIN);
  };

  const set = (v: number) => {
    if (v !== value) onChange(v);
  };

  // Mouse and pen set the value at once. A touch waits: a sideways move starts a
  // drag, a lift without moving is a tap, and a vertical move is a page scroll
  // (the browser takes it over and sends pointercancel), so scrolling past the
  // gauge never changes an answer.
  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.pointerType === "touch") {
      pendingTouch.current = { x: e.clientX, y: e.clientY };
      return;
    }
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    set(valueAt(e.clientX));
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const start = pendingTouch.current;
    if (start) {
      const dx = Math.abs(e.clientX - start.x);
      const dy = Math.abs(e.clientY - start.y);
      if (dx < DRAG_SLOP || dx <= dy) return;
      pendingTouch.current = null;
      dragging.current = true;
      // Touch pointers are captured implicitly; capturing again would fire
      // lostpointercapture mid-gesture.
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (!dragging.current) return;
    if (e.pointerType === "mouse" && (e.buttons & 1) === 0) {
      endDrag(); // button released outside the window
      return;
    }
    set(valueAt(e.clientX));
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const start = pendingTouch.current;
    if (start && Math.abs(e.clientX - start.x) < DRAG_SLOP && Math.abs(e.clientY - start.y) < DRAG_SLOP) {
      set(valueAt(e.clientX)); // a tap
    }
    endDrag();
  }

  function endDrag() {
    dragging.current = false;
    pendingTouch.current = null;
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    let next: number | null = null;
    const from = value ?? START;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = from + 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = from - 1;
    else if ((e.key === "Enter" || e.key === " ") && value === null) next = START;
    else if (e.key === "Home") next = MIN;
    else if (e.key === "End") next = MAX;
    if (next === null) return;
    e.preventDefault();
    set(clamp(next));
  }

  const activeBand = value === null ? -1 : Math.floor((value - MIN) / 2);

  return (
    <div className="slider" dir="ltr">
      <div
        ref={trackRef}
        className={value === null ? "slider-hit is-empty" : "slider-hit"}
        role="slider"
        tabIndex={0}
        aria-labelledby={labelledBy}
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={value ?? undefined}
        aria-valuetext={valueText(value)}
        aria-orientation="horizontal"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        <div className="slider-rail" aria-hidden="true">
          {BANDS.map((k) => (
            <span key={k} className={k === activeBand ? "slider-seg is-active" : "slider-seg"} style={segmentStyle(k)} />
          ))}
        </div>
        {Array.from({ length: MAX - MIN + 1 }, (_, i) => MIN + i).map((n) => (
          <span
            key={n}
            className={n === value ? "slider-num is-active" : "slider-num"}
            style={{ left: at(fraction(n)) }}
            aria-hidden="true"
          >
            {n}
          </span>
        ))}
        {value === null ? (
          <>
            <span className="slider-hint slider-hint-left" style={{ left: at(fraction(START)) }} aria-hidden="true">
              <svg viewBox="0 0 10 14" width="10" height="14">
                <polygon points="10,0 10,14 0,7" />
              </svg>
            </span>
            <span className="slider-thumb is-idle" style={{ left: at(fraction(START)) }} aria-hidden="true" />
            <span className="slider-hint slider-hint-right" style={{ left: at(fraction(START)) }} aria-hidden="true">
              <svg viewBox="0 0 10 14" width="10" height="14">
                <polygon points="0,0 0,14 10,7" />
              </svg>
            </span>
          </>
        ) : (
          <span className="slider-thumb" style={{ left: at(fraction(value)) }} aria-hidden="true">
            {value}
          </span>
        )}
      </div>
    </div>
  );
}
