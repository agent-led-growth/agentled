import "server-only";

import { normalizeDomain } from "./domain";
import { detectLogo } from "./logo";
import { runStructured } from "./providers";
import { readSiteContent } from "./reader";
import { registry } from "./registry";

/**
 * Enrichment (step 2): domain → name, one-line description, ~10 suggested
 * topics, and a logo. Reader + logo run in parallel; then the generation model
 * turns the site content into structured fields. Best-effort throughout — a
 * dead site or a model failure returns a domain-only shell so onboarding is
 * never blocked (the user just types topics manually).
 */

export interface EnrichmentResult {
  name: string | null;
  description: string | null;
  topics: string[];
  logoUrl: string | null;
}

const MAX_TOPICS = 10;

const ENRICHMENT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["name", "description", "topics"],
  properties: {
    name: { type: "string", description: "The brand's name." },
    description: {
      type: "string",
      description: "One concise sentence: what the brand is and who it's for.",
    },
    topics: {
      type: "array",
      description:
        "About 10 short topic categories a potential customer might ask an AI " +
        "assistant about in this brand's space — the questions where we'd check " +
        "whether the brand gets recommended. Short noun phrases, not questions.",
      items: { type: "string" },
    },
  },
};

const SYSTEM_PROMPT =
  "You are Laurel's brand-enrichment step. From a brand's website content (and " +
  "optionally a note from the owner), infer the brand's name, one concise " +
  "sentence describing what it is and who it's for, and about 10 short topic " +
  "categories a potential customer might ask an AI assistant like ChatGPT about " +
  "in this space — the kinds of questions where we'd want to know whether this " +
  "brand gets recommended. Topics are short noun phrases (e.g. 'AI search " +
  "visibility monitoring', 'competitor benchmarking in AI answers'), not " +
  "questions. Base everything on the provided content; do not invent facts.";

export async function enrichBrand(
  domain: string,
  about?: string,
): Promise<EnrichmentResult> {
  const host = normalizeDomain(domain);

  const [content, logoUrl] = await Promise.all([
    readSiteContent(host),
    detectLogo(host).catch(() => null),
  ]);

  // Dead / unfetchable site: domain-only shell, user types topics.
  if (!content) {
    return { name: null, description: null, topics: [], logoUrl };
  }

  try {
    const input =
      `Website: ${host}\n\n` +
      (about?.trim() ? `Owner's note about the brand:\n${about.trim()}\n\n` : "") +
      `Site content (may be truncated):\n${content}`;

    const { data } = await runStructured(registry.enrichment, {
      system: SYSTEM_PROMPT,
      input,
      schemaName: "brand_enrichment",
      schema: ENRICHMENT_SCHEMA,
    });

    return { ...parseEnrichment(data), logoUrl };
  } catch (err) {
    // Model/parse failure shouldn't block onboarding — fall back to manual.
    console.error("laurel enrichment: generation failed", err);
    return { name: null, description: null, topics: [], logoUrl };
  }
}

function parseEnrichment(data: unknown): Omit<EnrichmentResult, "logoUrl"> {
  const rec = (data ?? {}) as Record<string, unknown>;
  const name = typeof rec.name === "string" ? rec.name.trim() : "";
  const description = typeof rec.description === "string" ? rec.description.trim() : "";
  const topics = Array.isArray(rec.topics)
    ? rec.topics
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, MAX_TOPICS)
    : [];
  return { name: name || null, description: description || null, topics };
}
