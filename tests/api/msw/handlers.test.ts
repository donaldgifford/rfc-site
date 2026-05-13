import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";

import { handlers } from "../../../src/portal/api/msw/handlers";
import { _resetCacheForTests } from "../../../src/portal/api/msw/fixtures";
import { parseLinkHeader } from "../../../src/portal/api/pagination";

const BASE_URL = "http://rfc-api.test";

const server = setupServer(...handlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.resetHandlers();
  _resetCacheForTests();
});
afterAll(() => {
  server.close();
});

describe("MSW handlers — getDoc", () => {
  it("returns a fixture by (type, urlId) per the OpenAPI contract", async () => {
    // URL `:id` is the bare numeric form ("0001"); the handler
    // reconstructs the canonical id ("RFC-0001") server-side.
    const response = await fetch(`${BASE_URL}/api/v1/rfc/0001`);
    expect(response.status).toBe(200);
    const doc = (await response.json()) as { id: string; type: string };
    expect(doc.id).toBe("RFC-0001");
    expect(doc.type).toBe("rfc");
  });

  it("returns a 7807 ErrNotFound for unknown ids", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/rfc/9999`);
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toMatch(/application\/problem\+json/);
    const problem = (await response.json()) as {
      type: string;
      title: string;
      status: number;
      detail?: string;
      request_id?: string;
    };
    expect(problem.status).toBe(404);
    expect(problem.title).toBe("Not Found");
    // Detail surfaces the canonical id (constructed from type + urlId).
    expect(problem.detail).toContain("rfc/RFC-9999");
    expect(problem.request_id).toMatch(/^[A-Za-z0-9]+$/);
  });
});

describe("MSW handlers — listDocsByType", () => {
  it("returns the per-type fixtures sorted by id", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/rfc?limit=10`);
    expect(response.status).toBe(200);
    const docs = (await response.json()) as { id: string }[];
    expect(docs.map((d) => d.id)).toEqual(["RFC-0001", "RFC-0002"]);
  });

  it("returns a 7807 ErrNotFound for unknown types", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/nonexistent?limit=10`);
    expect(response.status).toBe(404);
    const problem = (await response.json()) as { detail?: string };
    expect(problem.detail).toContain("nonexistent");
  });
});

describe("MSW handlers — listDocs (pagination round-trip)", () => {
  it("traverses every fixture across pages with no duplicates or gaps", async () => {
    const seen = new Set<string>();
    let cursor: string | undefined = undefined;

    // Worst-case bound: more iterations than fixtures.
    for (let i = 0; i < 100; i++) {
      const url = new URL(`${BASE_URL}/api/v1/docs`);
      url.searchParams.set("limit", "3");
      if (cursor !== undefined) url.searchParams.set("cursor", cursor);

      const response = await fetch(url.href);
      expect(response.status).toBe(200);
      const page = (await response.json()) as { id: string; type: string }[];
      expect(page.length).toBeLessThanOrEqual(3);
      expect(page.length).toBeGreaterThan(0);

      for (const doc of page) {
        const key = `${doc.type}/${doc.id}`;
        expect(seen.has(key)).toBe(false); // no duplicates
        seen.add(key);
      }

      const parsed = parseLinkHeader(response.headers.get("Link"));
      if (parsed.next === null) break;
      cursor = parsed.next;
    }

    // 8 seeded fixtures across all types — assert full traversal.
    expect(seen.size).toBe(8);
  });

  it("does not emit a Link header when the result fits in one page", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/docs?limit=100`);
    expect(response.status).toBe(200);
    expect(response.headers.get("Link")).toBeNull();
  });

  it("preserves per-page Link target paths (no host hard-coded)", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/docs?limit=3`);
    const link = response.headers.get("Link");
    expect(link).not.toBeNull();
    // Target should start with /api/v1/docs and carry the cursor — no host.
    expect(link).toMatch(/^<\/api\/v1\/docs\?[^>]*cursor=[^>]+>;\s*rel="next"$/);
  });
});

describe("MSW handlers — listDocs filter + sort (Phase 7b)", () => {
  it("default sort is created_desc (mirrors rfc-api v0.3.0)", async () => {
    // The 8-fixture corpus has IMPL-0001 at 2026-04-21 (most recent) and
    // ADR-0001 at 2025-09-12 (oldest). Default sort surfaces the latest
    // first.
    const response = await fetch(`${BASE_URL}/api/v1/docs?limit=100`);
    expect(response.status).toBe(200);
    const docs = (await response.json()) as { id: string; created_at: string }[];
    expect(docs[0]?.id).toBe("IMPL-0001");
    expect(docs[docs.length - 1]?.id).toBe("ADR-0001");
  });

  it("single-type filter narrows the result set (and emits X-Total-Count-Unfiltered)", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/docs?filter=type:rfc&limit=100`);
    expect(response.status).toBe(200);
    const docs = (await response.json()) as { id: string; type: string }[];
    expect(docs.every((d) => d.type === "rfc")).toBe(true);
    expect(response.headers.get("X-Total-Count")).toBe(String(docs.length));
    // Header should be present iff a filter is active.
    expect(response.headers.get("X-Total-Count-Unfiltered")).toBe("8");
  });

  it("does NOT emit X-Total-Count-Unfiltered when no filter is active", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/docs?limit=100`);
    expect(response.headers.get("X-Total-Count-Unfiltered")).toBeNull();
    expect(response.headers.get("X-Total-Count")).toBe("8");
  });

  it("multi-value type filter is OR within field (RFC ∪ ADR)", async () => {
    const url = new URL(`${BASE_URL}/api/v1/docs`);
    url.searchParams.append("filter", "type:rfc");
    url.searchParams.append("filter", "type:adr");
    url.searchParams.set("limit", "100");

    const response = await fetch(url.href);
    expect(response.status).toBe(200);
    const docs = (await response.json()) as { type: string }[];
    expect(docs.every((d) => d.type === "rfc" || d.type === "adr")).toBe(true);
    expect(docs.some((d) => d.type === "rfc")).toBe(true);
    expect(docs.some((d) => d.type === "adr")).toBe(true);
  });

  it("sort=id_asc orders alphabetically by canonical id", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/docs?sort=id_asc&limit=100`);
    const docs = (await response.json()) as { id: string }[];
    const ids = docs.map((d) => d.id);
    expect(ids).toEqual([...ids].sort());
  });

  it("Link rel=next preserves filter + sort across cursor pagination", async () => {
    // 2 RFC fixtures; limit=1 forces a Link header on page 1.
    const response = await fetch(
      `${BASE_URL}/api/v1/docs?filter=type:rfc&sort=updated_asc&limit=1`,
    );
    expect(response.status).toBe(200);
    const link = response.headers.get("Link");
    expect(link).not.toBeNull();
    expect(link).toMatch(/filter=type%3Arfc/);
    expect(link).toMatch(/sort=updated_asc/);

    // Follow the rel=next link and assert the second page stays inside
    // the filtered+sorted view.
    const nextHref = link?.match(/^<([^>]+)>/)?.[1];
    expect(nextHref).toBeDefined();
    if (nextHref === undefined) return;
    const page2 = await fetch(`${BASE_URL}${nextHref}`);
    expect(page2.status).toBe(200);
    const docs2 = (await page2.json()) as { type: string }[];
    expect(docs2.every((d) => d.type === "rfc")).toBe(true);
  });

  it("returns 400 problem+json on malformed filter shape", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/docs?filter=garbled`);
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toMatch(/application\/problem\+json/);
    const problem = (await response.json()) as { status: number; detail?: string };
    expect(problem.status).toBe(400);
    expect(problem.detail).toContain("malformed filter");
  });

  it("returns 400 problem+json on unknown filter field", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/docs?filter=author:alice`);
    expect(response.status).toBe(400);
    const problem = (await response.json()) as { detail?: string };
    expect(problem.detail).toContain("unknown filter field: author");
  });

  it("returns 400 problem+json on unknown type value", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/docs?filter=type:zzz`);
    expect(response.status).toBe(400);
    const problem = (await response.json()) as { detail?: string };
    expect(problem.detail).toContain("unknown type: zzz");
  });

  it("returns 400 problem+json on out-of-range sort value", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/docs?sort=weird_order`);
    expect(response.status).toBe(400);
    const problem = (await response.json()) as { detail?: string };
    expect(problem.detail).toContain("sort value out of range: weird_order");
  });
});

describe("MSW handlers — searchDocs", () => {
  it("filters fixtures by substring against title / body / id and wraps in SearchResult envelopes", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/search?q=postgres&limit=10`);
    expect(response.status).toBe(200);
    const results = (await response.json()) as {
      document: { id: string };
      snippet?: string;
      matched_terms?: string[];
      score?: number;
    }[];
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.document.id === "ADR-0001")).toBe(true);
    // Per the OpenAPI contract, /search returns SearchResult[].
    const hit = results.find((r) => r.document.id === "ADR-0001");
    expect(hit?.snippet).toContain("postgres");
    expect(hit?.matched_terms).toContain("postgres");
    expect(typeof hit?.score).toBe("number");
  });

  it("returns the full corpus (still wrapped) when q is omitted", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/search?limit=100`);
    const results = (await response.json()) as { document: { id: string } }[];
    expect(results.length).toBe(8);
    expect(results[0]?.document.id).toMatch(/^[A-Z]+-[0-9]+$/);
  });
});
