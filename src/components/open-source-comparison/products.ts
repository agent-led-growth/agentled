/**
 * The five products compared. Logos are local brand marks in public/logos (real
 * trademarks of their owners), shown on light tiles. `as const` keeps the names
 * as literal types so `ProductName` is the exact union — the table keys each
 * row's values by name, so column order lives only here and can't drift out of
 * sync with the data.
 */
export const PRODUCTS = [
  { name: "PostHog", logo: "/logos/posthog.svg" },
  { name: "Supabase", logo: "/logos/supabase.svg" },
  { name: "n8n", logo: "/logos/n8n.svg" },
  { name: "Postiz", logo: "/logos/postiz.svg" },
  { name: "Resend", logo: "/logos/resend.svg" },
] as const;

export type Product = (typeof PRODUCTS)[number];

/** Exact union of product names — the key type for each table row's values. */
export type ProductName = Product["name"];

/**
 * Landing-only mark overrides. The landing shows marks tile-less on the dark
 * surface, so a pure-black mark (Resend) would vanish — use its white variant
 * there. The table keeps the original (dark) mark on its light tiles.
 */
export const LANDING_LOGO: Partial<Record<ProductName, string>> = {
  Resend: "/logos/resend-white.svg",
};
