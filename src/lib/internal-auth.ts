import "server-only";

import { env } from "@/lib/env";

/**
 * Constant-time check of the shared INTERNAL_SECRET header on the internal
 * scan-execute/-fail routes (called server-to-server by the scan-consumer
 * worker). Constant-time so the comparison can't be timed to guess the secret.
 */
export function isInternalRequest(request: Request): boolean {
  const provided = request.headers.get("x-internal-secret") ?? "";
  const expected = env.internalSecret();
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
