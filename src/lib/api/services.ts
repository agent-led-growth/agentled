import "server-only";

import {
  assertBrandMember,
  countActivePrompts,
  createActiveBrandForUser,
  createPrompt,
  enrichBrand,
  getBrandById,
  getBrandForMember,
  getBrandsForUserId,
  getMemberBrandByDomain,
  getPlanForUserId,
  getPromptForBrand,
  isValidWebsite,
  MAX_PROMPT_TEXT_LEN,
  setPromptActive,
  updateBrandEnrichment,
  updateBrandLocation,
  updatePromptText,
  type Brand,
  type Prompt,
} from "@/lib/ai-search";
import { isUuid } from "@/lib/api/route";
import { promptUsage } from "@/lib/api/usage";
import { normalizeBrandLocation, type LocationInput } from "@/lib/geo/location";
import { brandLimit } from "@/lib/plan";

/**
 * Write operations for the account: create brand, set location, add/update
 * prompt. Each validates its input, enforces account membership + plan limits,
 * performs the write, and returns a `ServiceResult` — the SINGLE source of truth
 * shared by the REST routes (`src/app/api/v1/**`) and the MCP tools
 * (`src/lib/mcp/tools.ts`), so the two surfaces can't drift. Callers map the
 * result to their own error shape (HTTP status vs JSON-RPC tool error) and
 * serialize the returned domain object themselves.
 */

export type ServiceErrorCode = "bad_request" | "not_found" | "limit_reached";
export type ServiceError = { code: ServiceErrorCode; message: string };
export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: ServiceError };

const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const fail = (code: ServiceErrorCode, message: string): ServiceResult<never> => ({
  ok: false,
  error: { code, message },
});

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

  if (location === undefined) return fail("bad_request", "Provide 'location'.");
  if (location === null || typeof location !== "object" || Array.isArray(location))
    return fail("bad_request", "location must be an object.");
  const input = location as LocationInput;
  const mode = input.mode ?? undefined;
  // Require an explicit mode so a partial object can't silently reset scope.
  if (mode !== "worldwide" && mode !== "country" && mode !== "city")
    return fail("bad_request", "location.mode is required: 'worldwide', 'country', or 'city'.");
  const normalized = normalizeBrandLocation(input);
  if ((mode === "country" || mode === "city") && normalized.mode === "worldwide")
    return fail("bad_request", "location.country is not a valid ISO 3166-1 alpha-2 code.");
  if (mode === "city" && normalized.mode === "country")
    return fail("bad_request", "location.city is not a recognized city for that country.");

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
