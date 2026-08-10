import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { normalizeDomain } from "./domain";
import type { Brand, BrandEnrichment, BrandRole } from "./types";

/**
 * Brand + membership writes/reads for the Laurel flow. Everything here uses the
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
export async function claimScan(brandId: string): Promise<boolean> {
  const admin = createAdminClient();
  const staleBefore = new Date(Date.now() - SCAN_STALE_MS).toISOString();
  const { data, error } = await admin
    .from("brands")
    .update({ scan_started_at: new Date().toISOString() })
    .eq("id", brandId)
    .is("first_scan_completed_at", null)
    .or(`scan_started_at.is.null,scan_started_at.lt.${staleBefore}`)
    .select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
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

/** Emails of every member linked to a brand — recipients for scan notifications. */
export async function getBrandMemberEmails(brandId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data: members, error } = await admin
    .from("brand_users")
    .select("user_id")
    .eq("brand_id", brandId);
  if (error) throw error;

  const ids = (members ?? []).map((m) => (m as { user_id: string }).user_id);
  if (ids.length === 0) return [];

  const { data: users, error: usersError } = await admin
    .from("users")
    .select("email")
    .in("id", ids);
  if (usersError) throw usersError;

  return ((users ?? []) as { email: string | null }[])
    .map((u) => u.email)
    .filter((e): e is string => Boolean(e));
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

/** Every brand a user belongs to, newest first. */
export async function getBrandsForUser(authUserId: string): Promise<Brand[]> {
  const admin = createAdminClient();
  const userId = await getUserIdByAuthId(authUserId);
  if (!userId) return [];

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

/** The user's active brand (latest), or null. Replaces the old hasScanned path. */
export async function getActiveBrandForUser(authUserId: string): Promise<Brand | null> {
  const brands = await getBrandsForUser(authUserId);
  return brands.find((b) => b.status === "active") ?? null;
}

export async function hasActiveBrand(authUserId: string): Promise<boolean> {
  return (await getActiveBrandForUser(authUserId)) !== null;
}
