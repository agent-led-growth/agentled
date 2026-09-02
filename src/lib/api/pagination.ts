/**
 * Offset/limit pagination for the public API's list endpoints. A response carries
 * `pagination: { limit, offset, hasMore }`; `hasMore` is derived by asking the
 * data layer for one extra row (limit + 1) and checking whether it came back, so
 * there's no separate COUNT query. Consumers page with `?limit` and `?offset`.
 */

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

export type Pagination = { limit: number; offset: number };

export function parsePagination(request: Request, defaultLimit = DEFAULT_LIMIT): Pagination {
  const sp = new URL(request.url).searchParams;

  const rawLimit = sp.get("limit");
  const nLimit = Number(rawLimit);
  const limit =
    rawLimit && Number.isFinite(nLimit)
      ? Math.min(Math.max(Math.trunc(nLimit), 1), MAX_LIMIT)
      : defaultLimit;

  const rawOffset = sp.get("offset");
  const nOffset = Number(rawOffset);
  const offset = rawOffset && Number.isFinite(nOffset) ? Math.max(Math.trunc(nOffset), 0) : 0;

  return { limit, offset };
}

/**
 * Split a page fetched with `limit + 1` rows into the visible page plus a
 * `hasMore` flag. Pass the rows returned when you queried for `limit + 1`.
 */
export function pageResult<T>(rows: T[], limit: number): { items: T[]; hasMore: boolean } {
  const hasMore = rows.length > limit;
  return { items: hasMore ? rows.slice(0, limit) : rows, hasMore };
}
