/* eslint-disable @next/next/no-img-element -- local SVG brand marks; next/image isn't used on Cloudflare (workerd) */

import type { CSSProperties } from "react";

import { LANDING_LOGO, PRODUCTS, type ProductName } from "./products";

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
 * Per-mark heights (px) on the landing, tuned so the differently-proportioned
 * marks read at a consistent optical size — mobile / desktop. Set as CSS vars so
 * the static `h-[var(...)]` utilities stay responsive per logo.
 */
const LANDING_SIZE: Record<ProductName, { mobile: number; desktop: number }> = {
  PostHog: { mobile: 38, desktop: 60 },
  Supabase: { mobile: 38, desktop: 60 },
  n8n: { mobile: 34, desktop: 50 },
  Postiz: { mobile: 38, desktop: 60 },
  Resend: { mobile: 37, desktop: 55 },
};

/**
 * The five compared products as bare brand marks — no tile, no name (the mark
 * carries the recognition). A wrapping, centered row: a single horizontal line
 * below the form on mobile, and a centered two-line block (the max-width forces
 * the wrap) filling the space beside the form on desktop. Marks keep their alt
 * text since there's no adjacent name.
 */
export function ProductLogos() {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-[20px] gap-y-[18px] md:max-w-[340px] md:gap-x-[28px] md:gap-y-[24px]">
      {PRODUCTS.map((p) => {
        const size = LANDING_SIZE[p.name];
        return (
          <li key={p.name} className="flex items-center justify-center">
            <img
              src={LANDING_LOGO[p.name] ?? p.logo}
              alt={p.name}
              loading="lazy"
              className="h-[var(--logo-h)] w-auto md:h-[var(--logo-h-md)]"
              style={
                {
                  "--logo-h": `${size.mobile}px`,
                  "--logo-h-md": `${size.desktop}px`,
                } as CSSProperties
              }
            />
          </li>
        );
      })}
    </ul>
  );
}
