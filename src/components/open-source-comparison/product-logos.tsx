/* eslint-disable @next/next/no-img-element -- local SVG brand marks; next/image isn't used on Cloudflare (workerd) */

import { LANDING_LOGO, PRODUCTS } from "./products";

/**
 * A brand mark on a light tile. The tile stays light in BOTH themes (per the
 * logo convention), so colored and black marks — e.g. Resend's black — stay
 * legible on any background. Decorative (alt=""): every caller renders the
 * product name as adjacent text.
 */
export function ProductMark({ logo, size = 22 }: { logo: string; size?: number }) {
  // Size marks by a consistent HEIGHT with auto width, so a wide mark (e.g.
  // n8n's ~1.9:1) reads at the same optical size as a square one instead of
  // being letterboxed small in a square box. The tile is a square minimum and
  // grows horizontally for wide marks.
  const glyph = Math.round(size * 0.72);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[6px] bg-white px-[4px] ring-1 ring-black/5"
      style={{ height: size, minWidth: size }}
    >
      <img src={logo} alt="" loading="lazy" style={{ height: glyph, width: "auto" }} />
    </span>
  );
}

/**
 * The five compared products as bare brand marks — no tile, no name (the mark
 * carries the recognition). A wrapping, centered row: a single horizontal line
 * below the form on mobile, and a centered two-line block (the max-width forces
 * the wrap) filling the space beside the form on desktop. Marks keep their
 * alt text since there's no adjacent name.
 */
export function ProductLogos() {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-[20px] gap-y-[18px] md:max-w-[300px] md:gap-x-[28px] md:gap-y-[24px]">
      {PRODUCTS.map((p) => (
        <li key={p.name} className="flex items-center justify-center">
          <img
            src={LANDING_LOGO[p.name] ?? p.logo}
            alt={p.name}
            loading="lazy"
            className="h-[38px] w-auto md:h-[50px]"
          />
        </li>
      ))}
    </ul>
  );
}
