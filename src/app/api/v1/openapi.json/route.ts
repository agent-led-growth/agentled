import { NextResponse } from "next/server";

import { openApiSpec } from "@/lib/api/openapi";

/**
 * GET /api/v1/openapi.json → the OpenAPI 3.1 description of this API.
 *
 * Public (no key): a spec is public documentation, and the docs site plus
 * tooling (Postman/Insomnia, MCP generators) need to read it without auth.
 * The single source of truth is `src/lib/api/openapi.ts`.
 */
export const GET = () =>
  NextResponse.json(openApiSpec, {
    headers: { "cache-control": "public, max-age=3600" },
  });
