import "server-only";

import { runStructured } from "./providers";
import { registry } from "./registry";

/**
 * Extraction (pipeline step 7). Read the scan's answer and return every brand
 * named, in order of first appearance, resolved to canonical names, with the
 * monitored brand flagged. Deterministic parsing — not generation — kept as a
 * separate role so the scan can answer naturally. Citations come from the scan's
 * annotations (see scan.ts), not here.
 */

export interface ExtractedBrand {
  /** The name exactly as it appeared in the answer. */
  raw: string;
  /** Resolved canonical name (prefers a known competitor name). */
  canonical: string;
  isSelf: boolean;
  /** Order of first appearance; 1 = first brand named. */
  position: number;
}

const SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["brands"],
  properties: {
    brands: {
      type: "array",
      description: "Every distinct brand/product/company named, in order of first appearance.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["raw", "canonical", "is_self", "position"],
        properties: {
          raw: { type: "string", description: "The name exactly as it appeared." },
          canonical: {
            type: "string",
            description: "Resolved canonical name; prefer a name from the known list when it matches.",
          },
          is_self: { type: "boolean", description: "True only for the monitored brand." },
          position: { type: "integer", description: "Order of first appearance, 1 = first named." },
        },
      },
    },
  },
};

const SYSTEM_PROMPT =
  "You extract structured data from an AI assistant's answer. List every distinct " +
  "brand, product, or company named, in order of first appearance (position 1 = " +
  "first). Resolve each to a single canonical name — map variants like 'Peec', " +
  "'Peec AI' and 'peec.ai' to one name, preferring a name from the known-competitors " +
  "list when it matches. Mark exactly the monitored brand (by its name or domain) " +
  "with is_self=true. Do not invent brands that are not in the text.";

export async function extractBrands(input: {
  answerText: string;
  brandName: string;
  brandDomain: string;
  knownCompetitors: string[];
}): Promise<ExtractedBrand[]> {
  const content =
    `Monitored brand: ${input.brandName} (${input.brandDomain})\n` +
    `Known competitors: ${
      input.knownCompetitors.length ? input.knownCompetitors.join(", ") : "(none yet)"
    }\n\n` +
    `Answer to analyze:\n${input.answerText}`;

  const { data } = await runStructured(registry.extraction, {
    system: SYSTEM_PROMPT,
    input: content,
    schemaName: "brand_extraction",
    schema: SCHEMA,
  });
  return parseBrands(data);
}

function parseBrands(data: unknown): ExtractedBrand[] {
  const rec = (data ?? {}) as Record<string, unknown>;
  if (!Array.isArray(rec.brands)) return [];
  return rec.brands
    .map((b) => {
      const br = (b ?? {}) as Record<string, unknown>;
      const raw = typeof br.raw === "string" ? br.raw.trim() : "";
      const canonical = typeof br.canonical === "string" ? br.canonical.trim() : raw;
      const position = typeof br.position === "number" ? br.position : 0;
      return { raw, canonical, isSelf: br.is_self === true, position };
    })
    .filter((b) => b.canonical.length > 0);
}
