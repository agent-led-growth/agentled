/**
 * Single source of truth for site-level facts. Metadata, JSON-LD, the sitemap
 * and llms.txt all read from here so they cannot drift apart.
 */
export const SITE = {
  url: "https://agentled.co",
  name: "Agent-led Growth",
  legalName: "Campo Base Labs SL",
  title: "Agent-led Growth — Grow in the Age of AI",
  tagline: "Grow in the Age of AI",
  description:
    "Independent research on how AI is changing the way businesses grow. Research, experiments, frameworks, and tools for founders, marketers, and growth teams.",
  shortDescription:
    "Get research, experiments, and tools for the next generation of growth.",
  founder: {
    name: "Hugo Santana",
    linkedin: "https://www.linkedin.com/in/hugosantana8/",
  },
  socials: [
    "https://x.com/hsantana8",
    "https://www.linkedin.com/in/hugosantana8/",
    "https://www.youtube.com/@agent-led-growth",
    "https://agentledco.substack.com",
  ],
  ogImage: "/og.png",
} as const;

/** Routes that should appear in the sitemap. */
export const ROUTES = [
  { path: "/", priority: 1, changeFrequency: "weekly" as const },
  { path: "/ai-search-monitor", priority: 0.8, changeFrequency: "monthly" as const },
];
