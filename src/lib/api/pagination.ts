/**
 * Offset/limit pagination for the public API's list endpoints. A response carries
 * `pagination: { limit, offset, hasMore }`; `hasMore` is derived by asking the
 * data layer for one extra row (limit + 1) and checking whether it came back, so
 * there's no separate COUNT query. Consumers page with `?limit` and `?offset`.
 */

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

/**
 * Clamp a raw `limit` (query string or JSON number) to 1..MAX_LIMIT, falling back
 * to `defaultLimit` when absent/empty/non-numeric. Used by the API services so
 * every list endpoint pages identically across REST and MCP.
 */
export function clampLimit(raw: unknown, defaultLimit = DEFAULT_LIMIT): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  return raw != null && raw !== "" && Number.isFinite(n)
    ? Math.min(Math.max(Math.trunc(n), 1), MAX_LIMIT)
    : defaultLimit;
}

/** Clamp a raw `offset` to >= 0, falling back to 0 when absent/empty/non-numeric. */
export function clampOffset(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  return raw != null && raw !== "" && Number.isFinite(n) ? Math.max(Math.trunc(n), 0) : 0;
}

/**
 * Split a page fetched with `limit + 1` rows into the visible page plus a
 * `hasMore` flag. Pass the rows returned when you queried for `limit + 1`.
 */
export function pageResult<T>(rows: T[], limit: number): { items: T[]; hasMore: boolean } {
  const hasMore = rows.length > limit;
  return { items: hasMore ? rows.slice(0, limit) : rows, hasMore };
}
