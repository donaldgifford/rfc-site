/**
 * MSW request handlers for `API_MODE=msw` dev mode (IMPL-0002 Phase 3).
 *
 * Endpoints implemented:
 *
 * - `GET /api/v1/docs` — paginated cross-type list. Supports `?filter=` +
 *   `?sort=` per rfc-api v0.3.0 / DESIGN-0003 (IMPL-0004 Phase 7b).
 * - `GET /api/v1/:type` — paginated per-type list (`Link` header).
 * - `GET /api/v1/:type/:id` — single doc fetch; 7807 ErrNotFound on miss.
 * - `GET /api/v1/search?q=…` — paginated substring filter (`Link` header).
 *
 * **Pagination (RFC 5988).** The `cursor` query parameter is an
 * opaque base64-encoded integer offset into the fixture array. The
 * `Link` header's `rel="next"` URL carries the next cursor when
 * more rows remain. This mirrors what `src/portal/api/pagination.ts`
 * parses, so the existing route-side cursor handling "just works"
 * in dev mode.
 *
 * **Filter + sort (Phase 7b).** `/api/v1/docs` parses `?filter=field:value`
 * (repeatable; Phase 1 supports only `type:<DocumentType>`) and `?sort=`
 * (six-value enum, default `created_desc` to mirror rfc-api v0.3.0).
 * Invalid values return 400 problem+json. Cursor-sort mismatch is NOT
 * modelled here: MSW cursors are opaque integer offsets without an
 * embedded sort, so callers can swap `?sort=` mid-traversal and get a
 * coherent re-slice. The real rfc-api returns 400 on mismatch; the
 * consuming `<DirectoryToolbar>` clears `?cursor=` on `?sort=` change
 * so the mismatch path doesn't fire in practice. Tests that need the
 * 400 surface can `server.use(...)` an explicit override.
 *
 * **Faker seeding.** A deterministic seed is set at module load so
 * the tiny non-structural filler (request ids, default author names)
 * is stable across reloads. PLAN-0001 Resolved Q3.
 */

import { faker } from "@faker-js/faker";
import { http, HttpResponse } from "msw";
import type { Document, ListDocsSortParameter, SearchResult } from "../__generated__/model";
import { canonicalFromUrl } from "../docId";
import { byType, findById, loadFixtures } from "./fixtures";

faker.seed(0xdec1a55);

const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 200;

const KNOWN_TYPES: ReadonlySet<string> = new Set(["rfc", "adr", "design", "impl", "plan", "inv"]);

const SORT_VALUES: ReadonlySet<string> = new Set<ListDocsSortParameter>([
  "created_desc",
  "created_asc",
  "updated_desc",
  "updated_asc",
  "id_desc",
  "id_asc",
]);

const DEFAULT_SORT: ListDocsSortParameter = "created_desc";

const FILTER_RE = /^([a-z][a-z0-9_]*):([a-zA-Z0-9_-]+)$/;

interface PaginatedSlice<T> {
  page: T[];
  nextCursor?: string;
}

interface ProblemBody {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  request_id?: string;
}

export const handlers = [
  http.get("*/api/v1/docs", async ({ request }) => {
    const url = new URL(request.url);
    const all = await loadFixtures();

    const filterResult = parseFilters(url.searchParams);
    if (!filterResult.ok) return filterResult.problem;
    const sortResult = parseSort(url.searchParams);
    if (!sortResult.ok) return sortResult.problem;

    const filtered = applyFilters(all, filterResult.filters);
    const sorted = applySort(filtered, sortResult.sort);
    const slice = paginate(sorted, url.searchParams);

    const totalCount = filtered.length;
    const totalUnfiltered = filterResult.filters.size > 0 ? all.length : undefined;
    return jsonWithListHeaders(slice, url, { totalCount, totalUnfiltered });
  }),

  http.get("*/api/v1/search", async ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const all = await loadFixtures();
    const filtered = query ? all.filter((d) => matchesQuery(d, query)) : all;
    const slice = paginate(filtered, url.searchParams);
    // OpenAPI: /search returns SearchResult[] (each wraps a Document).
    // For dev-mode realism we synthesise a minimal snippet (the matched
    // term wrapped in <em>) and a placeholder score.
    const results: SearchResult[] = slice.page.map((doc) => ({
      document: doc,
      score: 0.75,
      ...(query
        ? {
            snippet: `<em>${query}</em> matched in ${doc.title}`,
            matched_terms: [query],
          }
        : {}),
    }));
    return jsonWithLinkHeader({ page: results, nextCursor: slice.nextCursor }, url);
  }),

  http.get("*/api/v1/:type/:id", async ({ params }) => {
    const type = expectString(params.type);
    const urlId = expectString(params.id);
    // Mirror rfc-api: the URL :id is the bare numeric form (e.g. "0001")
    // and the canonical fixture id (e.g. "RFC-0001") is reconstructed
    // from (type, urlId). See `src/portal/api/docId.ts`.
    const canonicalId = canonicalFromUrl(type, urlId);

    const doc = await findById(type, canonicalId);
    if (doc !== undefined) {
      return HttpResponse.json(doc, { status: 200 });
    }

    return notFound(`No document at ${type}/${canonicalId}`);
  }),

  // The `:type` listing handler must come AFTER `:type/:id` so MSW's
  // last-match-wins routing doesn't swallow getDoc requests.
  http.get("*/api/v1/:type", async ({ params, request }) => {
    const type = expectString(params.type);
    const url = new URL(request.url);

    const bucket = await byType(type);
    if (bucket.length === 0) {
      return notFound(`Unknown document type "${type}"`);
    }

    const slice = paginate(bucket, url.searchParams);
    return jsonWithLinkHeader(slice, url);
  }),
];

/**
 * Slice an array using opaque base64-encoded integer offsets.
 *
 * Cursors are intentionally opaque — callers should never decode
 * them. The integer-offset choice is the simplest stable form; if
 * the fixture corpus ever needs sort-order changes mid-pagination,
 * swap this for a (id, sortKey) tuple without changing the wire
 * shape.
 */
function paginate<T>(items: readonly T[], searchParams: URLSearchParams): PaginatedSlice<T> {
  const limit = clampLimit(searchParams.get("limit"));
  const offset = decodeCursor(searchParams.get("cursor"));

  const page = items.slice(offset, offset + limit);
  const nextOffset = offset + limit;
  const nextCursor = nextOffset < items.length ? encodeCursor(nextOffset) : undefined;

  return { page, nextCursor };
}

function clampLimit(raw: string | null): number {
  if (raw === null) return DEFAULT_LIMIT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function decodeCursor(raw: string | null): number {
  if (raw === null || raw === "") return 0;
  try {
    const decoded = atob(raw);
    const parsed = Number.parseInt(decoded, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
  } catch {
    return 0;
  }
}

function encodeCursor(offset: number): string {
  return btoa(String(offset));
}

/**
 * Returns a `200 OK` JSON response with the page body and an
 * RFC 5988 `Link` header carrying the `rel="next"` URL when more
 * rows remain. Same path as the inbound URL — matches
 * `src/portal/api/pagination.ts`'s expectations.
 *
 * Return type is `Response` (not `HttpResponse<T[]>`) so it unifies
 * with `notFound()` at the resolver-return position — MSW infers
 * the resolver's response type from the union of all branches.
 */
function jsonWithLinkHeader<T>(slice: PaginatedSlice<T>, url: URL): Response {
  const headers: Record<string, string> = {};
  if (slice.nextCursor !== undefined) {
    const nextUrl = new URL(url);
    nextUrl.searchParams.set("cursor", slice.nextCursor);
    headers.Link = `<${nextUrl.pathname}${nextUrl.search}>; rel="next"`;
  }
  return HttpResponse.json(slice.page, { status: 200, headers });
}

/**
 * Like `jsonWithLinkHeader` but for `/api/v1/docs`: adds
 * `X-Total-Count` (filtered total) and the conditional
 * `X-Total-Count-Unfiltered` (only when at least one filter is
 * active). The `next` Link URL inherits every search param from
 * the inbound URL — including `filter` and `sort` — so cursor
 * traversal stays inside the same view.
 */
function jsonWithListHeaders<T>(
  slice: PaginatedSlice<T>,
  url: URL,
  counts: { totalCount: number; totalUnfiltered: number | undefined },
): Response {
  const headers: Record<string, string> = {
    "X-Total-Count": String(counts.totalCount),
  };
  if (counts.totalUnfiltered !== undefined) {
    headers["X-Total-Count-Unfiltered"] = String(counts.totalUnfiltered);
  }
  if (slice.nextCursor !== undefined) {
    const nextUrl = new URL(url);
    nextUrl.searchParams.set("cursor", slice.nextCursor);
    headers.Link = `<${nextUrl.pathname}${nextUrl.search}>; rel="next"`;
  }
  return HttpResponse.json(slice.page, { status: 200, headers });
}

type FilterParseResult =
  | { ok: true; filters: ReadonlyMap<string, ReadonlySet<string>> }
  | { ok: false; problem: Response };

type SortParseResult = { ok: true; sort: ListDocsSortParameter } | { ok: false; problem: Response };

/**
 * Parse repeatable `filter=field:value` params. Phase 1 of DESIGN-0003
 * supports `type:` only — unknown fields and unknown values both 400.
 */
function parseFilters(searchParams: URLSearchParams): FilterParseResult {
  const raw = searchParams.getAll("filter");
  const map = new Map<string, Set<string>>();

  for (const item of raw) {
    const match = FILTER_RE.exec(item);
    if (!match) {
      return { ok: false, problem: badRequest(`malformed filter: "${item}"`) };
    }
    const field = match[1] ?? "";
    const value = match[2] ?? "";
    if (field !== "type") {
      return { ok: false, problem: badRequest(`unknown filter field: ${field}`) };
    }
    if (!KNOWN_TYPES.has(value)) {
      return { ok: false, problem: badRequest(`unknown type: ${value}`) };
    }
    const bucket = map.get(field) ?? new Set<string>();
    bucket.add(value);
    map.set(field, bucket);
  }

  return { ok: true, filters: map };
}

/**
 * Parse the single-valued `sort=` enum. Omission defaults to
 * `created_desc` (preserves today's rfc-api behavior per DESIGN-0003
 * OQ3-b).
 */
function parseSort(searchParams: URLSearchParams): SortParseResult {
  const raw = searchParams.get("sort");
  if (raw === null || raw === "") {
    return { ok: true, sort: DEFAULT_SORT };
  }
  if (!SORT_VALUES.has(raw)) {
    return { ok: false, problem: badRequest(`sort value out of range: ${raw}`) };
  }
  return { ok: true, sort: raw as ListDocsSortParameter };
}

function applyFilters(
  docs: readonly Document[],
  filters: ReadonlyMap<string, ReadonlySet<string>>,
): Document[] {
  if (filters.size === 0) return [...docs];
  let result = [...docs];
  const types = filters.get("type");
  if (types && types.size > 0) {
    result = result.filter((doc) => types.has(doc.type));
  }
  return result;
}

/**
 * Stable sort by the requested key. `id` is the tiebreaker (ascending
 * for *_desc sorts, ascending for *_asc too — matches rfc-api's
 * keyset pagination).
 */
function applySort(docs: Document[], sort: ListDocsSortParameter): Document[] {
  const sorted = [...docs];
  sorted.sort((a, b) => compareDocs(a, b, sort));
  return sorted;
}

function compareDocs(a: Document, b: Document, sort: ListDocsSortParameter): number {
  switch (sort) {
    case "created_desc": {
      const cmp = b.created_at.localeCompare(a.created_at);
      return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
    }
    case "created_asc": {
      const cmp = a.created_at.localeCompare(b.created_at);
      return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
    }
    case "updated_desc": {
      const cmp = b.updated_at.localeCompare(a.updated_at);
      return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
    }
    case "updated_asc": {
      const cmp = a.updated_at.localeCompare(b.updated_at);
      return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
    }
    case "id_desc":
      return b.id.localeCompare(a.id);
    case "id_asc":
      return a.id.localeCompare(b.id);
  }
}

function notFound(detail: string): Response {
  const problem: ProblemBody = {
    type: "https://errors.rfc-api/not-found",
    title: "Not Found",
    status: 404,
    detail,
    request_id: faker.string.alphanumeric({ length: 26 }),
  };
  return HttpResponse.json(problem, {
    status: 404,
    headers: { "Content-Type": "application/problem+json" },
  });
}

function badRequest(detail: string): Response {
  const problem: ProblemBody = {
    type: "urn:rfc-api:problem:bad-request",
    title: "Bad Request",
    status: 400,
    detail,
    request_id: faker.string.alphanumeric({ length: 26 }),
  };
  return HttpResponse.json(problem, {
    status: 400,
    headers: { "Content-Type": "application/problem+json" },
  });
}

function matchesQuery(doc: Document, query: string): boolean {
  return (
    doc.title.toLowerCase().includes(query) ||
    (doc.body ?? "").toLowerCase().includes(query) ||
    doc.id.toLowerCase().includes(query)
  );
}

function expectString(value: string | readonly string[] | undefined): string {
  if (typeof value !== "string") {
    throw new Error("MSW handler: expected string URL param, got array/undefined");
  }
  return value;
}
