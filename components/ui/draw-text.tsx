import React, { useLayoutEffect, useRef, useState } from "react";

/**
 * Headline that draws its own outline letter by letter, then fills with colour,
 * holds, and starts again. SVG text so the stroke can be animated with dashes.
 * Size it with font-size on a parent: the SVG is 1em tall.
 */
type Props = {
  text: string;
  color: string;
  /** Seconds before the first letter starts (to chain several lines). */
  delay?: number;
  className?: string;
  italic?: boolean;
};

export default function DrawText({ text, color, delay = 0, className = "", italic = true }: Props) {
  const textRef = useRef<SVGTextElement>(null);
  const [box, setBox] = useState("0 0 100 100");

  useLayoutEffect(() => {
    const measure = () => {
      const el = textRef.current;
      if (!el) return;
      const b = el.getBBox();
      if (b.width) setBox(`${b.x - 4} ${b.y - 2} ${b.width + 8} ${b.height + 4}`);
    };
    measure();
    document.fonts?.ready.then(measure).catch(() => {});
  }, [text, italic]);

  return (
    <svg
      viewBox={box}
      className={`nf-draw ${className}`}
      style={{ height: "1em", width: "auto", overflow: "visible", ["--nf-ink" as string]: color } as React.CSSProperties}
      role="img"
      aria-label={text}
    >
      <text
        ref={textRef}
        x="0"
        y="0"
        fontSize="100"
        fontWeight={900}
        fontStyle={italic ? "italic" : "normal"}
        letterSpacing="-5"
        style={{ fontFamily: "inherit", textTransform: "uppercase" }}
      >
        {Array.from(text).map((ch, i) => (
          <tspan key={i} style={{ ["--i" as string]: i, animationDelay: `${delay + i * 0.18}s` } as React.CSSProperties}>
            {ch}
          </tspan>
        ))}
      </text>
    </svg>
  );
}
