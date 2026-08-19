import "server-only";

import { runStructured } from "./providers";
import { registry } from "./registry";
import type { NewPrompt } from "./types";

/**
 * Prompt generation (pipeline step 5). Expands each selected topic into three
 * concrete questions a real buyer would ask an AI assistant in that space — the
 * questions where we'll check whether the brand gets recommended. Shares the
 * generation role with enrichment. Persistence is the caller's job (insertPrompts).
 */

const PROMPTS_PER_TOPIC = 3;

const SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["groups"],
  properties: {
    groups: {
      type: "array",
      description: "One entry per input topic, in the same order given.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["topic", "prompts"],
        properties: {
          topic: { type: "string", description: "The topic label, echoed back verbatim." },
          prompts: {
            type: "array",
            description: "Exactly 3 natural questions a potential customer would ask.",
            items: { type: "string" },
          },
        },
      },
    },
  },
};

const SYSTEM_PROMPT =
  "You generate the search prompts Laurel runs against AI assistants to measure a " +
  "brand's visibility. For each topic, write exactly 3 concrete questions a real " +
  "potential customer would type into ChatGPT in that space — the kind where this " +
  "brand could plausibly be recommended. Vary the intent across the three (finding " +
  "options, comparing choices, asking what to pick). Do NOT name the brand in the " +
  "questions — we're testing whether the assistant brings it up unprompted. Keep " +
  "them natural and specific to the topic, not generic filler.";

/** Generate ~3 prompts per selected topic, mapped back to their topic ids. */
export async function generatePrompts(
  brand: {
    name: string | null;
    description: string | null;
    domain: string;
    /** Human location label (e.g. "Berlin, Germany"); null/absent = worldwide. */
    locationLabel?: string | null;
  },
  topics: { id: string; label: string }[],
): Promise<NewPrompt[]> {
  if (topics.length === 0) return [];

  const input =
    `Brand: ${brand.name ?? brand.domain}\n` +
    (brand.description ? `About: ${brand.description}\n` : "") +
    // Market bias: only when the brand is scoped to a place. Worldwide stays neutral.
    (brand.locationLabel
      ? `\nMarket focus: write every question as a potential customer located in ` +
        `${brand.locationLabel} would type it — use local phrasing and place names ` +
        `where natural, but don't force the location into a question if it wouldn't ` +
        `sound natural.\n`
      : "") +
    `\nTopics (write 3 prompts for each):\n` +
    topics.map((t, i) => `${i + 1}. ${t.label}`).join("\n");

  const { data } = await runStructured(registry.enrichment, {
    system: SYSTEM_PROMPT,
    input,
    schemaName: "prompt_generation",
    schema: SCHEMA,
  });

  const groups = parseGroups(data);
  const out: NewPrompt[] = [];
  topics.forEach((topic, i) => {
    // Match by label; fall back to positional order if the model reworded it.
    const group =
      groups.find(
        (g) => g.topic.trim().toLowerCase() === topic.label.trim().toLowerCase(),
      ) ?? groups[i];
    for (const text of (group?.prompts ?? []).slice(0, PROMPTS_PER_TOPIC)) {
      const clean = text.trim();
      if (clean) out.push({ topicId: topic.id, text: clean });
    }
  });
  return out;
}

function parseGroups(data: unknown): { topic: string; prompts: string[] }[] {
  const rec = (data ?? {}) as Record<string, unknown>;
  if (!Array.isArray(rec.groups)) return [];
  return rec.groups.map((g) => {
    const gr = (g ?? {}) as Record<string, unknown>;
    return {
      topic: typeof gr.topic === "string" ? gr.topic : "",
      prompts: Array.isArray(gr.prompts)
        ? gr.prompts.filter((p): p is string => typeof p === "string")
        : [],
    };
  });
}
