import { describe, expect, it } from "vitest";
import { loader } from "../../src/routes/$type.$id";
import { fixtureDoc, mockGetDoc, mockProblem } from "./server";
import { setupMswLifecycle } from "../utils/msw";

setupMswLifecycle();

describe("$type.$id loader", () => {
  it("returns the parsed Document on a 200 response", async () => {
    mockGetDoc(fixtureDoc);

    const result = await loader({
      request: new Request("http://localhost/rfc/RFC-0001"),
      params: { type: "rfc", id: "RFC-0001" },
      context: {},
    } as Parameters<typeof loader>[0]);

    expect(result.id).toBe("RFC-0001");
    expect(result.title).toBe("Adopt portal frontend stack");
  });

  it("throws a 404 Response with the problem+json payload for ErrNotFound", async () => {
    mockProblem("getDoc", 404, {
      type: "/problems/not-found",
      title: "Resource not found",
      status: 404,
      detail: "rfc RFC-9999 not found",
      instance: "/api/v1/rfc/9999",
      request_id: "01HTZ-NOT-FOUND",
    });

    let thrown: unknown;
    try {
      await loader({
        request: new Request("http://localhost/rfc/RFC-9999"),
        params: { type: "rfc", id: "RFC-9999" },
        context: {},
      } as Parameters<typeof loader>[0]);
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(Response);
    const response = thrown as Response;
    expect(response.status).toBe(404);
    const payload = (await response.json()) as { type: string; request_id?: string };
    expect(payload.type).toBe("/problems/not-found");
    expect(payload.request_id).toBe("01HTZ-NOT-FOUND");
  });

  it("throws a 500 Response with request_id surfaced for ErrInternal", async () => {
    mockProblem("getDoc", 500, {
      type: "/problems/internal",
      title: "Internal server error",
      status: 500,
      request_id: "01HTZ-INTERNAL",
    });

    let thrown: unknown;
    try {
      await loader({
        request: new Request("http://localhost/rfc/RFC-0001"),
        params: { type: "rfc", id: "RFC-0001" },
        context: {},
      } as Parameters<typeof loader>[0]);
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(500);
    const payload = (await (thrown as Response).json()) as { request_id?: string };
    expect(payload.request_id).toBe("01HTZ-INTERNAL");
  });
});
