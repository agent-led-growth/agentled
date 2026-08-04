import type { CSSProperties } from "react";

/**
 * The AI Search Monitor ships its own scoped palettes as CSS custom properties,
 * applied on a wrapper (the design's approach). The rest of the site is
 * dark-only via `data-theme`, so these live locally on the tool rather than in
 * global tokens. Marketing screens (landing) are always dark; every screen
 * after it is always light.
 */

const font =
  "var(--font-space-grotesk), ui-sans-serif, system-ui, sans-serif";

/** Dark marketing palette — the landing only. */
export const marketingTokens = {
  // Site black (globals --color-ink), so the landing matches the root landing
  // and its own FAQ/footer (which use --surface). The handoff's #0e100f was a
  // slightly different black and left a faint seam at the hero/FAQ boundary.
  "--ground": "#0b0d0c",
  "--ink": "#eef1ec",
  "--muted": "#a7ada4",
  "--dim": "#7e857c",
  "--line": "#343833",
  "--hairline": "#22261f",
  "--panel": "#1b1e1c",
  "--signal": "#c8f04a",
  "--on-signal": "#14170f",
  background: "var(--ground)",
  color: "var(--ink)",
  fontFamily: font,
} as CSSProperties;

/** Light app palette — every screen after the landing. */
export const appTokens = {
  "--bg": "#f6f7f4",
  "--panel": "#ffffff",
  "--panel2": "#f1f3ef",
  "--hov": "#d8dcd2",
  "--line": "#e2e5df",
  "--ink": "#1a1d1b",
  "--mut": "#5e655d",
  "--dim": "#8b928a",
  "--pos": "#5f8a2a",
  "--neg": "#ad4425",
  "--grn": "#c8f04a",
  background: "var(--bg)",
  color: "var(--ink)",
  fontFamily: font,
} as CSSProperties;

/** Maps a delta tone to its app colour var. */
export const toneVar = (t: "pos" | "neg" | "dim") =>
  t === "pos" ? "var(--pos)" : t === "neg" ? "var(--neg)" : "var(--dim)";

export const MONO = "var(--font-jetbrains-mono), ui-monospace, monospace";
