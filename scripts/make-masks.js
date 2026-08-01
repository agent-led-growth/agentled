/**
 * Turns a brand favicon into a white alpha mask: the mark becomes opaque, the
 * background transparent. Lets us tint the real letterform with currentColor
 * instead of shipping a baked-in white or teal box.
 *
 * Background is the most common colour, not a corner sample — Siemens' icon has
 * white rounded-corner cutouts that would otherwise be mistaken for the field.
 * Any ink region touching the border is then discarded, which removes those
 * corner cutouts while keeping the letterform (which never touches the edge).
 */
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const [, , SRC, OUT] = process.argv;

const png = PNG.sync.read(fs.readFileSync(SRC));
const { width, height, data } = png;
const idx = (x, y) => (width * y + x) << 2;

// Most common colour = the field.
const counts = new Map();
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = idx(x, y);
    const k = `${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
}
const bg = [...counts.entries()]
  .sort((a, b) => b[1] - a[1])[0][0]
  .split(",")
  .map(Number);
const bgTransparent = bg[3] < 128;

// Pass 1: alpha from colour distance to the field.
const alpha = new Uint8Array(width * height);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = idx(x, y);
    const a = data[i + 3];
    if (a < 8) continue;
    if (bgTransparent) {
      alpha[width * y + x] = a;
    } else {
      const d = Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]);
      const v = Math.max(0, Math.min(255, Math.round((d / 140) * 255)));
      alpha[width * y + x] = Math.round((v * a) / 255);
    }
  }
}

// Pass 2: flood fill inward from the border, clearing ink connected to the edge
// (rounded-corner cutouts). Skipped when the source already has a transparent
// background, where edge-touching ink is legitimate.
let cleared = 0;
if (!bgTransparent) {
  const seen = new Uint8Array(width * height);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = width * y + x;
    // Threshold is deliberately low: at a higher one the antialiased fringe of
    // a corner cutout survives the fill, leaving a faint ring and defeating the
    // bounding-box crop below.
    if (seen[p] || alpha[p] <= 8) return;
    seen[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }
  while (stack.length) {
    const p = stack.pop();
    const x = p % width;
    const y = (p / width) | 0;
    alpha[p] = 0;
    cleared++;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
}

// Pass 3: crop to the ink bounding box. Source icons pad their glyph inside the
// square differently, so without this the marks render at visibly different
// optical sizes next to vector marks that fill their own viewBox.
let minX = width, minY = height, maxX = -1, maxY = -1;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (alpha[width * y + x] > 8) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
if (maxX < 0) throw new Error(`no ink found in ${SRC}`);

const cw = maxX - minX + 1;
const ch = maxY - minY + 1;

const out = new PNG({ width: cw, height: ch });
let ink = 0;
for (let y = 0; y < ch; y++) {
  for (let x = 0; x < cw; x++) {
    const a = alpha[width * (y + minY) + (x + minX)];
    const i = (cw * y + x) << 2;
    out.data[i] = 255;
    out.data[i + 1] = 255;
    out.data[i + 2] = 255;
    out.data[i + 3] = a;
    if (a > 128) ink++;
  }
}

fs.writeFileSync(OUT, PNG.sync.write(out));
console.log(
  `${path.basename(SRC)} -> ${path.basename(OUT)} | ${width}x${height} -> ${cw}x${ch} | field ${bgTransparent ? "transparent" : bg.slice(0, 3).join(",")} | edge-cleared ${cleared}px | ink ${((100 * ink) / (cw * ch)).toFixed(1)}%`,
);
