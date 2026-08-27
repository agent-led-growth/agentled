/**
 * The five products compared, in the exact column order the table's ROWS align
 * to (values[0] = PostHog … values[4] = Resend). Logos are local brand marks in
 * public/logos (real trademarks of their owners), shown on light tiles.
 */
export type Product = { name: string; logo: string };

export const PRODUCTS: readonly Product[] = [
  { name: "PostHog", logo: "/logos/posthog.svg" },
  { name: "Supabase", logo: "/logos/supabase.svg" },
  { name: "n8n", logo: "/logos/n8n.svg" },
  { name: "Postiz", logo: "/logos/postiz.svg" },
  { name: "Resend", logo: "/logos/resend.svg" },
];
