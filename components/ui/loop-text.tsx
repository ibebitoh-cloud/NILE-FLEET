import React, { useId } from "react";

/**
 * "NILE FLEET" lettered like the NF loop logo: one rounded tube per letter
 * with a hollow channel down the middle. Each letter's tube draws itself in
 * turn, holds, then rewinds. Size it with font-size on a parent: the SVG is 1em tall.
 */

// Centre-line paths on a 100-unit cap height, plus each letter's advance width.
const GLYPHS: Record<string, { d: string; w: number }> = {
  N: { d: "M0 100V36a35 35 0 0 1 70 0v64", w: 70 },
  I: { d: "M0 0v100", w: 0 },
  L: { d: "M0 0v74a26 26 0 0 0 26 26h34", w: 60 },
  E: { d: "M62 0H26A26 26 0 0 0 0 26v48a26 26 0 0 0 26 26h36M0 50h52", w: 62 },
  F: { d: "M62 0H26A26 26 0 0 0 0 26v74M0 50h52", w: 62 },
  T: { d: "M0 0h72M36 0v100", w: 72 },
};

const TUBE = 26; // tube thickness, like the logo's stroke
const CHANNEL = 7; // hollow line inside the tube
const GAP = TUBE + 18;
const STEP = 0.16; // seconds between letters

type Props = {
  text: string;
  color: string;
  /** Seconds before the first letter starts (to chain several lines). */
  delay?: number;
  className?: string;
};

export default function LoopText({ text, color, delay = 0, className = "" }: Props) {
  const id = useId().replace(/:/g, "");
  const letters = Array.from(text.toUpperCase()).filter((ch) => GLYPHS[ch]);

  let x = TUBE / 2;
  const placed = letters.map((ch) => {
    const g = GLYPHS[ch];
    const at = x;
    x += g.w + GAP;
    return { ...g, x: at };
  });
  const width = x - GAP + TUBE / 2;
  const height = 100 + TUBE;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`nf-loop ${className}`}
      style={{ height: "1em", width: "auto", overflow: "visible" }}
      role="img"
      aria-label={text}
    >
      <defs>
        <mask id={`m${id}`} maskUnits="userSpaceOnUse" x={-TUBE} y={-TUBE} width={width + TUBE * 2} height={height + TUBE * 2}>
          <g fill="none" strokeLinecap="round" strokeLinejoin="round" transform={`translate(0 ${TUBE / 2})`}>
            {placed.map((g, i) => (
              <path
                key={i}
                d={g.d}
                transform={`translate(${g.x} 0)`}
                pathLength={1}
                stroke="#fff"
                strokeWidth={TUBE}
                className="nf-loop-tube"
                style={{ animationDelay: `${delay + i * STEP}s` }}
              />
            ))}
            {placed.map((g, i) => (
              <path key={`c${i}`} d={g.d} transform={`translate(${g.x} 0)`} stroke="#000" strokeWidth={CHANNEL} />
            ))}
          </g>
        </mask>
      </defs>
      <rect x={-TUBE} y={-TUBE} width={width + TUBE * 2} height={height + TUBE * 2} fill={color} mask={`url(#m${id})`} />
    </svg>
  );
}
