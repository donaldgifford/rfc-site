import { describe, expect, it } from "vitest";
import {
  findEndpoint,
  groupEndpointsByTag,
  listEndpoints,
  loadSpec,
  type Endpoint,
  type OpenApiSpec,
} from "../../../src/portal/openapi/loader";

describe("openapi loader", () => {
  it("loads the vendored api/openapi.yaml at build time", () => {
    const spec = loadSpec();
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info.title).toBe("rfc-api");
    expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
  });

  it("returns the same spec object on repeated calls (cached)", () => {
    const a = loadSpec();
    const b = loadSpec();
    expect(a).toBe(b);
  });

  it("flattens paths × methods into a sorted endpoint list", () => {
    const spec = loadSpec();
    const endpoints = listEndpoints(spec);
    // Every endpoint has a key in `method:path` form + a tag.
    for (const endpoint of endpoints) {
      expect(endpoint.key).toMatch(/^(get|post|put|patch|delete):/);
      expect(endpoint.tag.length).toBeGreaterThan(0);
    }
    // rfc-api ships at least 10 endpoints across docs / search / types / etc.
    expect(endpoints.length).toBeGreaterThanOrEqual(10);
  });

  it("groups endpoints by tag in their first-appearance order", () => {
    const spec = loadSpec();
    const groups = groupEndpointsByTag(listEndpoints(spec));
    const tags = groups.map((g) => g.tag);
    expect(tags).toContain("docs");
    expect(tags).toContain("search");
    // No empty groups.
    for (const group of groups) {
      expect(group.endpoints.length).toBeGreaterThan(0);
    }
  });

  it("findEndpoint resolves a key; returns undefined for unknown keys", () => {
    const endpoints = listEndpoints();
    const first = endpoints[0];
    expect(first).toBeDefined();
    if (!first) throw new Error("expected at least one endpoint");
    expect(findEndpoint(endpoints, first.key)).toBe(first);
    expect(findEndpoint(endpoints, "get:/nope")).toBeUndefined();
    expect(findEndpoint(endpoints, null)).toBeUndefined();
    expect(findEndpoint(endpoints, undefined)).toBeUndefined();
  });

  it("preserves parameter + response metadata on the endpoint operation", () => {
    const endpoints = listEndpoints();
    // GET /api/v1/{type}/{id} has both path params and documented responses.
    const target = endpoints.find((e) => e.path === "/api/v1/{type}/{id}" && e.method === "get");
    if (!target) throw new Error("expected GET /api/v1/{type}/{id} in the vendored spec");
    const operation: Endpoint["operation"] = target.operation;
    const params = operation.parameters;
    expect(params.some((p) => p.name === "type" && p.in === "path")).toBe(true);
    expect(params.some((p) => p.name === "id" && p.in === "path")).toBe(true);
    expect(Object.keys(operation.responses).length).toBeGreaterThan(0);
  });

  it("groupEndpointsByTag handles an empty endpoint list", () => {
    const groups = groupEndpointsByTag([]);
    expect(groups).toEqual([]);
  });

  it("listEndpoints accepts a custom spec for testing", () => {
    const fixture: OpenApiSpec = {
      openapi: "3.1.0",
      info: { title: "fixture", version: "0.0.1" },
      paths: {
        "/x": {
          get: { tags: ["X"], summary: "fetch x" },
          post: { tags: ["X"], summary: "create x" },
        },
        "/y": {
          get: { tags: ["Y"], summary: "fetch y" },
        },
      },
    };
    const endpoints = listEndpoints(fixture);
    expect(endpoints.length).toBe(3);
    expect(endpoints.map((e) => e.key)).toEqual(["get:/x", "post:/x", "get:/y"]);
  });
});
