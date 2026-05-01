/**
 * RFC 5988 `Link` header parsing for rfc-api cursor pagination.
 *
 * rfc-api emits `Link: <url>; rel="next"` / `rel="prev"` per the
 * integration reference (`docs/integration/rfc-api-reference.md`). We
 * extract just the cursor query param off each URL so the route can
 * render `?cursor=<opaque>` links without re-encoding the absolute URL.
 */

export interface PaginationCursors {
  readonly next: string | null;
  readonly prev: string | null;
}

const linkEntry = /<([^>]+)>\s*;\s*rel="([^"]+)"/g;

export function parseLinkHeader(headerValue: string | null): PaginationCursors {
  if (!headerValue) return { next: null, prev: null };

  let next: string | null = null;
  let prev: string | null = null;

  for (const match of headerValue.matchAll(linkEntry)) {
    const url = match[1];
    const rel = match[2];
    if (!url || !rel) continue;
    const cursor = extractCursor(url);
    if (cursor === null) continue;
    if (rel === "next") next = cursor;
    if (rel === "prev") prev = cursor;
  }

  return { next, prev };
}

function extractCursor(url: string): string | null {
  try {
    const parsed = new URL(url, "http://localhost");
    return parsed.searchParams.get("cursor");
  } catch {
    return null;
  }
}
