import "server-only";

import { env } from "@/lib/env";

import type { ModelConfig } from "../registry";
import type { StructuredRequest, StructuredResponse } from "./types";

/**
 * OpenAI Responses API adapter for structured-output calls. Raw `fetch` (no
 * SDK) — zero deps, guaranteed workerd-safe, full control of the request shape.
 * If the exact Responses request/response shape drifts for a given model, this
 * is the one file to adjust.
 */

const RESPONSES_URL = "https://api.openai.com/v1/responses";
const TIMEOUT_MS = 20_000;

export async function openaiGenerateStructured(
  config: ModelConfig,
  req: StructuredRequest,
): Promise<StructuredResponse> {
  const body: Record<string, unknown> = {
    model: config.model,
    input: req.input,
    text: {
      format: {
        type: "json_schema",
        name: req.schemaName,
        strict: true,
        schema: req.schema,
      },
    },
  };
  if (req.system) body.instructions = req.system;
  if (config.reasoningEffort) body.reasoning = { effort: config.reasoningEffort };
  if (config.maxOutputTokens) body.max_output_tokens = config.maxOutputTokens;
  if (config.temperature !== undefined) body.temperature = config.temperature;

  const res = await fetch(RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openaiApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const errRec = asRecord(raw.error);
    const msg =
      errRec && typeof errRec.message === "string" ? errRec.message : res.statusText;
    throw new Error(`OpenAI Responses ${res.status}: ${msg}`);
  }

  const text = extractOutputText(raw);
  if (!text) throw new Error("OpenAI Responses: no output_text in response");

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("OpenAI Responses: output_text was not valid JSON");
  }
  return { data, raw };
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

/**
 * Pull the model's text out of a Responses payload. Prefers the aggregated
 * `output_text` convenience field; otherwise walks `output[]` for the message
 * item's `output_text` content (reasoning items are skipped).
 */
function extractOutputText(raw: Record<string, unknown>): string | null {
  if (typeof raw.output_text === "string" && raw.output_text) return raw.output_text;

  const output = raw.output;
  if (!Array.isArray(output)) return null;
  for (const item of output) {
    const rec = asRecord(item);
    if (rec?.type !== "message") continue;
    const content = rec.content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      const crec = asRecord(c);
      if (crec?.type === "output_text" && typeof crec.text === "string") {
        return crec.text;
      }
    }
  }
  return null;
}
