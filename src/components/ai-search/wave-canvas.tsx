"use client";

import { useEffect, useRef } from "react";

/**
 * Landing wave field. A node grid drawn as faint squares; concentric rings
 * spawn at an origin and sweep outward, flaring nearby nodes lemon. Origin +
 * grid density differ on mobile (origin sits just off the bottom-right corner,
 * no centre label).
 *
 * Performance: the static layers (background rings + resting node grid) are
 * pre-rendered once to an offscreen buffer and blitted each frame, so only the
 * lit nodes and the moving rings are drawn live. The ring glow is a few cheap
 * wide strokes rather than canvas `shadowBlur` (which rasterises a blurred
 * bitmap per ring and was what made the field slow down as rings accumulated).
 * The loop only runs while the canvas is on-screen and the tab is visible.
 */
export function WaveCanvas() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let running = false;
    let onscreen = false;
    let last = 0;
    let bw = 0;
    let bh = 0;
    let step: ((dt: number) => void) | null = null;

    function build() {
      const el = canvas!;
      const context = ctx!;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = parent!.clientWidth || 500;
      const h = parent!.clientHeight || 620;
      bw = w;
      bh = h;
      const mobile = w < 700;
      el.width = w * dpr;
      el.height = h * dpr;
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cx = mobile ? w + 40 : w - 306;
      const cy = mobile ? h + 40 : h * 0.545;
      const maxR =
        Math.max(
          Math.hypot(cx, cy),
          Math.hypot(w - cx, cy),
          Math.hypot(cx, h - cy),
          Math.hypot(w - cx, h - cy),
        ) * 1.04;
      const fade = (r: number) => Math.pow(Math.max(0, 1 - r / maxR), 0.55);
      const g = mobile ? 28 : 34;
      const speed = mobile ? 78 : 82;

      const grid: { x: number; y: number; d: number }[] = [];
      for (let x = ((w % g) / 2) + g / 2; x < w; x += g)
        for (let y = ((h % g) / 2) + g / 2; y < h; y += g) {
          const d = Math.hypot(x - cx, y - cy);
          if (d < maxR && d > 46) grid.push({ x, y, d });
        }

      // Pre-render the static layers (background rings + resting nodes) once.
      const buf = document.createElement("canvas");
      buf.width = w * dpr;
      buf.height = h * dpr;
      const bctx = buf.getContext("2d")!;
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bctx.lineWidth = 1;
      bctx.strokeStyle = "rgba(238,241,236,0.055)";
      for (let r = 110; r < maxR; r += 118) {
        bctx.beginPath();
        bctx.arc(cx, cy, r, 0, 6.2832);
        bctx.stroke();
      }
      bctx.fillStyle = "rgba(238,241,236,0.085)";
      for (const p of grid) bctx.fillRect(p.x - 1.1, p.y - 1.1, 2.2, 2.2);

      const waves: { r: number }[] = [];
      let acc = 1.4;

      step = (dt: number) => {
        acc += dt;
        if (acc > 1.45) {
          acc = 0;
          waves.push({ r: 40 });
        }

        context.clearRect(0, 0, w, h);
        context.drawImage(buf, 0, 0, w, h);

        // Only the lit nodes are drawn live; the rest live in the buffer.
        for (const p of grid) {
          let lit = 0;
          for (const wv of waves) {
            const d = Math.abs(p.d - wv.r);
            if (d < 30) lit = Math.max(lit, (1 - d / 30) * fade(wv.r));
          }
          if (lit > 0.04) {
            const s = 2.2 + lit * 3.2;
            context.fillStyle = `rgba(220,255,107,${0.2 + lit * 0.8})`;
            context.fillRect(p.x - s / 2, p.y - s / 2, s, s);
          }
        }

        // Rings — layered wide strokes approximate the lemon glow, far cheaper
        // than shadowBlur.
        for (let i = waves.length - 1; i >= 0; i--) {
          const wv = waves[i];
          wv.r += speed * dt;
          if (wv.r > maxR) {
            waves.splice(i, 1);
            continue;
          }
          const a = fade(wv.r);
          const halo: [number, number][] = [
            [9, 0.07 * a],
            [4, 0.13 * a],
            [1.8, 0.6 * a],
          ];
          for (const [lw, alpha] of halo) {
            context.beginPath();
            context.arc(cx, cy, wv.r, 0, 6.2832);
            context.lineWidth = lw;
            context.strokeStyle = `rgba(200,240,74,${alpha})`;
            context.stroke();
          }
        }
      };

      const mask = mobile
        ? "linear-gradient(200deg, transparent, #000 60%)"
        : "linear-gradient(to right, transparent, #000 55%)";
      el.style.setProperty("mask-image", mask);
      el.style.setProperty("-webkit-mask-image", mask);
    }

    function frame(t: number) {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      step?.(dt);
      raf = requestAnimationFrame(frame);
    }
    function sync() {
      const shouldRun = onscreen && !document.hidden;
      if (shouldRun && !running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      } else if (!shouldRun && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    }

    build();

    const io = new IntersectionObserver((entries) => {
      onscreen = entries[0]?.isIntersecting ?? false;
      sync();
    });
    io.observe(parent);

    const ro = new ResizeObserver(() => {
      if (parent.clientWidth !== bw || parent.clientHeight !== bh) build();
    });
    ro.observe(parent);

    document.addEventListener("visibilitychange", sync);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, display: "block" }}
    />
  );
}
