import "server-only";

import { env } from "@/lib/env";

/**
 * Constant-time check of the shared INTERNAL_SECRET header on the internal
 * scan-execute/-fail routes (called server-to-server by the scan-consumer
 * worker). Constant-time so the comparison can't be timed to guess the secret.
 */
export function isInternalRequest(request: Request): boolean {
  const expected = env.internalSecret();
  // No secret configured ⇒ the internal routes are locked down (deny all), never
  // open. Only an instance running the scan workers sets INTERNAL_SECRET.
  if (!expected) return false;
  const provided = request.headers.get("x-internal-secret") ?? "";
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
