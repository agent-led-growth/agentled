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
  type Brand,
  type BrandMetrics,
  type Prompt,
  type PromptAnswer,
  type ScanRun,
} from "@/lib/ai-search";
import { clampLimit, clampOffset, pageResult } from "@/lib/api/pagination";
import { isUuid } from "@/lib/api/route";
import { promptUsage } from "@/lib/api/usage";
import { citiesForCountry } from "@/lib/geo/cities";
import { COUNTRIES, countryName, isValidCountry } from "@/lib/geo/countries";
import { normalizeBrandLocation, type LocationInput } from "@/lib/geo/location";
import { brandLimit, planFeatures, type PlanFeatures } from "@/lib/plan";

/**
 * Account-scoped operations for brands, prompts and scan data — the SINGLE source
 * of truth shared by the REST routes (`src/app/api/v1/**`) and the MCP tools
 * (`src/lib/mcp/tools.ts`), so the two surfaces can't drift. Each does its own
 * validation, membership + plan checks, pagination and (for reads) fetch, then
 * returns a `ServiceResult` (or plain value when it can't fail with a domain
 * error). Callers map the result to their own error shape (HTTP status vs
 * JSON-RPC tool error) and serialize the returned domain objects themselves.
 */

export type ServiceErrorCode = "bad_request" | "not_found" | "limit_reached";
export type ServiceError = { code: ServiceErrorCode; message: string };
export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: ServiceError };

/** A page of raw domain rows plus the pagination envelope the API returns. */
export type Page<T> = { items: T[]; pagination: { limit: number; offset: number; hasMore: boolean } };

/** Raw (unclamped) pagination inputs — a query string or a JSON number. */
export type PageInput = { limit?: unknown; offset?: unknown };

const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const fail = (code: ServiceErrorCode, message: string): ServiceResult<never> => ({
  ok: false,
  error: { code, message },
});

/** Fetch one extra row (limit + 1) and split into a page + hasMore. */
function page<T>(rows: T[], limit: number, offset: number): Page<T> {
  const { items, hasMore } = pageResult(rows, limit);
  return { items, pagination: { limit, offset, hasMore } };
}

// ─────────────────────────────── Writes ───────────────────────────────

/**
 * Create a brand from a website and enrich it. Idempotent per account+domain:
 * `created:false` means the account already had it (returned unchanged, no
 * enrichment, no limit charge). Enforces the plan's brand limit.
 */
export async function createBrandForUser(
  userId: string,
  input: { website?: unknown; about?: unknown },
): Promise<ServiceResult<{ brand: Brand; created: boolean }>> {
  const website =
    typeof input.website === "string" && input.website.trim()
      ? input.website.trim().slice(0, 2048)
      : "";
  if (!website) return fail("bad_request", "website is required.");
  if (!isValidWebsite(website))
    return fail("bad_request", "website must be a valid domain, like example.com.");
  const about =
    typeof input.about === "string" && input.about.trim()
      ? input.about.trim().slice(0, 5000)
      : undefined;

  const existing = await getMemberBrandByDomain(userId, website);
  if (existing) return ok({ brand: existing, created: false });

  const [count, plan] = await Promise.all([
    getBrandsForUserId(userId).then((b) => b.length),
    getPlanForUserId(userId),
  ]);
  const limit = brandLimit(plan);
  if (count >= limit)
    return fail(
      "limit_reached",
      `You've reached your plan's brand limit (${count}/${limit}). Upgrade to add more brands.`,
    );

  const brand = await createActiveBrandForUser(website, userId);
  // Enrichment is best-effort: a failure leaves a domain-only brand.
  try {
    const e = await enrichBrand(brand.domain, about);
    await updateBrandEnrichment(brand.id, {
      name: e.name,
      description: e.description,
      logoUrl: e.logoUrl,
    });
  } catch (err) {
    console.error("createBrandForUser: enrichment failed", err);
  }
  const fresh = (await getBrandById(brand.id)) ?? brand;
  return ok({ brand: fresh, created: true });
}

/** Update a brand's measurement location. `location` is the raw, untrusted value. */
export async function setBrandLocationForUser(
  userId: string,
  brandId: string,
  location: unknown,
): Promise<ServiceResult<{ brand: Brand | null }>> {
  if (!isUuid(brandId)) return fail("not_found", "Brand not found.");
  if (!(await assertBrandMember(userId, brandId))) return fail("not_found", "Brand not found.");

  if (location === undefined) return fail("bad_request", "Provide a location.");
  if (location === null || typeof location !== "object" || Array.isArray(location))
    return fail("bad_request", "location must be an object.");
  const input = location as LocationInput;
  const mode = input.mode ?? undefined;
  // Require an explicit mode so a partial object can't silently reset scope.
  if (mode !== "worldwide" && mode !== "country" && mode !== "city")
    return fail("bad_request", "mode is required: 'worldwide', 'country', or 'city'.");
  const normalized = normalizeBrandLocation(input);
  if ((mode === "country" || mode === "city") && normalized.mode === "worldwide")
    return fail("bad_request", "country is not a valid ISO 3166-1 alpha-2 code.");
  if (mode === "city" && normalized.mode === "country")
    return fail("bad_request", "city is not a recognized city for that country.");

  await updateBrandLocation(brandId, input);
  const brand = await getBrandForMember(userId, brandId);
  return ok({ brand });
}

/** Add an active prompt to a brand. Enforces the account-wide prompt limit. */
export async function addPromptForUser(
  userId: string,
  brandId: string,
  textInput: unknown,
): Promise<ServiceResult<{ prompt: Prompt; usage: { used: number; limit: number } }>> {
  if (!isUuid(brandId)) return fail("not_found", "Brand not found.");
  if (!(await assertBrandMember(userId, brandId))) return fail("not_found", "Brand not found.");

  const text = typeof textInput === "string" ? textInput.trim() : "";
  if (!text) return fail("bad_request", "text is required.");
  if (text.length > MAX_PROMPT_TEXT_LEN)
    return fail("bad_request", `text must be at most ${MAX_PROMPT_TEXT_LEN} characters.`);

  const { used, limit, brandIds } = await promptUsage(userId);
  if (used >= limit)
    return fail(
      "limit_reached",
      `You've reached your plan's prompt limit (${used}/${limit}). Upgrade to add more.`,
    );

  const prompt = await createPrompt(brandId, text);
  // Check + insert aren't atomic; re-count and soft-roll-back if a concurrent add went over.
  const after = brandIds.length ? await countActivePrompts(brandIds) : 0;
  if (after > limit) {
    await setPromptActive(prompt.id, false);
    return fail(
      "limit_reached",
      `You've reached your plan's prompt limit (${limit}/${limit}). Upgrade to add more.`,
    );
  }
  return ok({ prompt, usage: { used: after, limit } });
}

/** Edit a prompt's text and/or enable/disable it. Validates fully before any write. */
export async function updatePromptForUser(
  userId: string,
  brandId: string,
  promptId: string,
  patch: { text?: unknown; active?: unknown },
): Promise<ServiceResult<{ prompt: Prompt }>> {
  if (!isUuid(brandId) || !isUuid(promptId)) return fail("not_found", "Prompt not found.");
  if (!(await assertBrandMember(userId, brandId))) return fail("not_found", "Prompt not found.");
  const prompt = await getPromptForBrand(promptId, brandId);
  if (!prompt) return fail("not_found", "Prompt not found.");

  const hasText = patch.text !== undefined;
  const hasActive = patch.active !== undefined;
  if (!hasText && !hasActive) return fail("bad_request", "Provide 'text' and/or 'active'.");

  let newText: string | undefined;
  if (hasText) {
    const t = typeof patch.text === "string" ? patch.text.trim() : "";
    if (!t) return fail("bad_request", "text must be a non-empty string.");
    if (t.length > MAX_PROMPT_TEXT_LEN)
      return fail("bad_request", `text must be at most ${MAX_PROMPT_TEXT_LEN} characters.`);
    newText = t;
  }
  let newActive: boolean | undefined;
  if (hasActive) {
    if (typeof patch.active !== "boolean") return fail("bad_request", "active must be a boolean.");
    newActive = patch.active;
    // Enabling a disabled prompt consumes a slot — enforce the account cap.
    if (newActive && !prompt.active) {
      const { used, limit } = await promptUsage(userId);
      if (used >= limit)
        return fail(
          "limit_reached",
          `You've reached your plan's prompt limit (${used}/${limit}). Upgrade to add more.`,
        );
    }
  }

  if (newText !== undefined) await updatePromptText(promptId, newText);
  if (newActive !== undefined) await setPromptActive(promptId, newActive);
  const result: Prompt = {
    ...prompt,
    text: newText ?? prompt.text,
    active: newActive ?? prompt.active,
    updated_at: new Date().toISOString(),
  };
  return ok({ prompt: result });
}

// ─────────────────────────────── Reads ───────────────────────────────

/** The account's plan and the capability limits it grants. */
export async function planSummary(userId: string): Promise<{ plan: string; features: PlanFeatures }> {
  const plan = await getPlanForUserId(userId);
  return { plan, features: planFeatures(plan) };
}

/** The account's brands, newest first. */
export async function listBrandsForUser(userId: string, opts: PageInput): Promise<Page<Brand>> {
  const limit = clampLimit(opts.limit);
  const offset = clampOffset(opts.offset);
  const rows = await getBrandsForUserId(userId, limit + 1, offset);
  return page(rows, limit, offset);
}

/** One brand the account belongs to. */
export async function getBrandForUser(
  userId: string,
  brandId: string,
): Promise<ServiceResult<{ brand: Brand }>> {
  if (!isUuid(brandId)) return fail("not_found", "Brand not found.");
  const brand = await getBrandForMember(userId, brandId);
  if (!brand) return fail("not_found", "Brand not found.");
  return ok({ brand });
}

/**
 * A brand's prompts. `active` filters by state — accepts a boolean or the strings
 * "true"/"false" (so both the JSON MCP arg and the REST query string work), and
 * is parsed AFTER the membership check so an unknown brand is 404, not 400.
 */
export async function listPromptsForBrand(
  userId: string,
  brandId: string,
  opts: PageInput & { active?: unknown },
): Promise<ServiceResult<Page<Prompt>>> {
  if (!isUuid(brandId)) return fail("not_found", "Brand not found.");
  if (!(await assertBrandMember(userId, brandId))) return fail("not_found", "Brand not found.");

  let active: boolean | undefined;
  if (opts.active != null) {
    if (typeof opts.active === "boolean") active = opts.active;
    else {
      const s = String(opts.active).toLowerCase();
      if (s === "true") active = true;
      else if (s === "false") active = false;
      else return fail("bad_request", "active must be 'true' or 'false'.");
    }
  }

  const limit = clampLimit(opts.limit);
  const offset = clampOffset(opts.offset);
  const rows = await listPrompts(brandId, { active, limit: limit + 1, offset });
  return ok(page(rows, limit, offset));
}

/** Per-run answer history for one prompt. Pages over completed runs. */
export async function listAnswersForPrompt(
  userId: string,
  brandId: string,
  promptId: string,
  opts: PageInput,
): Promise<ServiceResult<Page<PromptAnswer>>> {
  if (!isUuid(brandId) || !isUuid(promptId)) return fail("not_found", "Prompt not found.");
  if (!(await assertBrandMember(userId, brandId))) return fail("not_found", "Prompt not found.");
  if (!(await getPromptForBrand(promptId, brandId))) return fail("not_found", "Prompt not found.");
  const limit = clampLimit(opts.limit);
  const offset = clampOffset(opts.offset);
  const rows = await getPromptAnswers(brandId, promptId, limit + 1, offset);
  return ok(page(rows, limit, offset));
}

/** A brand's AI-visibility metrics over a trailing window. `days` defaults to 30, clamped 1..365. */
export async function getMetricsForBrand(
  userId: string,
  brandId: string,
  rawDays: unknown,
): Promise<ServiceResult<{ days: number; metrics: BrandMetrics }>> {
  if (!isUuid(brandId)) return fail("not_found", "Brand not found.");
  if (!(await assertBrandMember(userId, brandId))) return fail("not_found", "Brand not found.");
  const n = typeof rawDays === "number" ? rawDays : Number(rawDays);
  const days =
    rawDays != null && rawDays !== "" && Number.isFinite(n)
      ? Math.min(Math.max(Math.trunc(n), 1), 365)
      : 30;
  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const metrics = await getBrandMetrics(brandId, sinceIso);
  return ok({ days, metrics });
}

/** A brand's scan runs, newest first (default page size 90). */
export async function listScansForBrand(
  userId: string,
  brandId: string,
  opts: PageInput,
): Promise<ServiceResult<Page<ScanRun>>> {
  if (!isUuid(brandId)) return fail("not_found", "Brand not found.");
  if (!(await assertBrandMember(userId, brandId))) return fail("not_found", "Brand not found.");
  const limit = clampLimit(opts.limit, 90);
  const offset = clampOffset(opts.offset);
  const rows = await listRunsForBrand(brandId, limit + 1, offset);
  return ok(page(rows, limit, offset));
}

/** One scan run the account owns. 404 for "no such run" and "not yours" alike. */
export async function getScanForUser(
  userId: string,
  runId: string,
): Promise<ServiceResult<{ scan: ScanRun }>> {
  if (!isUuid(runId)) return fail("not_found", "Scan not found.");
  const run = await getRunById(runId);
  if (!run || !(await assertBrandMember(userId, run.brand_id))) return fail("not_found", "Scan not found.");
  return ok({ scan: run });
}

/** Every country a brand can be scoped to (each `code` is a valid location country). */
export function listCountries(): { countries: typeof COUNTRIES } {
  return { countries: COUNTRIES };
}

/** Cities selectable as a brand's `location.city` for a country. `rawCountry` is untrusted. */
export function resolveCities(
  rawCountry: unknown,
): ServiceResult<{ country: { code: string; name: string }; cities: readonly string[] }> {
  const code = (typeof rawCountry === "string" ? rawCountry : "").toUpperCase();
  if (!isValidCountry(code)) return fail("not_found", "Country not found.");
  return ok({ country: { code, name: countryName(code) ?? code }, cities: citiesForCountry(code) });
}
