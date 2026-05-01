/**
 * MSW request handlers for `API_MODE=msw` dev mode (IMPL-0002 Phase 3).
 *
 * Endpoints implemented:
 *
 * - `GET /api/v1/docs` — paginated cross-type list (`Link` header).
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
 * **Faker seeding.** A deterministic seed is set at module load so
 * the tiny non-structural filler (request ids, default author names)
 * is stable across reloads. PLAN-0001 Resolved Q3.
 */

import { faker } from "@faker-js/faker";
import { http, HttpResponse } from "msw";
import type { Document } from "../__generated__/model";
import { canonicalFromUrl } from "../docId";
import { byType, findById, loadFixtures } from "./fixtures";

faker.seed(0xdec1a55);

const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 200;

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
    const all = await loadFixtures();
    const url = new URL(request.url);
    const slice = paginate(all, url.searchParams);
    return jsonWithLinkHeader(slice, url);
  }),

  http.get("*/api/v1/search", async ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const all = await loadFixtures();
    const filtered = query ? all.filter((d) => matchesQuery(d, query)) : all;
    const slice = paginate(filtered, url.searchParams);
    return jsonWithLinkHeader(slice, url);
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
