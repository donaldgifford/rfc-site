import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { loader } from "../../src/routes/_index";
import { fixtureDoc, mockListDocs, server } from "./server";

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe("/ index loader", () => {
  it("returns docs + parsed pagination cursors from the Link header", async () => {
    mockListDocs([fixtureDoc], {
      link: '</api/v1/docs?cursor=abc&limit=24>; rel="next", </api/v1/docs?cursor=xyz&limit=24>; rel="prev"',
    });

    const result = await loader({
      request: new Request("http://localhost/"),
      params: {},
      context: {},
    } as Parameters<typeof loader>[0]);

    expect(result.docs).toHaveLength(1);
    expect(result.docs[0]?.id).toBe("RFC-0001");
    expect(result.cursors.next).toBe("abc");
    expect(result.cursors.prev).toBe("xyz");
  });

  it("returns null cursors when no Link header is set", async () => {
    mockListDocs([fixtureDoc]);

    const result = await loader({
      request: new Request("http://localhost/"),
      params: {},
      context: {},
    } as Parameters<typeof loader>[0]);

    expect(result.cursors.next).toBeNull();
    expect(result.cursors.prev).toBeNull();
  });

  it("forwards the cursor query param to listDocs", async () => {
    let observedCursor: string | null = null;
    server.use(
      // Capture the request cursor before responding.
      (await import("msw")).http.get("*/api/v1/docs", ({ request }) => {
        observedCursor = new URL(request.url).searchParams.get("cursor");
        return new Response(JSON.stringify([fixtureDoc]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    await loader({
      request: new Request("http://localhost/?cursor=opaque-cursor-value"),
      params: {},
      context: {},
    } as Parameters<typeof loader>[0]);

    expect(observedCursor).toBe("opaque-cursor-value");
  });
});
