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
  pricing: {
    eyebrow: "Pricing",
    headline: "Pricing that scales with your visibility",
    subhead:
      "Start with a free scan. Upgrade for daily tracking, more prompts and more brands.",
    billing: {
      monthly: "Monthly",
      yearly: "Yearly",
      yearlyNote: "2 months free",
    },
    perMonth: "/mo",
    perYear: "/yr",
    freePrice: "Free",
    featured: "Most popular",
    currentPlan: "Current plan",
    plans: {
      free: {
        name: "Free Scan",
        tagline: "Anyone curious about their AI visibility.",
        cta: "Start free scan",
      },
      starter: {
        name: "Starter",
        tagline: "Small businesses, creators, and solo founders.",
        cta: "Get Starter",
      },
      pro: {
        name: "Pro",
        tagline: "Companies actively working on AI visibility.",
        cta: "Get Pro",
      },
      business: {
        name: "Business",
        tagline: "Agencies and teams managing multiple brands.",
        cta: "Get Business",
      },
    },
    features: {
      brand: "brand",
      brands: "brands",
      prompts: "prompts",
      oneTimeScan: "One-time scan",
      dailyScans: "Daily scans",
      weeklyReport: "Weekly report",
      chatgpt: "ChatGPT",
      moreModelsSoon: "more models coming soon",
    },
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
    pricing: {
      title: "Pricing",
      description:
        "Simple plans for tracking your brand's visibility in AI answers. Start with a free scan; upgrade for daily scans, more prompts and more brands.",
    },
  },
};
