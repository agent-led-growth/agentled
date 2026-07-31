/**
 * Brand marks as inline SVG (crisper than CSS boxes at any scale). Geometry is
 * expressed in a 40-unit viewBox for the plus mark and 30 for the antenna,
 * matching the desktop pixel sizes in the handoff so the ratios stay exact.
 */

/** Lockup mark: lime square with a centred plus. */
export function PlusMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="40" height="40" fill="#c8f04a" />
      {/* horizontal 20×5.8 and vertical 5.8×20, both centred */}
      <rect x="10" y="17.1" width="20" height="5.8" fill="#14170f" />
      <rect x="17.1" y="10" width="5.8" height="20" fill="#14170f" />
    </svg>
  );
}

/** CTA mark: lime square with a mast-and-beacon antenna (option B). */
export function AntennaMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 30 30"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="30" height="30" fill="#c8f04a" />
      {/* mast 3×13 at left 13.5, top 12 */}
      <rect x="13.5" y="12" width="3" height="13" fill="#14170f" />
      {/* beacon Ø9 at left 10.5, top 5 */}
      <circle cx="15" cy="9.5" r="4.5" fill="#14170f" />
    </svg>
  );
}
