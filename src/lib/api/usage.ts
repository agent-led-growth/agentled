import "server-only";

import { countActivePrompts, getBrandsForUserId, getPlanForUserId } from "@/lib/ai-search";
import { promptLimit } from "@/lib/plan";

/**
 * The account's prompt usage vs its plan limit. The prompt cap is account-wide
 * (across every brand the user belongs to), matching the app's editor, so a
 * create/reactivate must check this — not a per-brand count.
 */
export async function promptUsage(
  userId: string,
): Promise<{ used: number; limit: number; brandIds: string[] }> {
  const brands = await getBrandsForUserId(userId);
  const brandIds = brands.map((b) => b.id);
  const [used, plan] = await Promise.all([
    brandIds.length ? countActivePrompts(brandIds) : Promise.resolve(0),
    getPlanForUserId(userId),
  ]);
  return { used, limit: promptLimit(plan), brandIds };
}
