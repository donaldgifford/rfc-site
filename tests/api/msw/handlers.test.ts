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
  it("returns a fixture by (type, id)", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/rfc/RFC-0001`);
    expect(response.status).toBe(200);
    const doc = (await response.json()) as { id: string; type: string };
    expect(doc.id).toBe("RFC-0001");
    expect(doc.type).toBe("rfc");
  });

  it("returns a 7807 ErrNotFound for unknown ids", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/rfc/RFC-9999`);
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

describe("MSW handlers — searchDocs", () => {
  it("filters fixtures by substring against title / body / id", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/search?q=postgres&limit=10`);
    expect(response.status).toBe(200);
    const docs = (await response.json()) as { id: string }[];
    expect(docs.length).toBeGreaterThanOrEqual(1);
    expect(docs.some((d) => d.id === "ADR-0001")).toBe(true);
  });

  it("returns the full corpus when q is omitted", async () => {
    const response = await fetch(`${BASE_URL}/api/v1/search?limit=100`);
    const docs = (await response.json()) as unknown[];
    expect(docs.length).toBe(8);
  });
});
