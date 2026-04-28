import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import type { Document } from "../../src/portal/api/__generated__/model";

/**
 * Shared MSW server for API integration tests.
 *
 * `tests/api/*.test.tsx` files import this and call `mockGetDoc`,
 * `mockListDocs`, `mockProblem` etc. to layer per-test handlers on
 * top of the shared instance. Lifecycle is wired by each test file
 * (beforeAll/afterEach/afterAll) to keep handlers from leaking.
 */
export const server = setupServer();

export const fixtureDoc: Document = {
  id: "RFC-0001",
  type: "rfc",
  title: "Adopt portal frontend stack",
  status: "Accepted",
  authors: [{ name: "Donald Gifford", handle: "donaldgifford" }],
  created_at: "2025-12-01T00:00:00Z",
  updated_at: "2026-04-20T00:00:00Z",
  body: "## Decision\n\nReact 19 + RR7 + TanStack Query + orval.",
  source: { repo: "donaldgifford/rfc-site", path: "docs/rfc/0001.md" },
};

export function mockGetDoc(doc: Document, status = 200): void {
  server.use(http.get("*/api/v1/:type/:id", () => HttpResponse.json(doc, { status })));
}

export function mockProblem(
  endpoint: "getDoc" | "listDocs",
  status: number,
  body: Record<string, unknown>,
): void {
  const url = endpoint === "getDoc" ? "*/api/v1/:type/:id" : "*/api/v1/docs";
  server.use(
    http.get(url, () =>
      HttpResponse.json(body, {
        status,
        headers: { "content-type": "application/problem+json" },
      }),
    ),
  );
}

export function mockListDocs(docs: Document[], headers: Record<string, string> = {}): void {
  server.use(http.get("*/api/v1/docs", () => HttpResponse.json(docs, { status: 200, headers })));
}
