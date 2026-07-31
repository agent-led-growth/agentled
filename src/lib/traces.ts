/**
 * "Etched traces" canvas animation.
 *
 * Ported from the design prototype (`mode === 'traces'`). Framework-free by
 * design: it takes a canvas element and returns a handle. All parameters are in
 * CSS px; the 2D context is scaled by DPR.
 */

export type TracesTheme = "dark" | "light";

type Palette = {
  line: string;
  node: string;
  hot: string;
  glow: string;
};

const PALETTES: Record<TracesTheme, Palette> = {
  dark: {
    line: "rgba(200,240,74,0.13)",
    node: "rgba(200,240,74,0.45)",
    hot: "#dcff6b",
    glow: "rgba(200,240,74,0.9)",
  },
  light: {
    line: "rgba(20,23,15,0.22)",
    node: "rgba(79,122,18,0.62)",
    hot: "#4f7a12",
    glow: "rgba(120,175,30,0.75)",
  },
};

const GRID = 34;
const TRAIL = 90;
const AREA_PER_PATH = 26000;
const MIN_PATH_LENGTH = 60;

type Point = { x: number; y: number };

type Path = {
  pts: Point[];
  segs: number[];
  len: number;
  /** Progress along the path, 0..1.25 (the tail past 1 is the fade-out). */
  p: number;
  speed: number;
  on: boolean;
};

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function buildPaths(w: number, h: number): Path[] {
  const cols = Math.floor(w / GRID);
  const rows = Math.floor(h / GRID);
  const target = Math.round((w * h) / AREA_PER_PATH);
  const paths: Path[] = [];

  // Cap attempts so a pathological viewport (e.g. 1px tall) cannot spin
  // forever rejecting paths shorter than MIN_PATH_LENGTH.
  let attempts = 0;
  const maxAttempts = target * 20 + 100;

  while (paths.length < target && attempts < maxAttempts) {
    attempts++;

    let cx = Math.floor(rnd(0, cols));
    let cy = Math.floor(rnd(0, rows));
    const pts: Point[] = [{ x: cx * GRID, y: cy * GRID }];

    let horiz = Math.random() < 0.5;
    const legs = Math.floor(rnd(3, 7));
    for (let k = 0; k < legs; k++) {
      const len = Math.floor(rnd(2, 7)) * (Math.random() < 0.5 ? -1 : 1);
      if (horiz) cx = Math.max(0, Math.min(cols, cx + len));
      else cy = Math.max(0, Math.min(rows, cy + len));
      pts.push({ x: cx * GRID, y: cy * GRID });
      horiz = !horiz;
    }

    let len = 0;
    const segs: number[] = [];
    for (let k = 1; k < pts.length; k++) {
      const d =
        Math.abs(pts[k].x - pts[k - 1].x) + Math.abs(pts[k].y - pts[k - 1].y);
      segs.push(d);
      len += d;
    }
    if (len < MIN_PATH_LENGTH) continue;

    paths.push({
      pts,
      segs,
      len,
      p: Math.random(),
      speed: rnd(28, 74) / len,
      on: Math.random() < 0.55,
    });
  }

  return paths;
}

/** Point at distance `d` along the path. */
function pointAt(path: Path, d: number): Point {
  let acc = 0;
  for (let k = 0; k < path.segs.length; k++) {
    if (acc + path.segs[k] >= d) {
      const f = (d - acc) / path.segs[k];
      const a = path.pts[k];
      const b = path.pts[k + 1];
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
    acc += path.segs[k];
  }
  return path.pts[path.pts.length - 1];
}

export type TracesHandle = {
  /** Rebuild for a new palette without tearing down the element. */
  setTheme: (theme: TracesTheme) => void;
  destroy: () => void;
};

export function createTraces(
  canvas: HTMLCanvasElement,
  initialTheme: TracesTheme,
): TracesHandle {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { setTheme: () => {}, destroy: () => {} };

  let theme = initialTheme;
  let paths: Path[] = [];
  let w = 0;
  let h = 0;
  let raf = 0;
  let last = 0;
  let visible = true;
  let destroyed = false;

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    paths = buildPaths(w, h);
  }

  function drawBase() {
    const P = PALETTES[theme];
    ctx!.clearRect(0, 0, w, h);
    ctx!.lineWidth = 1;
    ctx!.lineCap = "butt";
    ctx!.lineJoin = "miter";
    ctx!.strokeStyle = P.line;

    for (const pa of paths) {
      ctx!.beginPath();
      ctx!.moveTo(pa.pts[0].x, pa.pts[0].y);
      for (let k = 1; k < pa.pts.length; k++) {
        ctx!.lineTo(pa.pts[k].x, pa.pts[k].y);
      }
      ctx!.stroke();
    }

    ctx!.fillStyle = P.node;
    for (const pa of paths) {
      pa.pts.forEach((p, i) => {
        const s = i === 0 || i === pa.pts.length - 1 ? 4 : 2.4;
        ctx!.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      });
    }
  }

  /** Stroke the portion of `path` between distances d0 and d1. */
  function strokeRange(path: Path, d0: number, d1: number) {
    ctx!.beginPath();
    const s = pointAt(path, Math.max(0, d0));
    ctx!.moveTo(s.x, s.y);
    let acc = 0;
    for (let k = 0; k < path.segs.length; k++) {
      const segEnd = acc + path.segs[k];
      if (segEnd > d0 && acc < d1) {
        const p = pointAt(path, Math.min(d1, segEnd));
        if (acc >= d0) ctx!.lineTo(path.pts[k].x, path.pts[k].y);
        ctx!.lineTo(p.x, p.y);
      }
      acc = segEnd;
    }
    ctx!.stroke();
  }

  function step(dt: number) {
    const P = PALETTES[theme];
    drawBase();

    ctx!.save();
    ctx!.lineWidth = 1.8;
    ctx!.strokeStyle = P.hot;
    ctx!.shadowColor = P.glow;
    ctx!.shadowBlur = 10;

    for (const pa of paths) {
      if (!pa.on) {
        // Idle paths re-arm at ~0.16%/frame.
        if (Math.random() < 0.0016) {
          pa.on = true;
          pa.p = 0;
        }
        continue;
      }
      pa.p += pa.speed * dt;
      if (pa.p > 1.25) {
        pa.on = Math.random() < 0.6;
        pa.p = 0;
      }
      const d = pa.p * pa.len;
      ctx!.globalAlpha = Math.min(1, Math.max(0, 1 - Math.max(0, pa.p - 1) * 4));
      strokeRange(pa, d - TRAIL, Math.min(d, pa.len));
      const head = pointAt(pa, Math.min(d, pa.len));
      ctx!.fillStyle = P.hot;
      ctx!.beginPath();
      ctx!.arc(head.x, head.y, 2.4, 0, Math.PI * 2);
      ctx!.fill();
    }

    ctx!.restore();
  }

  const loop = (t: number) => {
    if (destroyed) return;
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    step(dt);
    raf = requestAnimationFrame(loop);
  };

  function start() {
    if (destroyed || reduceMotion || raf) return;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function sync() {
    if (visible && !document.hidden) start();
    else stop();
  }

  resize();
  // Always paint one static frame immediately. Without this, a page loaded in a
  // background tab (or with reduced motion) shows an empty canvas, since the
  // rAF loop is paused until the page becomes visible.
  drawBase();
  if (!reduceMotion) start();

  // Pause when off-screen or the tab is hidden.
  const io = new IntersectionObserver(
    (entries) => {
      visible = entries.some((e) => e.isIntersecting);
      if (!reduceMotion) sync();
    },
    { threshold: 0 },
  );
  io.observe(canvas);

  const onVisibility = () => {
    if (!reduceMotion) sync();
  };
  document.addEventListener("visibilitychange", onVisibility);

  const ro = new ResizeObserver(() => {
    resize();
    drawBase();
  });
  ro.observe(canvas);

  return {
    setTheme(next) {
      theme = next;
      // Repaint immediately so the palette swaps even while the loop is paused.
      drawBase();
    },
    destroy() {
      destroyed = true;
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}
