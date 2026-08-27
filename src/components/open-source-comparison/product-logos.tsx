/* eslint-disable @next/next/no-img-element -- local SVG brand marks; next/image isn't used on Cloudflare (workerd) */

import { PRODUCTS } from "./products";

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
 * The five compared products as logo + name rows. Wraps into a row on mobile
 * (so it sits below the sign-in form) and stacks into a column on desktop (so it
 * fills the empty space beside the form).
 */
export function ProductLogos() {
  return (
    <ul className="flex flex-wrap gap-x-[18px] gap-y-[14px] md:flex-col md:gap-[20px]">
      {PRODUCTS.map((p) => (
        <li key={p.name} className="flex items-center gap-[12px]">
          <ProductMark logo={p.logo} size={40} />
          <span className="text-[16px] font-medium text-[var(--text-primary)] md:text-[18px]">
            {p.name}
          </span>
        </li>
      ))}
    </ul>
  );
}
