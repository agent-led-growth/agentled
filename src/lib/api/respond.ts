import { NextResponse } from "next/server";

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

export const serverError = () =>
  apiError(500, "server_error", "Something went wrong. Please try again.");
