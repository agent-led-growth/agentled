"use client";

import { useEffect, useRef } from "react";

/**
 * Landing wave field. A node grid drawn as faint squares; concentric rings
 * spawn at an origin and sweep outward, flaring nearby nodes lemon. Origin +
 * grid density differ on mobile (origin sits just off the bottom-right corner,
 * no centre label).
 *
 * Performance:
 * - Two stacked canvases: the static layers (background rings + resting node
 *   grid) are drawn ONCE into a background canvas; the live layer (lit nodes +
 *   moving rings) is an overlay cleared to transparent each frame — so there is
 *   no full-buffer blit per frame.
 * - The loop is throttled to ~30fps (rings advance by real elapsed time, so
 *   their speed is unchanged) and only runs while on-screen with the tab visible.
 * - Lit nodes are found by binary-searching the grid (pre-sorted by distance
 *   from the origin) for each ring's thin band, instead of testing every node
 *   against every ring.
 * - Rings are culled once their fade makes them invisible, so far, near-zero-
 *   alpha strokes stop costing anything.
 * - The ring glow is a few cheap wide strokes rather than canvas `shadowBlur`.
 * - `prefers-reduced-motion` renders a single resting frame and never loops.
 */
export function WaveCanvas() {
  const bgRef = useRef<HTMLCanvasElement | null>(null); // static layer, drawn once
  const fgRef = useRef<HTMLCanvasElement | null>(null); // live overlay, cleared each frame

  useEffect(() => {
    const bg = bgRef.current;
    const fg = fgRef.current;
    const parent = fg?.parentElement;
    if (!bg || !fg || !parent) return;
    const bgCtx = bg.getContext("2d");
    const fgCtx = fg.getContext("2d");
    if (!bgCtx || !fgCtx) return;

    const reduceMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    // ~30fps is plenty for slow ambient motion; a frame is rendered once the gap
    // clears this, so at 60Hz vsync we render every other frame.
    const MIN_FRAME_MS = 30;

    let raf = 0;
    let running = false;
    let onscreen = false;
    let last = 0;
    let bw = 0;
    let bh = 0;
    let step: ((dt: number) => void) | null = null;

    function build() {
      const context = fgCtx!;
      const bctx = bgCtx!;
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      const w = parent!.clientWidth || 500;
      const h = parent!.clientHeight || 620;
      bw = w;
      bh = h;
      const mobile = w < 700;

      // Both canvases are the same size and transform.
      for (const el of [bg!, fg!]) {
        el.width = w * dpr;
        el.height = h * dpr;
        el.style.width = `${w}px`;
        el.style.height = `${h}px`;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);

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

      // Grid sorted by distance-from-origin so a ring's band is a contiguous
      // slice we can binary-search; `dists` mirrors it for tight inner loops.
      const grid: { x: number; y: number; d: number }[] = [];
      for (let x = ((w % g) / 2) + g / 2; x < w; x += g)
        for (let y = ((h % g) / 2) + g / 2; y < h; y += g) {
          const d = Math.hypot(x - cx, y - cy);
          if (d < maxR && d > 46) grid.push({ x, y, d });
        }
      grid.sort((a, b) => a.d - b.d);
      const n = grid.length;
      const dists = new Float32Array(n);
      for (let i = 0; i < n; i++) dists[i] = grid[i].d;

      // Static layers — drawn once into the background canvas.
      bctx.clearRect(0, 0, w, h);
      bctx.lineWidth = 1;
      bctx.strokeStyle = "rgba(238,241,236,0.055)";
      for (let r = 110; r < maxR; r += 118) {
        bctx.beginPath();
        bctx.arc(cx, cy, r, 0, 6.2832);
        bctx.stroke();
      }
      bctx.fillStyle = "rgba(238,241,236,0.085)";
      for (const p of grid) bctx.fillRect(p.x - 1.1, p.y - 1.1, 2.2, 2.2);

      // Below this fade, a ring's strokes and node flare are sub-1% alpha —
      // invisible, so both spawn-life and per-frame work stop there.
      const CULL = 0.012;
      // Constant halo geometry: [lineWidth, baseAlpha]; alpha is scaled by fade
      // per frame. Hoisted so the frame loop allocates nothing.
      const HALO: readonly [number, number][] = [
        [9, 0.07],
        [4, 0.13],
        [1.8, 0.6],
      ];
      const BAND = 30;

      const waves: { r: number }[] = [];
      let spawn = 1.4;

      // First index whose distance is >= target.
      const lowerBound = (target: number): number => {
        let lo = 0;
        let hi = n;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (dists[mid] < target) lo = mid + 1;
          else hi = mid;
        }
        return lo;
      };

      // Per-frame node brightness, reset by touched-index list (no O(n) clear).
      const lit = new Float32Array(n);
      let touched: number[] = [];

      step = (dt: number) => {
        spawn += dt;
        if (spawn > 1.45) {
          spawn = 0;
          waves.push({ r: 40 });
        }

        // Overlay clears to transparent; the static background shows through.
        context.clearRect(0, 0, w, h);

        for (const i of touched) lit[i] = 0;
        touched = [];

        // Flare nodes inside each ring's band via binary search, keeping the
        // brightest contribution per node.
        for (const wv of waves) {
          const a = fade(wv.r);
          if (a < CULL) continue;
          const rHi = wv.r + BAND;
          for (let i = lowerBound(wv.r - BAND); i < n && dists[i] <= rHi; i++) {
            const c = (1 - Math.abs(dists[i] - wv.r) / BAND) * a;
            if (c > lit[i]) {
              if (lit[i] === 0) touched.push(i);
              lit[i] = c;
            }
          }
        }
        for (const i of touched) {
          const l = lit[i];
          if (l <= 0.04) continue;
          const p = grid[i];
          const s = 2.2 + l * 3.2;
          context.fillStyle = `rgba(220,255,107,${0.2 + l * 0.8})`;
          context.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        }

        // Advance + stroke rings; drop any that ran past the edge or faded out.
        for (let k = waves.length - 1; k >= 0; k--) {
          const wv = waves[k];
          wv.r += speed * dt;
          const a = fade(wv.r);
          if (wv.r > maxR || a < CULL) {
            waves.splice(k, 1);
            continue;
          }
          for (const [lw, weight] of HALO) {
            context.beginPath();
            context.arc(cx, cy, wv.r, 0, 6.2832);
            context.lineWidth = lw;
            context.strokeStyle = `rgba(200,240,74,${weight * a})`;
            context.stroke();
          }
        }
      };

      const mask = mobile
        ? "linear-gradient(200deg, transparent, #000 60%)"
        : "linear-gradient(to right, transparent, #000 55%)";
      for (const el of [bg!, fg!]) {
        el.style.setProperty("mask-image", mask);
        el.style.setProperty("-webkit-mask-image", mask);
      }

      // Reduced motion: the static background is the whole picture — no loop.
      if (reduceMotion) context.clearRect(0, 0, w, h);
    }

    function frame(t: number) {
      raf = requestAnimationFrame(frame);
      const elapsed = t - last;
      if (elapsed < MIN_FRAME_MS) return; // throttle: skip this vsync
      last = t;
      step?.(Math.min(0.05, elapsed / 1000));
    }
    function sync() {
      if (reduceMotion) return; // never animate for reduced-motion users
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
    <>
      <canvas
        ref={bgRef}
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, display: "block" }}
      />
      <canvas
        ref={fgRef}
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, display: "block" }}
      />
    </>
  );
}
