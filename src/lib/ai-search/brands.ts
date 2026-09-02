import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { normalizeBrandLocation, type LocationInput } from "@/lib/geo/location";
import { planOf, type Plan } from "@/lib/plan";

import { normalizeDomain } from "./domain";
import type { Brand, BrandEnrichment, BrandRole } from "./types";

/**
 * Brand + membership writes/reads for the AI Search flow. Everything here uses the
 * service-role client and is server-only: the pre-scan route, the gate cutover
 * and the (future) scan runner all go through these, keeping routes thin. RLS is
 * the backstop; these bypass it deliberately.
 */

/** Pre-scan for a signed-out visitor: a bare anonymous brand, domain only. */
export async function createAnonymousBrand(domain: string): Promise<Brand> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brands")
    .insert({ domain: normalizeDomain(domain), status: "anonymous" })
    .select("*")
    .single();
  if (error) throw error;
  return data as Brand;
}

/**
 * Pre-scan for a signed-in visitor: the brand is born `active` and owned on the
 * spot, skipping the anonymous phase. If the membership insert fails we delete
 * the brand rather than leave an orphaned, unowned active row.
 */
export async function createActiveBrandForUser(
  domain: string,
  userId: string,
  role: BrandRole = "owner",
): Promise<Brand> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brands")
    .insert({
      domain: normalizeDomain(domain),
      status: "active",
      claimed_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  const brand = data as Brand;

  const { error: linkError } = await admin
    .from("brand_users")
    .insert({ brand_id: brand.id, user_id: userId, role });
  if (linkError) {
    await admin.from("brands").delete().eq("id", brand.id);
    throw linkError;
  }
  return brand;
}

/**
 * Reuse-or-create for a signed-in visitor: if this member already has a brand
 * for `domain`, return it (we update its enrichment/topics rather than spawn a
 * duplicate); otherwise create a fresh active + owned brand. Enforces the
 * (member, domain) uniqueness the onboarding relies on.
 */
export async function getOrCreateActiveBrandForUser(
  domain: string,
  userId: string,
  role: BrandRole = "owner",
): Promise<Brand> {
  const existing = await getMemberBrandByDomain(userId, domain);
  if (existing) return existing;
  return createActiveBrandForUser(domain, userId, role);
}

/**
 * The brand this member already has for `domain`, or null. A member is linked to
 * a given domain at most once; this is the lookup that keeps re-onboarding from
 * creating a second connection. Oldest wins if data ever diverged.
 */
export async function getMemberBrandByDomain(
  userId: string,
  domain: string,
): Promise<Brand | null> {
  const admin = createAdminClient();
  const host = normalizeDomain(domain);

  const { data: memberships, error } = await admin
    .from("brand_users")
    .select("brand_id")
    .eq("user_id", userId);
  if (error) throw error;

  const ids = (memberships ?? []).map((m) => (m as { brand_id: string }).brand_id);
  if (ids.length === 0) return null;

  const { data, error: brandsError } = await admin
    .from("brands")
    .select("*")
    .in("id", ids)
    .eq("domain", host)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (brandsError) throw brandsError;
  return (data as Brand | null) ?? null;
}

/** Delete a brand; topics, memberships and prompts cascade (see 0005). */
export async function deleteBrand(brandId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("brands").delete().eq("id", brandId);
  if (error) throw error;
}

/**
 * The gate claim: attach a user to a brand they onboarded anonymously, and flip
 * it `active`. Idempotent — safe if they're already a member, and `claimed_at`
 * is only stamped on the first claim.
 */
export async function attachUserToBrand(
  brandId: string,
  userId: string,
  role: BrandRole = "owner",
): Promise<void> {
  const admin = createAdminClient();

  const { error: linkError } = await admin
    .from("brand_users")
    .upsert(
      { brand_id: brandId, user_id: userId, role },
      { onConflict: "brand_id,user_id", ignoreDuplicates: true },
    );
  if (linkError) throw linkError;

  const { error: statusError } = await admin
    .from("brands")
    .update({ status: "active" })
    .eq("id", brandId)
    .eq("status", "anonymous");
  if (statusError) throw statusError;

  const { error: claimError } = await admin
    .from("brands")
    .update({ claimed_at: new Date().toISOString() })
    .eq("id", brandId)
    .is("claimed_at", null);
  if (claimError) throw claimError;
}

/** Backfill crawl/intelligence output onto a brand. Only sets given fields. */
export async function updateBrandEnrichment(
  brandId: string,
  fields: BrandEnrichment,
): Promise<void> {
  const patch: Record<string, string | null> = {};
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.description !== undefined) patch.description = fields.description;
  if (fields.logoUrl !== undefined) patch.logo_url = fields.logoUrl;
  if (Object.keys(patch).length === 0) return;

  const admin = createAdminClient();
  const { error } = await admin.from("brands").update(patch).eq("id", brandId);
  if (error) throw error;
}

/**
 * Persist a brand's location scope (0017). The raw selection is normalised and
 * validated here — the authoritative gate — so an invalid country degrades to
 * worldwide and a city that doesn't belong to its country degrades to country
 * scope, never persisting a bogus place regardless of what the client sent.
 */
export async function updateBrandLocation(
  brandId: string,
  input: LocationInput | null | undefined,
): Promise<void> {
  // Absent selection → leave the brand's location untouched, mirroring how topics
  // are only written when provided. Only an explicit selection (including an
  // explicit worldwide) overwrites, so a request that omits `location` can't wipe
  // a previously-set country/city back to worldwide.
  if (input == null) return;
  const loc = normalizeBrandLocation(input);
  const admin = createAdminClient();
  const { error } = await admin
    .from("brands")
    .update({
      location_mode: loc.mode,
      location_country: loc.country,
      location_city: loc.city,
      location_label: loc.label,
    })
    .eq("id", brandId);
  if (error) throw error;
}

/** Called by the scan runner once the first run's rows are in. */
export async function markFirstScanComplete(brandId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("brands")
    .update({ first_scan_completed_at: new Date().toISOString() })
    .eq("id", brandId)
    .is("first_scan_completed_at", null);
  if (error) throw error;
}

/** A scan is "in progress" if it was claimed within this window. */
export const SCAN_STALE_MS = 15 * 60 * 1000;

/**
 * Claim the one-time scan — the in-progress lock. One atomic conditional update:
 * it wins only if the scan isn't done and none is running (or the running one is
 * stale). Under row contention Postgres re-checks the WHERE, so exactly one
 * concurrent caller claims it. No explicit release: success sets
 * first_scan_completed_at; failure leaves the marker, keeping it locked until
 * stale so it can't re-fire on every dashboard open.
 */
export async function claimScan(brandId: string): Promise<string | null> {
  const admin = createAdminClient();
  const staleBefore = new Date(Date.now() - SCAN_STALE_MS).toISOString();
  // The token is the exact scan_started_at we write — the run's id. It rides the
  // queue message so execute can no-op a stale or duplicate delivery.
  const token = new Date().toISOString();
  const { data, error } = await admin
    .from("brands")
    // Claiming also clears any prior failure — a fresh claim IS the retry.
    .update({ scan_started_at: token, scan_failed_at: null })
    .eq("id", brandId)
    .is("first_scan_completed_at", null)
    // Claimable if nothing is running, the running one is stale, or it failed.
    .or(`scan_started_at.is.null,scan_started_at.lt.${staleBefore},scan_failed_at.not.is.null`)
    .select("id");
  if (error) throw error;
  return (data ?? []).length > 0 ? token : null;
}

/** Release a claim without completing it (e.g. the enqueue failed) so it retries. */
export async function releaseScan(brandId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("brands")
    .update({ scan_started_at: null })
    .eq("id", brandId)
    .is("first_scan_completed_at", null);
  if (error) throw error;
}

/** Terminal-failure marker: the queued run gave up. Never overwrites a success. */
export async function markScanFailed(brandId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("brands")
    .update({ scan_failed_at: new Date().toISOString() })
    .eq("id", brandId)
    .is("first_scan_completed_at", null);
  if (error) throw error;
}

/**
 * Clear a brand's scan output (mentions, citations, scans) for an idempotent
 * re-run — the queue may retry a run, and runScan writes all rows at the end, so
 * a fresh attempt starts from a clean slate. Competitors are per-brand and kept.
 */
export async function deleteBrandScans(brandId: string): Promise<void> {
  const admin = createAdminClient();
  for (const table of ["mentions", "citations", "scans"] as const) {
    const { error } = await admin.from(table).delete().eq("brand_id", brandId);
    if (error) throw error;
  }
}

export async function getBrandById(brandId: string): Promise<Brand | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brands")
    .select("*")
    .eq("id", brandId)
    .maybeSingle();
  if (error) throw error;
  return (data as Brand | null) ?? null;
}

/** Resolve the app-owned `public.users` id from a Supabase Auth user id. */
export async function getUserIdByAuthId(authUserId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw error;
  return data ? (data as { id: string }).id : null;
}

/**
 * The account plan for a Supabase Auth user, fail-closed to `free`. Any lookup
 * error (e.g. before migration 0011 is applied, or a transient DB error) degrades
 * to `free` rather than throwing, so resolving a plan can never take a page down.
 * Server-side only — every plan gate should resolve the plan here, never trust a
 * client value.
 */
export async function getPlanForAuthUser(authUserId: string): Promise<Plan> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("users")
      .select("plan")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (error) throw error;
    return planOf((data as { plan: string | null } | null)?.plan);
  } catch (err) {
    console.error("getPlanForAuthUser: plan lookup failed, defaulting to free", err);
    return "free";
  }
}

/**
 * The brand's owner (role `owner`, else the first member) with their plan — the
 * run's `user_id` and the scan's prompt cap, resolved in one query. Null when the
 * brand has no members.
 */
export async function getBrandOwner(
  brandId: string,
): Promise<{ userId: string; plan: Plan } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brand_users")
    .select("user_id, role, users(plan)")
    .eq("brand_id", brandId);
  if (error) throw error;
  // PostgREST types the embed as an array; a to-one FK returns one row (or an
  // object), so normalise either shape.
  type Embed = { plan: string | null };
  const rows = (data ?? []) as unknown as {
    user_id: string;
    role: string;
    users: Embed | Embed[] | null;
  }[];
  if (rows.length === 0) return null;
  const row = rows.find((r) => r.role === "owner") ?? rows[0];
  const embed = Array.isArray(row.users) ? row.users[0] : row.users;
  return { userId: row.user_id, plan: planOf(embed?.plan ?? null) };
}

/** Every brand a user belongs to, newest first (by Supabase Auth user id). */
export async function getBrandsForUser(authUserId: string): Promise<Brand[]> {
  const userId = await getUserIdByAuthId(authUserId);
  if (!userId) return [];
  return getBrandsForUserId(userId);
}

/** Every brand a user belongs to, keyed by the app-owned `public.users` id. */
export async function getBrandsForUserId(userId: string): Promise<Brand[]> {
  const admin = createAdminClient();
  const { data: memberships, error } = await admin
    .from("brand_users")
    .select("brand_id")
    .eq("user_id", userId);
  if (error) throw error;

  const ids = (memberships ?? []).map((m) => (m as { brand_id: string }).brand_id);
  if (ids.length === 0) return [];

  const { data: brands, error: brandsError } = await admin
    .from("brands")
    .select("*")
    .in("id", ids)
    .order("created_at", { ascending: false });
  if (brandsError) throw brandsError;
  return (brands ?? []) as Brand[];
}

/**
 * Whether `userId` (app-owned users id) is a member of `brandId`. The lightweight
 * account-isolation guard for routes that only need to authorize (not the brand
 * itself). The service-role client bypasses RLS, so every brand-scoped API request
 * MUST gate on this (or {@link getBrandForMember}) in code.
 */
export async function assertBrandMember(userId: string, brandId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brand_users")
    .select("brand_id")
    .eq("user_id", userId)
    .eq("brand_id", brandId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/**
 * The brand `brandId` IF `userId` is a member of it, else null — resolves the
 * brand THROUGH membership in one query (the brand embedded on the membership
 * row), so a route can never return a brand it hasn't authorized. Use
 * {@link assertBrandMember} instead when the brand object itself isn't needed.
 */
export async function getBrandForMember(userId: string, brandId: string): Promise<Brand | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brand_users")
    .select("brands(*)")
    .eq("user_id", userId)
    .eq("brand_id", brandId)
    .maybeSingle();
  if (error) throw error;
  // PostgREST returns the embedded to-one `brands` as an object; normalize in
  // case a version hands back a single-element array.
  const raw = (data as { brands: Brand | Brand[] | null } | null)?.brands ?? null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

/** The account plan for an app-owned `public.users` id, fail-closed to `free`. */
export async function getPlanForUserId(userId: string): Promise<Plan> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("users")
      .select("plan")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return planOf((data as { plan: string | null } | null)?.plan);
  } catch (err) {
    console.error("getPlanForUserId: plan lookup failed, defaulting to free", err);
    return "free";
  }
}

/** The user's active brand (latest), or null. Replaces the old hasScanned path. */
export async function getActiveBrandForUser(authUserId: string): Promise<Brand | null> {
  const brands = await getBrandsForUser(authUserId);
  return brands.find((b) => b.status === "active") ?? null;
}

export async function hasActiveBrand(authUserId: string): Promise<boolean> {
  return (await getActiveBrandForUser(authUserId)) !== null;
}
