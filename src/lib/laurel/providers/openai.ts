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

  const MAX_ATTEMPTS = 3;
  let lastErr: unknown = new Error("OpenAI Responses failed");
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await attemptStructured(body);
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_ATTEMPTS && isTransientResponsesError(err)) {
        await sleepMs(attempt * 1500);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function attemptStructured(
  body: Record<string, unknown>,
): Promise<StructuredResponse> {
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
    const e = new Error(`OpenAI Responses ${res.status}: ${msg}`) as Error & {
      status?: number;
    };
    e.status = res.status;
    throw e;
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

function sleepMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 5xx, 429, and network/timeout errors are worth retrying; 4xx are not. */
function isTransientResponsesError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === "TimeoutError" || err.name === "AbortError") return true;
  const status = (err as { status?: number }).status;
  if (typeof status === "number") return status >= 500 || status === 429;
  return err.name === "TypeError" || /fetch failed|network/i.test(err.message);
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
