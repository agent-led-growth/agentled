import "server-only";

import { env } from "@/lib/env";

import { normalizeDomain } from "./domain";
import { registry } from "./registry";

/**
 * The scan call (pipeline step 6) — the measurement itself. Ask one prompt with
 * live web search, exactly as a user would, and record the natural answer plus
 * its cited sources. OpenAI-locked (the platform being measured), and NO system
 * prompt / no JSON steering — anything that shapes the answer corrupts the data.
 * This is why it lives outside the structured-output adapter.
 */

const RESPONSES_URL = "https://api.openai.com/v1/responses";
const TIMEOUT_MS = 45_000; // web search is slow, but cap it so one stuck prompt
// (× MAX_ATTEMPTS) can't drag the whole run past the consumer's window.

export interface ScanCitation {
  url: string;
  title: string | null;
}

export interface ScanResult {
  answerText: string;
  /** From the response's url_citation annotations. */
  citations: ScanCitation[];
  model: string;
  raw: unknown;
}

const MAX_ATTEMPTS = 2; // 1 attempt + 1 retry

export async function runWebSearch(prompt: string): Promise<ScanResult> {
  let lastErr: unknown = new Error("OpenAI web_search failed");
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await attemptWebSearch(prompt);
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_ATTEMPTS && isTransient(err)) {
        await sleep(attempt * 1500); // OpenAI's web_search edge 5xx/429s are often transient
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function attemptWebSearch(prompt: string): Promise<ScanResult> {
  const config = registry.scan;
  const body: Record<string, unknown> = {
    model: config.model,
    input: prompt,
    tools: [{ type: "web_search" }],
  };
  if (config.reasoningEffort) body.reasoning = { effort: config.reasoningEffort };
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
    const err = asRecord(raw.error);
    const msg = err && typeof err.message === "string" ? err.message : res.statusText;
    const e = new Error(`OpenAI web_search ${res.status}: ${msg}`) as Error & { status?: number };
    e.status = res.status;
    throw e;
  }

  const answerText = extractAnswerText(raw);
  if (!answerText) throw new Error("OpenAI web_search: empty answer");
  return { answerText, citations: extractAnnotationCitations(raw), model: config.model, raw };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 5xx, 429, and network/timeout errors are worth retrying; 4xx are not. */
function isTransient(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === "TimeoutError" || err.name === "AbortError") return true;
  const status = (err as { status?: number }).status;
  if (typeof status === "number") return status >= 500 || status === 429;
  return err.name === "TypeError" || /fetch failed|network/i.test(err.message);
}

/** A citation ready to persist: normalized host + own-domain flag + order. */
export interface CollectedCitation {
  url: string;
  domain: string;
  title: string | null;
  isOwnDomain: boolean;
  position: number;
}

/**
 * Merge the structured url_citation annotations with any inline-cited URLs in
 * the answer text (annotations are occasionally incomplete), dedupe by URL, and
 * flag own-domain via normalized host comparison.
 */
export function collectCitations(
  answerText: string,
  annotations: ScanCitation[],
  ownDomain: string,
): CollectedCitation[] {
  const own = normalizeDomain(ownDomain);
  const seen = new Set<string>();
  const out: CollectedCitation[] = [];

  const add = (url: string, title: string | null) => {
    const clean = url.trim().replace(/[).,]+$/, "");
    if (!/^https?:\/\//i.test(clean) || seen.has(clean)) return;
    seen.add(clean);
    const domain = normalizeDomain(clean);
    out.push({
      url: clean,
      domain,
      title,
      isOwnDomain: domain === own,
      position: out.length + 1,
    });
  };

  for (const c of annotations) add(c.url, c.title);
  for (const url of answerText.match(/https?:\/\/[^\s)\]]+/gi) ?? []) add(url, null);
  return out;
}

function extractAnswerText(raw: Record<string, unknown>): string {
  if (typeof raw.output_text === "string" && raw.output_text.trim()) {
    return raw.output_text.trim();
  }
  const parts: string[] = [];
  for (const item of asArray(raw.output)) {
    const rec = asRecord(item);
    if (rec?.type !== "message") continue;
    for (const c of asArray(rec.content)) {
      const cr = asRecord(c);
      if (cr?.type === "output_text" && typeof cr.text === "string") parts.push(cr.text);
    }
  }
  return parts.join("\n").trim();
}

function extractAnnotationCitations(raw: Record<string, unknown>): ScanCitation[] {
  const out: ScanCitation[] = [];
  for (const item of asArray(raw.output)) {
    const rec = asRecord(item);
    if (rec?.type !== "message") continue;
    for (const c of asArray(rec.content)) {
      const cr = asRecord(c);
      for (const a of asArray(cr?.annotations)) {
        const ar = asRecord(a);
        if (ar?.type === "url_citation" && typeof ar.url === "string") {
          out.push({ url: ar.url, title: typeof ar.title === "string" ? ar.title : null });
        }
      }
    }
  }
  return out;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}
function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
