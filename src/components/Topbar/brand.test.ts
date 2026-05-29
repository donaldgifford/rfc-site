import { describe, expect, it } from "vitest";
import { deriveBrand } from "./brand";

describe("deriveBrand", () => {
  it.each([
    ["/", { mark: "R", name: "rfcs", sub: "directory" }],
    ["", { mark: "R", name: "rfcs", sub: "directory" }],
    ["/search", { mark: "R", name: "rfcs", sub: "search" }],
    ["/search?q=foo", { mark: "R", name: "rfcs", sub: "search" }],
    ["/api", { mark: "A", name: "api", sub: "reference" }],
    ["/api?endpoint=get:/api/v1/rfc", { mark: "A", name: "api", sub: "reference" }],
    ["/mcp", { mark: "M", name: "mcps", sub: "setup" }],
  ])("derives brand for %s", (pathname, expected) => {
    const brand = deriveBrand(pathname);
    expect(brand.mark).toBe(expected.mark);
    expect(brand.name).toBe(expected.name);
    expect(brand.sub).toBe(expected.sub);
  });

  it.each([
    ["/rfc/0001", "0001"],
    ["/adr/0042", "0042"],
    ["/design/0003", "0003"],
  ])("pulls the id into the sub label for doc routes: %s → %s", (pathname, expectedId) => {
    const brand = deriveBrand(pathname);
    expect(brand.sub).toBe(expectedId);
    expect(brand.name).toBe("rfcs");
  });

  it("falls back to rfcs / portal for unrecognised paths", () => {
    const brand = deriveBrand("/something-unknown");
    expect(brand).toMatchObject({ mark: "R", name: "rfcs", sub: "portal" });
  });

  it("maps each scope to a distinct accent token", () => {
    expect(deriveBrand("/").color).toContain("--accent");
    expect(deriveBrand("/api").color).toContain("--status-draft");
    expect(deriveBrand("/mcp").color).toContain("--status-superseded");
  });
});
