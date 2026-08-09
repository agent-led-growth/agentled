import "server-only";

import {
  attachUserToBrand,
  deleteBrand,
  getBrandById,
  getMemberBrandByDomain,
  updateBrandEnrichment,
} from "./brands";
import { listTopics, resetSuggestedTopics, setSelectedTopics } from "./topics";

/**
 * Gate reconciliation. Attaches the just-onboarded brand to the member while
 * enforcing one brand per (member, domain):
 *
 * - First time for this domain → attach the member and persist their topic pick.
 * - Already have a brand for this domain (re-onboarding) → fold the new
 *   onboarding's enrichment + topics into the existing brand and discard the
 *   throwaway one, so the member never ends up connected to the same URL twice.
 *
 * Returns the canonical brand id the member should land on.
 */
export async function claimBrandForMember(
  newBrandId: string,
  userId: string,
  selectedLabels: string[],
): Promise<string> {
  const newBrand = await getBrandById(newBrandId);
  if (!newBrand) throw new Error(`claimBrandForMember: brand ${newBrandId} not found`);

  const existing = await getMemberBrandByDomain(userId, newBrand.domain);

  // Re-onboarding: reuse the member's existing brand for this domain.
  if (existing && existing.id !== newBrand.id) {
    await updateBrandEnrichment(existing.id, {
      name: newBrand.name,
      description: newBrand.description,
      logoUrl: newBrand.logo_url,
    });
    const suggested = (await listTopics(newBrand.id)).map((t) => t.label);
    await resetSuggestedTopics(existing.id, suggested);
    if (selectedLabels.length > 0) await setSelectedTopics(existing.id, selectedLabels);
    await deleteBrand(newBrand.id); // topics cascade
    return existing.id;
  }

  // First brand for this domain (or re-claiming the same one): attach + select.
  await attachUserToBrand(newBrand.id, userId);
  if (selectedLabels.length > 0) await setSelectedTopics(newBrand.id, selectedLabels);
  return newBrand.id;
}
