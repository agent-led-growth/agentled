import "server-only";

import { ToolError, TOOLS, TOOLS_BY_NAME } from "./tools";

/**
 * A minimal, stateless MCP server over JSON-RPC 2.0 (the Streamable HTTP
 * transport's request/response half). Every tool is a synchronous request→
 * response call, so there's no SSE stream, no session id, and no server-initiated
 * messages — a single JSON reply per POST, which is exactly what workerd + the
 * app's existing request-in/JSON-out pattern do best. See `route.ts` for the HTTP
 * shell and `tools.ts` for the tool implementations.
 */

const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26"];
const LATEST_PROTOCOL = "2025-06-18";
const SERVER_INFO = { name: "agentled", version: "1.0.0" };
const INSTRUCTIONS =
  "Monitor how brands appear in AI answers. Configure a brand with create_brand, " +
  "add prompts with add_prompt (a brand with no active prompts is never scanned), " +
  "set its market with set_brand_location, then read results with get_metrics, " +
  "list_scans and list_answers.";

// JSON-RPC error codes
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

type JsonRpcId = string | number | null;
interface RpcMessage {
  jsonrpc?: unknown;
  id?: JsonRpcId;
  method?: unknown;
  params?: unknown;
}

const ok = (id: JsonRpcId, result: unknown) => ({ jsonrpc: "2.0" as const, id, result });
const err = (id: JsonRpcId, code: number, message: string) => ({
  jsonrpc: "2.0" as const,
  id,
  error: { code, message },
});

/**
 * Dispatch one JSON-RPC message. Returns the response object for a request, or
 * `null` for a notification (no `id`) — the caller then replies HTTP 202 with no
 * body. `userId` is the authenticated account (auth happens in the route).
 */
export async function dispatch(message: unknown, userId: string): Promise<object | null> {
  const msg = (message ?? {}) as RpcMessage;
  const isNotification = msg.id === undefined;
  const id: JsonRpcId = isNotification ? null : (msg.id as JsonRpcId);

  if (msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return isNotification ? null : err(id, INVALID_REQUEST, "Invalid JSON-RPC request.");
  }
  const method = msg.method;

  // Notifications (initialized, cancelled, …): acknowledge with no response body.
  if (method.startsWith("notifications/")) return null;

  switch (method) {
    case "initialize": {
      const requested = (msg.params as { protocolVersion?: string } | undefined)?.protocolVersion;
      const protocolVersion =
        requested && SUPPORTED_PROTOCOLS.includes(requested) ? requested : LATEST_PROTOCOL;
      return ok(id, {
        protocolVersion,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, {
        tools: TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });
    case "tools/call": {
      const params = (msg.params ?? {}) as { name?: unknown; arguments?: unknown };
      const tool = typeof params.name === "string" ? TOOLS_BY_NAME.get(params.name) : undefined;
      if (!tool) return err(id, INVALID_PARAMS, `Unknown tool: ${String(params.name)}`);
      const args =
        params.arguments && typeof params.arguments === "object" && !Array.isArray(params.arguments)
          ? (params.arguments as Record<string, unknown>)
          : {};
      try {
        const result = await tool.handler(userId, args);
        return ok(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        });
      } catch (e) {
        // Domain failures come back as an isError tool RESULT (still a JSON-RPC
        // success), so the agent can read and act on them.
        if (e instanceof ToolError) {
          return ok(id, {
            content: [{ type: "text", text: `Error (${e.code}): ${e.message}` }],
            isError: true,
          });
        }
        console.error(`mcp tools/call ${tool.name}:`, e);
        return err(id, INTERNAL_ERROR, "Internal error.");
      }
    }
    default:
      return isNotification ? null : err(id, METHOD_NOT_FOUND, `Method not found: ${method}`);
  }
}

export const parseError = (id: JsonRpcId = null) => err(id, PARSE_ERROR, "Parse error.");
