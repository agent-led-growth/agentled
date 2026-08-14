import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Send a job to the durable scan queue (`agentled-scan`). The single place that
 * knows the producer binding's shape — the onboarding producer (`/scan/run`) and
 * the daily sweep (`/scan/sweep`) both go through here.
 *
 * Typed locally with a cast: `wrangler types` output overrides `Response.json()`
 * across the app, so we don't import the generated binding types.
 */
export function enqueueScan(body: unknown): Promise<void> {
  const env = getCloudflareContext().env as unknown as {
    SCAN_QUEUE: { send(body: unknown): Promise<void> };
  };
  return env.SCAN_QUEUE.send(body);
}
