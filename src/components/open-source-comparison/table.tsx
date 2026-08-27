/**
 * Open Source Comparison table — the public content shown at
 * /open-source-agent-readiness. Pure presentational; the data mirrors the
 * source doc (docs / open-source-comparison.md) 1:1, including the glyphs
 * (✅ ◐ ❌ —) and the two footnote markers (*). Themed with the semantic
 * design tokens so it reads in both light and dark. Each cell pairs the glyph
 * (aria-hidden) with a visually-hidden text label, so a screen reader announces
 * the meaning rather than an undescribed symbol.
 */

const PRODUCTS = ["PostHog", "Supabase", "n8n", "Postiz", "Resend"] as const;

type Row = { check: string; values: readonly string[] };

const ROWS: readonly Row[] = [
  { check: "Single main product repo", values: ["✅", "◐", "✅", "✅", "❌"] },
  { check: "Monorepo", values: ["✅", "✅*", "✅", "✅", "❌*"] },
  { check: "Core product code public", values: ["◐", "✅", "✅", "✅", "❌"] },
  { check: "Hosted product + open source", values: ["✅", "✅", "✅", "✅", "✅"] },
  { check: "Self-hostable", values: ["✅", "✅", "✅", "✅", "❌"] },
  { check: "Clear OSS / commercial boundary", values: ["✅", "◐", "✅", "◐", "✅"] },
  { check: "Root README", values: ["✅", "✅", "✅", "✅", "—"] },
  { check: "CONTRIBUTING.md", values: ["✅", "✅", "✅", "✅", "◐"] },
  { check: "Security policy / SECURITY.md", values: ["✅", "✅", "✅", "✅", "◐"] },
  { check: "Explicit license", values: ["✅", "✅", "✅", "✅", "✅"] },
  { check: "Example environment config", values: ["✅", "✅", "✅", "✅", "✅"] },
  { check: "Docker / local deployment", values: ["✅", "✅", "✅", "✅", "—"] },
  { check: "Clear local development commands", values: ["✅", "✅", "✅", "✅", "✅"] },
  { check: "One-command agent bootstrap", values: ["❌", "❌", "✅", "❌", "❌"] },
  { check: "Root AGENTS.md", values: ["✅", "❌", "✅", "❌", "—"] },
  { check: "Claude-specific instructions", values: ["✅", "✅", "✅", "✅", "◐"] },
  { check: "Agent-specific skills", values: ["✅", "✅", "✅", "❌", "✅"] },
];

const LEGEND: readonly [string, string][] = [
  ["✅", "Yes"],
  ["◐", "Partial / hybrid"],
  ["❌", "No"],
  ["—", "Not applicable / not found"],
];

const FOOTNOTES: readonly string[] = [
  "Supabase is more modular across repositories despite using monorepo patterns in parts of the ecosystem.",
  "Resend's open-source ecosystem is intentionally split across separate repositories.",
];

/**
 * Spoken label for each glyph, so a cell isn't just an undescribed symbol to
 * assistive tech. Keyed by the base glyph; a trailing "*" footnote marker is
 * stripped before lookup and surfaced as "(see note)".
 */
const CELL_LABELS: Record<string, string> = {
  "✅": "Yes",
  "◐": "Partial",
  "❌": "No",
  "—": "Not applicable",
};

/** The screen-reader text for a cell value like "✅" or "✅*". */
function cellLabel(value: string): string {
  const starred = value.endsWith("*");
  const glyph = starred ? value.slice(0, -1) : value;
  const label = CELL_LABELS[glyph] ?? glyph;
  return starred ? `${label} (see note)` : label;
}

export function ComparisonTable() {
  return (
    <div className="flex flex-col gap-[20px]">
      {/* Legend */}
      <ul className="flex flex-wrap gap-x-[20px] gap-y-[6px] text-[13px] text-[var(--text-muted)] md:text-[14px]">
        {LEGEND.map(([glyph, meaning]) => (
          <li key={glyph} className="flex items-center gap-[8px]">
            <span aria-hidden="true">{glyph}</span>
            <span>{meaning}</span>
          </li>
        ))}
      </ul>

      {/* Table — scrolls horizontally on narrow screens rather than overflowing.
          tabIndex + role/label make the scroll region focusable so keyboard
          users can reach off-screen columns (WCAG 2.1.1). */}
      <div
        role="region"
        aria-label="Open-source comparison table"
        tabIndex={0}
        className="overflow-x-auto border border-[var(--border-hairline)]"
      >
        <table className="w-full border-collapse text-[14px] md:text-[15px]">
          <thead>
            <tr className="border-b border-[var(--border-hairline)] bg-[var(--surface)]">
              <th
                scope="col"
                className="sticky left-0 z-10 min-w-[220px] bg-[var(--surface)] px-[16px] py-[12px] text-left font-semibold text-[var(--text-primary)]"
              >
                Check
              </th>
              {PRODUCTS.map((p) => (
                <th
                  key={p}
                  scope="col"
                  className="min-w-[92px] px-[14px] py-[12px] text-center font-semibold text-[var(--text-primary)]"
                >
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr
                key={row.check}
                className="border-b border-[var(--border-hairline)] last:border-b-0"
              >
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-[var(--surface)] px-[16px] py-[11px] text-left font-normal text-[var(--text-primary)]"
                >
                  {row.check}
                </th>
                {row.values.map((v, i) => (
                  <td
                    key={PRODUCTS[i]}
                    className="px-[14px] py-[11px] text-center text-[var(--text-primary)]"
                  >
                    <span aria-hidden="true">{v}</span>
                    <span className="sr-only">{cellLabel(v)}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footnotes (the * markers above) */}
      <ol className="flex flex-col gap-[4px] text-[12px] leading-[1.5] text-[var(--text-faint)] md:text-[13px]">
        {FOOTNOTES.map((note) => (
          <li key={note}>
            <span aria-hidden="true" className="mr-[6px]">
              *
            </span>
            {note}
          </li>
        ))}
      </ol>
    </div>
  );
}
