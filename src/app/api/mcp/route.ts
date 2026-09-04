import { NextResponse } from "next/server";

import { requireApiKey } from "@/lib/api-keys/auth";
import { dispatch, parseError } from "@/lib/mcp/server";

/**
 * POST /api/mcp → the remote MCP endpoint (Streamable HTTP, stateless).
 *
 * Auth is the same `agl_live_` Bearer key as `/api/v1` (via requireApiKey), so a
 * client configures it with `Authorization: Bearer agl_live_…`. Each POST carries
 * one JSON-RPC message; requests get a single JSON reply, notifications get HTTP
 * 202. No SSE, no Mcp-Session-Id — every tool is request/response.
 */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, mcp-protocol-version",
} as const;

function unauthorized() {
  return NextResponse.json(
    { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Missing or invalid API key." } },
    { status: 401, headers: { ...CORS, "www-authenticate": "Bearer" } },
  );
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiKey(request);
    if (!auth) return unauthorized();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(parseError(), { headers: CORS });
    }

    // JSON-RPC batching was removed in the 2025-06-18 spec; still accept an array
    // for older clients. All-notifications → 202 with no body.
    if (Array.isArray(body)) {
      const responses = (await Promise.all(body.map((m) => dispatch(m, auth.userId)))).filter(
        (r): r is object => r !== null,
      );
      if (responses.length === 0) return new NextResponse(null, { status: 202, headers: CORS });
      return NextResponse.json(responses, { headers: CORS });
    }

    const response = await dispatch(body, auth.userId);
    if (response === null) return new NextResponse(null, { status: 202, headers: CORS });
    return NextResponse.json(response, { headers: CORS });
  } catch (err) {
    // A thrown auth/DB error must return a clean JSON-RPC error, not a framework 500.
    console.error("mcp route:", err);
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32603, message: "Internal error." } },
      { status: 500, headers: CORS },
    );
  }
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// The optional server→client stream (GET) and session teardown (DELETE) aren't
// implemented — this is a stateless request/response server.
function methodNotAllowed() {
  return new NextResponse(null, { status: 405, headers: { ...CORS, allow: "POST, OPTIONS" } });
}
export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;
