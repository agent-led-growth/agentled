import { requireApiKey, type ApiKeyContext } from "@/lib/api-keys/auth";

import { serverError, unauthorized } from "./respond";

/**
 * Wrap a public-API (`/api/v1`) handler: authenticate the API key once, run the
 * handler with the resolved account, and turn any thrown error into a uniform
 * 500. This makes auth + error handling identical across every route — and
 * impossible to forget on a new one.
 *
 * Arg order is `(auth, ctx, request)` so a handler declares only what it uses:
 * a list route takes `(auth)`, a dynamic route `(auth, ctx)`, and one that reads
 * the query string `(auth, ctx, request)`. `ctx` is Next's dynamic-route context
 * (`{ params }`), undefined for a static route.
 */
export function withApiKey<Ctx = unknown>(
  handler: (auth: ApiKeyContext, ctx: Ctx, request: Request) => Promise<Response>,
) {
  return async (request: Request, ctx?: Ctx): Promise<Response> => {
    try {
      const auth = await requireApiKey(request);
      if (!auth) return unauthorized();
      return await handler(auth, ctx as Ctx, request);
    } catch (err) {
      console.error("api/v1:", err);
      return serverError();
    }
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether a path segment is a well-formed UUID. Guard with this before a lookup
 * keyed on a uuid column — Postgres rejects a non-uuid string with an error that
 * would otherwise surface as a 500, when the honest answer is 404 (no such id).
 */
export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}
