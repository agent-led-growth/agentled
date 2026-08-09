/**
 * English marketing copy. This is the reference dictionary: `es.ts` (added when
 * the Spanish landings ship) must mirror this shape exactly — the `Dictionary`
 * type in `./index.ts` is derived from it, so any drift is a compile error.
 *
 * Only user-visible marketing strings live here. App/auth chrome, the FAQ
 * question/answer bodies (`faq-content.tsx`) and SEO metadata are localized
 * separately.
 */
export const en = {
  hero: {
    headline: "Grow in the Age of AI",
    subhead:
      "Get research, experiments, and tools for the next generation of growth.",
    subscribe: "Subscribe",
    ctaChip: "Try the AI Search Monitor",
  },
  faq: {
    eyebrow: "FAQ",
    // Rendered across two lines with a <br/> between the parts.
    heading: ["Questions,", "answered"],
  },
  aiSearch: {
    headline: "Does AI recommend your brand?",
    subhead: "Master AI visibility, win more recommendations, traffic and leads.",
    modelsEyebrow: "Monitor top AI models & assistants",
    brandMarker: "Your brand",
  },
} as const;
