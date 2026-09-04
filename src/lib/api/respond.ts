import { NextResponse } from "next/server";

import { env } from "@/lib/env";

/**
 * Uniform JSON responses for the public API (`/api/v1`). Errors always take the
 * shape `{ error: { code, message } }` so a client can branch on a stable `code`
 * rather than parsing prose.
 */

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export const unauthorized = () =>
  apiError(401, "unauthorized", "Missing or invalid API key.");

export const notFound = (what = "Resource") =>
  apiError(404, "not_found", `${what} not found.`);

export const badRequest = (message: string) => apiError(400, "bad_request", message);

/**
 * A plan-limit rejection (409). Includes `upgradeUrl` pointing at the pricing
 * page, so a client (or an agent) can send the user to upgrade rather than just
 * failing.
 */
export function limitReached(message: string) {
  return NextResponse.json(
    {
      error: {
        code: "limit_reached",
        message,
        upgradeUrl: `${env.siteUrl()}/ai-search/pricing`,
      },
    },
    { status: 409 },
  );
}

export const serverError = () =>
  apiError(500, "server_error", "Something went wrong. Please try again.");
