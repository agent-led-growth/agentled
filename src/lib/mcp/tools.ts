import "server-only";

import {
  assertBrandMember,
  countActivePrompts,
  createActiveBrandForUser,
  createPrompt,
  enrichBrand,
  getBrandById,
  getBrandForMember,
  getBrandMetrics,
  getBrandsForUserId,
  getMemberBrandByDomain,
  getPlanForUserId,
  getPromptAnswers,
  getPromptForBrand,
  getRunById,
  isValidWebsite,
  listPrompts,
  listRunsForBrand,
  MAX_PROMPT_TEXT_LEN,
  setPromptActive,
  updateBrandEnrichment,
  updateBrandLocation,
  updatePromptText,
} from "@/lib/ai-search";
import { DEFAULT_LIMIT, MAX_LIMIT, pageResult } from "@/lib/api/pagination";
import { isUuid } from "@/lib/api/route";
import { serializeAnswer, serializeBrand, serializePrompt, serializeScan } from "@/lib/api/serialize";
import { promptUsage } from "@/lib/api/usage";
import { env } from "@/lib/env";
import { citiesForCountry } from "@/lib/geo/cities";
import { COUNTRIES, countryName, isValidCountry } from "@/lib/geo/countries";
import { normalizeBrandLocation, type LocationInput } from "@/lib/geo/location";
import { brandLimit, planFeatures } from "@/lib/plan";

/**
 * The MCP tool surface. Each tool is a thin wrapper over the SAME `ai-search` lib
 * functions the `/api/v1` route handlers call, replicating their guard order
 * (isUuid → assertBrandMember → plan-limit check) and their `serialize*` output so
 * the MCP tools and the REST API stay in lockstep. Keep any change here mirrored
 * with the corresponding `src/app/api/v1/**` route.
 */

/** A domain-level failure (bad input / not found / limit) surfaced to the agent as
 * an `isError` tool result, not a JSON-RPC protocol error. Mirrors `respond.ts`. */
export class ToolError extends Error {
  constructor(
    public readonly code: "bad_request" | "not_found" | "limit_reached",
    message: string,
  ) {
    super(message);
    this.name = "ToolError";
  }
}

const badRequest = (message: string): never => {
  throw new ToolError("bad_request", message);
};
const notFound = (what = "Resource"): never => {
  throw new ToolError("not_found", `${what} not found.`);
};
const limitReached = (message: string): never => {
  throw new ToolError("limit_reached", `${message} Upgrade at ${env.siteUrl()}/ai-search/pricing`);
};

// ── arg + pagination helpers (args arrive as parsed JSON) ──
type Args = Record<string, unknown>;
const asString = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

function clampLimit(v: unknown, def: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return v != null && Number.isFinite(n) ? Math.min(Math.max(Math.trunc(n), 1), MAX_LIMIT) : def;
}
function clampOffset(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return v != null && Number.isFinite(n) ? Math.max(Math.trunc(n), 0) : 0;
}

/** A brand id that must be a UUID this account belongs to; else `not_found`. */
function requireUuid(v: unknown, what: string): string {
  const id = asString(v) ?? "";
  if (!isUuid(id)) return notFound(what);
  return id;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (userId: string, args: Args) => Promise<unknown>;
}

const paginationProps = {
  limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT, description: "Page size (1–200)." },
  offset: { type: "integer", minimum: 0, description: "Rows to skip (0+)." },
};

export const TOOLS: McpTool[] = [
  {
    name: "get_plan",
    description: "Get the account's plan and its limits (max brands, max active prompts, scan frequency, models).",
    inputSchema: { type: "object", properties: {} },
    handler: async (userId) => {
      const plan = await getPlanForUserId(userId);
      return { plan, features: planFeatures(plan) };
    },
  },
  {
    name: "list_brands",
    description: "List the account's brands, newest first.",
    inputSchema: { type: "object", properties: { ...paginationProps } },
    handler: async (userId, args) => {
      const limit = clampLimit(args.limit, DEFAULT_LIMIT);
      const offset = clampOffset(args.offset);
      const rows = await getBrandsForUserId(userId, limit + 1, offset);
      const { items, hasMore } = pageResult(rows, limit);
      return { brands: items.map(serializeBrand), pagination: { limit, offset, hasMore } };
    },
  },
  {
    name: "create_brand",
    description:
      "Create a brand from a website (name/description/logo are enriched automatically). Idempotent per account+domain: re-posting an existing domain returns it unchanged. No prompts are created — add them with add_prompt, and a brand with no active prompts is never scanned.",
    inputSchema: {
      type: "object",
      properties: {
        website: { type: "string", description: "The brand's website/domain, e.g. example.com." },
        about: { type: "string", description: "Optional context to improve enrichment." },
      },
      required: ["website"],
    },
    handler: async (userId, args) => {
      const website =
        typeof args.website === "string" && args.website.trim()
          ? args.website.trim().slice(0, 2048)
          : "";
      if (!website) return badRequest("website is required.");
      if (!isValidWebsite(website))
        return badRequest("website must be a valid domain, like example.com.");
      const about =
        typeof args.about === "string" && args.about.trim()
          ? args.about.trim().slice(0, 5000)
          : undefined;

      const existing = await getMemberBrandByDomain(userId, website);
      if (existing) return { brand: serializeBrand(existing) };

      const [count, plan] = await Promise.all([
        getBrandsForUserId(userId).then((b) => b.length),
        getPlanForUserId(userId),
      ]);
      const limit = brandLimit(plan);
      if (count >= limit)
        return limitReached(
          `You've reached your plan's brand limit (${count}/${limit}). Upgrade to add more brands.`,
        );

      const brand = await createActiveBrandForUser(website, userId);
      try {
        const e = await enrichBrand(brand.domain, about);
        await updateBrandEnrichment(brand.id, {
          name: e.name,
          description: e.description,
          logoUrl: e.logoUrl,
        });
      } catch (err) {
        console.error("mcp create_brand: enrichment failed", err);
      }
      const fresh = (await getBrandById(brand.id)) ?? brand;
      return { brand: serializeBrand(fresh) };
    },
  },
  {
    name: "get_brand",
    description: "Get one brand the account belongs to.",
    inputSchema: {
      type: "object",
      properties: { brandId: { type: "string", description: "Brand UUID." } },
      required: ["brandId"],
    },
    handler: async (userId, args) => {
      const id = requireUuid(args.brandId, "Brand");
      const brand = await getBrandForMember(userId, id);
      if (!brand) return notFound("Brand");
      return { brand: serializeBrand(brand) };
    },
  },
  {
    name: "set_brand_location",
    description:
      "Set the market a brand's AI answers are measured from. mode is 'worldwide' (clears scope), 'country' (needs country), or 'city' (needs country+city). Use list_countries/list_cities for valid values.",
    inputSchema: {
      type: "object",
      properties: {
        brandId: { type: "string", description: "Brand UUID." },
        mode: { type: "string", enum: ["worldwide", "country", "city"] },
        country: { type: "string", description: "ISO 3166-1 alpha-2 (case-insensitive), for country/city." },
        city: { type: "string", description: "City name, for city mode." },
      },
      required: ["brandId", "mode"],
    },
    handler: async (userId, args) => {
      const id = requireUuid(args.brandId, "Brand");
      if (!(await assertBrandMember(userId, id))) return notFound("Brand");

      const mode = asString(args.mode);
      if (mode !== "worldwide" && mode !== "country" && mode !== "city")
        return badRequest("mode is required: 'worldwide', 'country', or 'city'.");
      const input: LocationInput = {
        mode,
        country: asString(args.country) ?? null,
        city: asString(args.city) ?? null,
      };
      const normalized = normalizeBrandLocation(input);
      if ((mode === "country" || mode === "city") && normalized.mode === "worldwide")
        return badRequest("country is not a valid ISO 3166-1 alpha-2 code.");
      if (mode === "city" && normalized.mode === "country")
        return badRequest("city is not a recognized city for that country.");

      await updateBrandLocation(id, input);
      const brand = await getBrandForMember(userId, id);
      return { brand: brand ? serializeBrand(brand) : null };
    },
  },
  {
    name: "list_prompts",
    description:
      "List a brand's prompts (active and disabled by default; filter with active). Disabling is a soft delete kept for history.",
    inputSchema: {
      type: "object",
      properties: {
        brandId: { type: "string", description: "Brand UUID." },
        active: { type: "boolean", description: "Filter by state; omit for both." },
        ...paginationProps,
      },
      required: ["brandId"],
    },
    handler: async (userId, args) => {
      const id = requireUuid(args.brandId, "Brand");
      if (!(await assertBrandMember(userId, id))) return notFound("Brand");
      const active = typeof args.active === "boolean" ? args.active : undefined;
      const limit = clampLimit(args.limit, DEFAULT_LIMIT);
      const offset = clampOffset(args.offset);
      const rows = await listPrompts(id, { active, limit: limit + 1, offset });
      const { items, hasMore } = pageResult(rows, limit);
      return { prompts: items.map(serializePrompt), pagination: { limit, offset, hasMore } };
    },
  },
  {
    name: "add_prompt",
    description:
      "Add an active prompt (question asked about the brand each scan). Counts against the account-wide prompt limit.",
    inputSchema: {
      type: "object",
      properties: {
        brandId: { type: "string", description: "Brand UUID." },
        text: { type: "string", description: `The question (max ${MAX_PROMPT_TEXT_LEN} chars).` },
      },
      required: ["brandId", "text"],
    },
    handler: async (userId, args) => {
      const id = requireUuid(args.brandId, "Brand");
      if (!(await assertBrandMember(userId, id))) return notFound("Brand");
      const text = typeof args.text === "string" ? args.text.trim() : "";
      if (!text) return badRequest("text is required.");
      if (text.length > MAX_PROMPT_TEXT_LEN)
        return badRequest(`text must be at most ${MAX_PROMPT_TEXT_LEN} characters.`);

      const { used, limit, brandIds } = await promptUsage(userId);
      if (used >= limit)
        return limitReached(
          `You've reached your plan's prompt limit (${used}/${limit}). Upgrade to add more.`,
        );
      const prompt = await createPrompt(id, text);
      const after = brandIds.length ? await countActivePrompts(brandIds) : 0;
      if (after > limit) {
        await setPromptActive(prompt.id, false);
        return limitReached(
          `You've reached your plan's prompt limit (${limit}/${limit}). Upgrade to add more.`,
        );
      }
      return { prompt: serializePrompt(prompt), usage: { used: after, limit } };
    },
  },
  {
    name: "update_prompt",
    description:
      "Edit a prompt's text and/or enable/disable it (provide text, active, or both). Prompts are never hard-deleted: active:false disables, active:true re-enables (and counts against the limit).",
    inputSchema: {
      type: "object",
      properties: {
        brandId: { type: "string", description: "Brand UUID." },
        promptId: { type: "string", description: "Prompt UUID." },
        text: { type: "string", description: `New text (max ${MAX_PROMPT_TEXT_LEN} chars).` },
        active: { type: "boolean", description: "false disables, true re-enables." },
      },
      required: ["brandId", "promptId"],
    },
    handler: async (userId, args) => {
      const id = requireUuid(args.brandId, "Prompt");
      const promptId = requireUuid(args.promptId, "Prompt");
      if (!(await assertBrandMember(userId, id))) return notFound("Prompt");
      const prompt = await getPromptForBrand(promptId, id);
      if (!prompt) return notFound("Prompt");

      const hasText = args.text !== undefined;
      const hasActive = args.active !== undefined;
      if (!hasText && !hasActive) return badRequest("Provide 'text' and/or 'active'.");

      let newText: string | undefined;
      if (hasText) {
        const t = typeof args.text === "string" ? args.text.trim() : "";
        if (!t) return badRequest("text must be a non-empty string.");
        if (t.length > MAX_PROMPT_TEXT_LEN)
          return badRequest(`text must be at most ${MAX_PROMPT_TEXT_LEN} characters.`);
        newText = t;
      }
      let newActive: boolean | undefined;
      if (hasActive) {
        if (typeof args.active !== "boolean") return badRequest("active must be a boolean.");
        newActive = args.active;
        if (newActive && !prompt.active) {
          const { used, limit } = await promptUsage(userId);
          if (used >= limit)
            return limitReached(
              `You've reached your plan's prompt limit (${used}/${limit}). Upgrade to add more.`,
            );
        }
      }

      if (newText !== undefined) await updatePromptText(promptId, newText);
      if (newActive !== undefined) await setPromptActive(promptId, newActive);
      const result = {
        ...prompt,
        text: newText ?? prompt.text,
        active: newActive ?? prompt.active,
        updated_at: new Date().toISOString(),
      };
      return { prompt: serializePrompt(result) };
    },
  },
  {
    name: "list_answers",
    description:
      "List the answer a prompt received in each completed scan, newest first, with brands named and domains cited. Pages over runs, so a page can hold fewer than limit answers.",
    inputSchema: {
      type: "object",
      properties: {
        brandId: { type: "string", description: "Brand UUID." },
        promptId: { type: "string", description: "Prompt UUID." },
        ...paginationProps,
      },
      required: ["brandId", "promptId"],
    },
    handler: async (userId, args) => {
      const id = requireUuid(args.brandId, "Prompt");
      const promptId = requireUuid(args.promptId, "Prompt");
      if (!(await assertBrandMember(userId, id))) return notFound("Prompt");
      if (!(await getPromptForBrand(promptId, id))) return notFound("Prompt");
      const limit = clampLimit(args.limit, DEFAULT_LIMIT);
      const offset = clampOffset(args.offset);
      const rows = await getPromptAnswers(id, promptId, limit + 1, offset);
      const { items, hasMore } = pageResult(rows, limit);
      return { answers: items.map(serializeAnswer), pagination: { limit, offset, hasMore } };
    },
  },
  {
    name: "get_metrics",
    description:
      "Get a brand's AI-visibility metrics over a trailing window (days, default 30, 1–365): visibility, leaderboard, citation share, per-prompt detail, trend.",
    inputSchema: {
      type: "object",
      properties: {
        brandId: { type: "string", description: "Brand UUID." },
        days: { type: "integer", minimum: 1, maximum: 365, description: "Trailing window; default 30." },
      },
      required: ["brandId"],
    },
    handler: async (userId, args) => {
      const id = requireUuid(args.brandId, "Brand");
      if (!(await assertBrandMember(userId, id))) return notFound("Brand");
      const n = typeof args.days === "number" ? args.days : Number(args.days);
      const days =
        args.days != null && Number.isFinite(n) ? Math.min(Math.max(Math.trunc(n), 1), 365) : 30;
      const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const metrics = await getBrandMetrics(id, sinceIso);
      return { days, metrics };
    },
  },
  {
    name: "list_scans",
    description: "List a brand's scan runs, newest first.",
    inputSchema: {
      type: "object",
      properties: { brandId: { type: "string", description: "Brand UUID." }, ...paginationProps },
      required: ["brandId"],
    },
    handler: async (userId, args) => {
      const id = requireUuid(args.brandId, "Brand");
      if (!(await assertBrandMember(userId, id))) return notFound("Brand");
      const limit = clampLimit(args.limit, 90);
      const offset = clampOffset(args.offset);
      const rows = await listRunsForBrand(id, limit + 1, offset);
      const { items, hasMore } = pageResult(rows, limit);
      return { scans: items.map(serializeScan), pagination: { limit, offset, hasMore } };
    },
  },
  {
    name: "get_scan",
    description: "Get one scan run the account owns.",
    inputSchema: {
      type: "object",
      properties: { runId: { type: "string", description: "Scan run UUID." } },
      required: ["runId"],
    },
    handler: async (userId, args) => {
      const runId = requireUuid(args.runId, "Scan");
      const run = await getRunById(runId);
      if (!run || !(await assertBrandMember(userId, run.brand_id))) return notFound("Scan");
      return { scan: serializeScan(run) };
    },
  },
  {
    name: "list_countries",
    description: "List every country a brand can be scoped to (code is the value for set_brand_location).",
    inputSchema: { type: "object", properties: {} },
    handler: async () => ({ countries: COUNTRIES }),
  },
  {
    name: "list_cities",
    description:
      "List the cities that can be used as location.city for a country (major cities). Empty means only country-level scope.",
    inputSchema: {
      type: "object",
      properties: {
        country: { type: "string", description: "ISO 3166-1 alpha-2 (case-insensitive)." },
      },
      required: ["country"],
    },
    handler: async (_userId, args) => {
      const code = (asString(args.country) ?? "").toUpperCase();
      if (!isValidCountry(code)) return notFound("Country");
      return { country: { code, name: countryName(code) ?? code }, cities: citiesForCountry(code) };
    },
  },
];

export const TOOLS_BY_NAME: Map<string, McpTool> = new Map(TOOLS.map((t) => [t.name, t]));
