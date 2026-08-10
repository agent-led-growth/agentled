/**
 * English marketing copy. This is the reference dictionary: `es.ts` mirrors
 * this shape exactly — the `Dictionary` type in `./index.ts` is derived from
 * it, so any drift is a compile error.
 *
 * Only user-visible marketing strings and page-level metadata live here. App/
 * auth chrome and the FAQ question/answer bodies (`faq-content.tsx`) are
 * localized separately.
 */
export const en = {
  hero: {
    headline: "Grow in the Age of AI",
    subhead:
      "Get research, experiments, and tools for the next generation of growth.",
    subscribe: "Subscribe",
    ctaChip: "Try the AI Search Monitor",
    socialProof: "Read by people at",
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
    scanButton: "Scan my brand",
    scanAriaLabel: "Your website",
  },
  footer: {
    tools: "Our Tools",
    languages: "Languages",
  },
  meta: {
    siteTitle: "Agent-led Growth — Grow in the Age of AI",
    siteDescription:
      "Independent research on how AI is changing the way businesses grow. Research, experiments, frameworks, and tools for founders, marketers, and growth teams.",
    siteSocialDescription:
      "Exploring the new playbooks for growth in a world shaped by AI agents.",
    aiSearch: {
      title: "AI Search Monitor",
      description:
        "See how often AI assistants recommend your brand. Track your visibility across ChatGPT, Claude, Gemini, Perplexity and Copilot — and win more recommendations, traffic and leads.",
      ogTitle: "AI Search Monitor — Does AI recommend your brand?",
      ogDescription:
        "Track how often AI assistants recommend your brand across ChatGPT, Claude, Gemini, Perplexity and Copilot.",
    },
  },
};
