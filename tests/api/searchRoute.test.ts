import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";

import { loader } from "../../src/routes/search";
import { server } from "./server";
import { setupMswLifecycle } from "../utils/msw";
import { mockProblem } from "./server";

setupMswLifecycle();

describe("/search loader", () => {
  it("returns an empty result set without hitting the API when q is empty", async () => {
    let apiHit = false;
    server.use(
      http.get("*/api/v1/search", () => {
        apiHit = true;
        return HttpResponse.json([], { status: 200 });
      }),
    );

    const result = await loader({
      request: new Request("http://localhost/search"),
      params: {},
      context: {},
    } as Parameters<typeof loader>[0]);

    expect(apiHit).toBe(false);
    expect(result.q).toBe("");
    expect(result.results).toEqual([]);
  });

  it("forwards `q` to searchDocs and returns the result list", async () => {
    let observedQ: string | null = null;
    server.use(
      http.get("*/api/v1/search", ({ request }) => {
        observedQ = new URL(request.url).searchParams.get("q");
        return HttpResponse.json(
          [
            {
              document: {
                id: "RFC-0001",
                type: "rfc",
                title: "Adopt MSW-backed dev mode",
                status: "proposed",
                body: "",
                links: [],
                authors: [],
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-01-01T00:00:00Z",
                source: { repo: "x", path: "y", commit: "z" },
              },
              score: 0.9,
              snippet: "<em>postgres</em> mention",
              matched_terms: ["postgres"],
            },
          ],
          { status: 200 },
        );
      }),
    );

    const result = await loader({
      request: new Request("http://localhost/search?q=postgres"),
      params: {},
      context: {},
    } as Parameters<typeof loader>[0]);

    expect(observedQ).toBe("postgres");
    expect(result.q).toBe("postgres");
    expect(result.results.length).toBe(1);
    expect(result.results[0]?.document.id).toBe("RFC-0001");
  });

  it("propagates 7807 problems to <RouteErrorBoundary>", async () => {
    mockProblem("*/api/v1/search", 500, {
      type: "/problems/internal",
      title: "Internal server error",
      status: 500,
      request_id: "01HTZ-SEARCH-500",
    });

    await expect(
      loader({
        request: new Request("http://localhost/search?q=anything"),
        params: {},
        context: {},
      } as Parameters<typeof loader>[0]),
    ).rejects.toThrow();
  });

  it("returns the seeded fixture corpus when q matches against fixture content", async () => {
    // The shared MSW handlers back the search endpoint with the
    // IMPL-0002 fixture corpus — `postgres` matches ADR-0001.
    const result = await loader({
      request: new Request("http://localhost/search?q=postgres"),
      params: {},
      context: {},
    } as Parameters<typeof loader>[0]);

    expect(result.q).toBe("postgres");
    expect(result.results.length).toBeGreaterThanOrEqual(1);
    expect(result.results.some((r) => r.document.id === "ADR-0001")).toBe(true);
  });
});
