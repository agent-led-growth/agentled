import "server-only";

import { MAX_PROMPT_TEXT_LEN } from "@/lib/ai-search";
import { MAX_LIMIT } from "@/lib/api/pagination";
import { serializeAnswer, serializeBrand, serializePrompt, serializeScan } from "@/lib/api/serialize";
import {
  addPromptForUser,
  createBrandForUser,
  getBrandForUser,
  getMetricsForBrand,
  getScanForUser,
  listAnswersForPrompt,
  listBrandsForUser,
  listPromptsForBrand,
  listScansForBrand,
  planSummary,
  resolveCities,
  setBrandLocationForUser,
  updatePromptForUser,
  type ServiceResult,
} from "@/lib/api/services";
import { env } from "@/lib/env";
import { COUNTRIES } from "@/lib/geo/countries";

/**
 * The MCP tool surface. Every tool is a thin adapter over the shared services in
 * `@/lib/api/services` — the SAME functions the `/api/v1` routes call — so MCP and
 * REST can't drift. Handlers just parse args, call a service, map a failure to a
 * ToolError, and serialize the result.
 */

/** A domain failure surfaced to the agent as an `isError` tool result. Mirrors `respond.ts`. */
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

/** Unwrap a service result, turning a failure into a ToolError (with an upgrade
 * hint for limit errors, matching the REST `upgradeUrl`). */
function unwrap<T>(result: ServiceResult<T>): T {
  if (result.ok) return result.data;
  const { code, message } = result.error;
  throw new ToolError(
    code,
    code === "limit_reached" ? `${message} Upgrade at ${env.siteUrl()}/ai-search/pricing` : message,
  );
}

type Args = Record<string, unknown>;
const asString = (v: unknown): string => (typeof v === "string" ? v : "");

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
    handler: (userId) => planSummary(userId),
  },
  {
    name: "list_brands",
    description: "List the account's brands, newest first.",
    inputSchema: { type: "object", properties: { ...paginationProps } },
    handler: async (userId, args) => {
      const { items, pagination } = await listBrandsForUser(userId, { limit: args.limit, offset: args.offset });
      return { brands: items.map(serializeBrand), pagination };
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
      const { brand } = unwrap(await createBrandForUser(userId, { website: args.website, about: args.about }));
      return { brand: serializeBrand(brand) };
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
      const { brand } = unwrap(await getBrandForUser(userId, asString(args.brandId)));
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
      const { brand } = unwrap(
        await setBrandLocationForUser(userId, asString(args.brandId), {
          mode: asString(args.mode) || null,
          country: asString(args.country) || null,
          city: asString(args.city) || null,
        }),
      );
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
      let active: boolean | undefined;
      if (args.active !== undefined) {
        if (typeof args.active !== "boolean") return badRequest("active must be a boolean.");
        active = args.active;
      }
      const { items, pagination } = unwrap(
        await listPromptsForBrand(userId, asString(args.brandId), { active, limit: args.limit, offset: args.offset }),
      );
      return { prompts: items.map(serializePrompt), pagination };
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
      const { prompt, usage } = unwrap(await addPromptForUser(userId, asString(args.brandId), args.text));
      return { prompt: serializePrompt(prompt), usage };
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
      const { prompt } = unwrap(
        await updatePromptForUser(userId, asString(args.brandId), asString(args.promptId), {
          text: args.text,
          active: args.active,
        }),
      );
      return { prompt: serializePrompt(prompt) };
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
      const { items, pagination } = unwrap(
        await listAnswersForPrompt(userId, asString(args.brandId), asString(args.promptId), {
          limit: args.limit,
          offset: args.offset,
        }),
      );
      return { answers: items.map(serializeAnswer), pagination };
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
    handler: (userId, args) =>
      getMetricsForBrand(userId, asString(args.brandId), args.days).then(unwrap),
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
      const { items, pagination } = unwrap(
        await listScansForBrand(userId, asString(args.brandId), { limit: args.limit, offset: args.offset }),
      );
      return { scans: items.map(serializeScan), pagination };
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
      const { scan } = unwrap(await getScanForUser(userId, asString(args.runId)));
      return { scan: serializeScan(scan) };
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
    handler: async (_userId, args) => unwrap(resolveCities(args.country)),
  },
];

export const TOOLS_BY_NAME: Map<string, McpTool> = new Map(TOOLS.map((t) => [t.name, t]));
