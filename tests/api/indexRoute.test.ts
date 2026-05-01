import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { loader } from "../../src/routes/_index";
import { server } from "./server";
import { setupMswLifecycle } from "../utils/msw";

setupMswLifecycle();

describe("/ index loader", () => {
  it("returns docs + parsed pagination cursors from the Link header", async () => {
    // Override the default fixture handler so we can assert prev *and*
    // next cursor parsing in the same response. The fixture handler
    // only emits `rel="next"`; rfc-api itself emits both rels when a
    // page is mid-stream.
    server.use(
      http.get("*/api/v1/docs", () =>
        HttpResponse.json([], {
          status: 200,
          headers: {
            link: '</api/v1/docs?cursor=abc&limit=24>; rel="next", </api/v1/docs?cursor=xyz&limit=24>; rel="prev"',
          },
        }),
      ),
    );

    const result = await loader({
      request: new Request("http://localhost/"),
      params: {},
      context: {},
    } as Parameters<typeof loader>[0]);

    expect(result.cursors.next).toBe("abc");
    expect(result.cursors.prev).toBe("xyz");
  });

  it("returns null cursors when the page fits in a single response", async () => {
    // Default route loader requests limit=24; the fixture corpus is
    // 8 docs, so the fixture-backed handler emits no Link header.
    const result = await loader({
      request: new Request("http://localhost/"),
      params: {},
      context: {},
    } as Parameters<typeof loader>[0]);

    expect(result.docs.length).toBe(8);
    expect(result.cursors.next).toBeNull();
    expect(result.cursors.prev).toBeNull();
  });

  it("forwards the cursor query param to listDocs", async () => {
    let observedCursor: string | null = null;
    server.use(
      // Capture the request cursor before responding — proves the
      // loader is plumbing the URL's `cursor` through to the client.
      http.get("*/api/v1/docs", ({ request }) => {
        observedCursor = new URL(request.url).searchParams.get("cursor");
        return HttpResponse.json([], { status: 200 });
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
