import React, { useEffect, useRef } from "react";

/**
 * Tubes Cursor: glowing neon tubes that chase the pointer.
 * Click (or tap) cycles the colour palette. When the pointer is away
 * the tubes drift on their own, so phones and idle visitors still see motion.
 * Pure 2D canvas, no three.js. Pauses off-screen and honours reduced motion.
 */

export type TubesPalette = { colors: string[]; glow: string };

/** Deeper colours for light backgrounds, where additive glow would wash out. */
export const LIGHT_TUBES_PALETTES: TubesPalette[] = [
  { colors: ["#a8844f", "#1d4ed8", "#c2a378", "#0b2a4a", "#3b82f6"], glow: "#c2a37833" },
  { colors: ["#c026d3", "#7c3aed", "#2563eb", "#db2777", "#4f46e5"], glow: "#7c3aed26" },
  { colors: ["#059669", "#0d9488", "#65a30d", "#ea580c", "#0891b2"], glow: "#05966926" },
  { colors: ["#ea580c", "#ca8a04", "#e11d48", "#0b2a4a", "#c2410c"], glow: "#ea580c26" },
];

export const DEFAULT_TUBES_PALETTES: TubesPalette[] = [
  { colors: ["#c2a378", "#4f8cff", "#f3d9a4", "#8fd3ff", "#2f5bff"], glow: "#c2a37833" },
  { colors: ["#ff3fd8", "#8b5cff", "#3fa8ff", "#ff6aa8", "#5b3cff"], glow: "#7b3cff33" },
  { colors: ["#36ff9a", "#1fd1c1", "#b6ff4a", "#ff6a3d", "#2bd4ff"], glow: "#1fd17a2e" },
  { colors: ["#ff8a3d", "#ffd23f", "#ff3d6e", "#ffffff", "#ff5a1f"], glow: "#ff8a3d2e" },
];

type Pt = { x: number; y: number };
type Tube = { pts: Pt[]; vx: number; vy: number; phase: number; radius: number; speed: number; width: number };

export interface TubesCursorProps {
  palettes?: TubesPalette[];
  tubes?: number;
  length?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  onPaletteChange?: (index: number) => void;
  /** Light theme: pale background and normal (non-additive) blending. */
  light?: boolean;
}

export default function TubesCursor({
  light = false,
  palettes = light ? LIGHT_TUBES_PALETTES : DEFAULT_TUBES_PALETTES,
  tubes = 5,
  length = 48,
  className,
  style,
  children,
  onPaletteChange,
}: TubesCursorProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paletteRef = useRef(0);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, dpr = 1, scale = 1;
    let raf = 0, running = false, visible = false;
    let t = 0;
    const pointer = { x: 0, y: 0, last: -1e9 };
    const target = { x: 0, y: 0 };

    const tubeList: Tube[] = Array.from({ length: tubes }, (_, i) => ({
      pts: [],
      vx: 0,
      vy: 0,
      phase: (i / tubes) * Math.PI * 2,
      radius: 18 + i * 9,
      speed: 0.9 + i * 0.17,
      width: 6.5 - i * 0.6,
    }));

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      // Thinner, tighter tubes on phones so they frame the text instead of swamping it.
      scale = Math.max(0.8, Math.min(1, w / 900));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (const tube of tubeList) {
        if (!tube.pts.length) tube.pts = Array.from({ length }, () => ({ x: w / 2, y: h / 2 }));
      }
    };

    const idleTarget = (time: number) => w < 640
      ? { // narrow screens: a wide, flat orbit around the headline
          x: w / 2 + Math.sin(time * 0.7) * w * 0.4,
          y: h / 2 + Math.sin(time * 1.4) * h * 0.26,
        }
      : {
          x: w / 2 + Math.sin(time * 0.61) * w * 0.3 + Math.sin(time * 1.7) * w * 0.05,
          y: h / 2 + Math.sin(time * 0.93 + 1.2) * h * 0.28 + Math.cos(time * 2.1) * h * 0.04,
        };

    const step = (now: number) => {
      t += 1 / 60;
      const idle = now - pointer.last > 1800;
      const goal = idle ? idleTarget(t) : pointer;
      target.x += (goal.x - target.x) * (idle ? 0.06 : 0.22);
      target.y += (goal.y - target.y) * (idle ? 0.06 : 0.22);

      for (const tube of tubeList) {
        const a = t * tube.speed * 2.2 + tube.phase;
        const hx = target.x + Math.cos(a) * tube.radius * scale;
        const hy = target.y + Math.sin(a * 1.3) * tube.radius * scale;
        tube.vx = (tube.vx + (hx - tube.pts[0].x) * 0.12) * 0.72;
        tube.vy = (tube.vy + (hy - tube.pts[0].y) * 0.12) * 0.72;
        tube.pts[0].x += tube.vx;
        tube.pts[0].y += tube.vy;
        for (let i = 1; i < tube.pts.length; i++) {
          const p = tube.pts[i], q = tube.pts[i - 1];
          p.x += (q.x - p.x) * 0.42;
          p.y += (q.y - p.y) * 0.42;
        }
      }
    };

    const draw = () => {
      const pal = palettes[paletteRef.current % palettes.length];
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = light ? "source-over" : "lighter";
      ctx.lineCap = "butt";
      ctx.lineJoin = "round";
      // Each pass is drawn as a few long chunks (not per segment) so the
      // additive blend doesn't leave bright beads where segments overlap.
      const passes: Array<[number, number]> = light
        ? [[4, 0.05], [2, 0.14], [0.9, 0.85]]
        : [[6, 0.06], [3.2, 0.12], [1.6, 0.35], [0.7, 0.9]];
      const CHUNKS = 4;
      const path = (pts: Pt[], from: number, to: number) => {
        ctx.beginPath();
        ctx.moveTo(pts[from].x, pts[from].y);
        for (let i = from + 1; i < to; i++) {
          const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        }
        ctx.lineTo(pts[to].x, pts[to].y);
      };
      tubeList.forEach((tube, ti) => {
        const color = pal.colors[ti % pal.colors.length];
        const pts = tube.pts;
        const n = pts.length;
        const size = Math.ceil((n - 1) / CHUNKS);
        ctx.strokeStyle = color;
        for (const [wMul, alpha] of passes) {
          for (let c = 0; c < CHUNKS; c++) {
            const from = c * size, to = Math.min(n - 1, from + size);
            if (to <= from) break;
            const k = 1 - c / CHUNKS;
            ctx.globalAlpha = alpha * (0.3 + 0.7 * k);
            ctx.lineWidth = Math.max(0.6, tube.width * scale * wMul * (0.35 + 0.65 * k));
            path(pts, from, to);
            ctx.stroke();
          }
        }
        // white-hot core along the head (dark theme only; it greys out on a light background)
        if (light) return;
        ctx.strokeStyle = "#ffffff";
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = Math.max(0.6, tube.width * scale * 0.3);
        path(pts, 0, Math.min(n - 1, 12));
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    const loop = (now: number) => {
      step(now);
      draw();
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running || reduce || !visible || document.hidden) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const staticFrame = () => {
      for (let i = 0; i < 160; i++) step(-1e9);
      draw();
    };

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.last = performance.now();
    };
    const onClick = () => {
      paletteRef.current = (paletteRef.current + 1) % palettes.length;
      if (glowRef.current) glowRef.current.style.background = `radial-gradient(60% 60% at 50% 50%, ${palettes[paletteRef.current].glow}, transparent 70%)`;
      onPaletteChange?.(paletteRef.current);
      if (reduce) staticFrame();
    };
    const onVis = () => (document.hidden ? stop() : start());

    resize();
    target.x = w / 2;
    target.y = h / 2;
    if (glowRef.current) glowRef.current.style.background = `radial-gradient(60% 60% at 50% 50%, ${palettes[0].glow}, transparent 70%)`;
    if (reduce) staticFrame();

    const ro = new ResizeObserver(() => { resize(); if (reduce) staticFrame(); });
    ro.observe(wrap);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      visible ? start() : stop();
    }, { rootMargin: "120px" });
    io.observe(wrap);
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerdown", onMove);
    wrap.addEventListener("click", onClick);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerdown", onMove);
      wrap.removeEventListener("click", onClick);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [palettes, tubes, length, onPaletteChange, light]);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ position: "relative", overflow: "hidden", background: light ? "rgba(238,242,248,.55)" : "rgba(3,3,8,.5)", cursor: "pointer", touchAction: "pan-y", ...style }}
    >
      <div ref={glowRef} aria-hidden style={{ position: "absolute", inset: 0, transition: "background .6s ease", pointerEvents: "none" }} />
      <canvas ref={canvasRef} aria-hidden style={{ position: "absolute", inset: 0, display: "block", pointerEvents: "none" }} />
      <div style={{ position: "relative", zIndex: 1, height: "100%", pointerEvents: "none" }}>{children}</div>
    </div>
  );
}
