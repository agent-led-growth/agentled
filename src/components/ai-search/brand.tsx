import { MONO } from "./tokens";

/**
 * The Agent-led Growth mark: a lemon square with a dark plus. The two bars are
 * 50% of the square wide and 15% thick, centred (they don't bleed to the edge).
 * Built from divs per the handoff — no SVG asset.
 */
export function Mark({
  size = 34,
  square = "#c8f04a",
  plus = "#14170f",
}: {
  size?: number;
  square?: string;
  plus?: string;
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: "relative",
        display: "inline-block",
        width: size,
        height: size,
        background: square,
        flex: "none",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "50%",
          height: "15%",
          background: plus,
        }}
      />
      <span
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "15%",
          height: "50%",
          background: plus,
        }}
      />
    </span>
  );
}

/** AGENT-LED / GROWTH stacked on two lines. Colour inherits from context. */
export function Wordmark({ size = 18 }: { size?: number }) {
  return (
    <span
      style={{
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: "-0.035em",
        display: "block",
      }}
    >
      AGENT-LED
      <br />
      GROWTH
    </span>
  );
}

/** Mark + wordmark lockup. */
export function Lockup({
  markSize = 34,
  wordSize = 18,
  gap = 14,
}: {
  markSize?: number;
  wordSize?: number;
  gap?: number;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap }}>
      <Mark size={markSize} />
      <Wordmark size={wordSize} />
    </span>
  );
}

/** Small bordered brand tile (e.g. "AG") used on Topics / dashboard rows. */
export function BrandTile({ size = 26, label = "AG" }: { size?: number; label?: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-grid",
        placeItems: "center",
        width: size,
        height: size,
        border: "1px solid var(--line)",
        fontFamily: MONO,
        fontSize: size * 0.4,
        fontWeight: 700,
        flex: "none",
      }}
    >
      {label}
    </span>
  );
}
