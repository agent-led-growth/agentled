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
  /**
   * Search-engine meta description. Deliberately more specific than the social
   * line: it carries the terms someone would actually search for.
   */
  description:
    "Independent research on how AI is changing the way businesses grow. Research, experiments, frameworks, and tools for founders, marketers, and growth teams.",
  /** The line shown when the link is unfurled on social, chat and messaging. */
  socialDescription:
    "Exploring the new playbooks for growth in a world shaped by AI agents.",
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

/**
 * Shared OG/Twitter image set.
 *
 * Must be spread into every page that declares its own `openGraph` block: Next
 * replaces the parent block rather than merging it, so a page defining
 * openGraph without images ships with no preview image at all.
 */
export const OG_IMAGES = [
  {
    url: SITE.ogImage,
    width: 1200,
    height: 630,
    alt: `${SITE.name} — ${SITE.tagline}`,
    type: "image/png",
  },
];
