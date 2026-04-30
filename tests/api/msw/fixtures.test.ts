import { afterEach, describe, expect, it } from "vitest";

import {
  _resetCacheForTests,
  byType,
  findById,
  loadFixtures,
} from "../../../src/portal/api/msw/fixtures";

afterEach(() => {
  _resetCacheForTests();
});

describe("fixture loader", () => {
  it("loads at least 6 fixtures from tests/examples/docs/", async () => {
    const docs = await loadFixtures();
    expect(docs.length).toBeGreaterThanOrEqual(6);
  });

  it("findById returns a seeded fixture by (type, id)", async () => {
    const doc = await findById("rfc", "RFC-0001");
    expect(doc).toBeDefined();
    expect(doc?.type).toBe("rfc");
    expect(doc?.id).toBe("RFC-0001");
    expect(doc?.title).toContain("MSW");
  });

  it("findById returns undefined for missing IDs", async () => {
    expect(await findById("rfc", "RFC-9999")).toBeUndefined();
    expect(await findById("nonexistent", "RFC-0001")).toBeUndefined();
  });

  it("byType returns the seeded RFC fixtures sorted by id", async () => {
    const rfcs = await byType("rfc");
    expect(rfcs.length).toBe(2);
    expect(rfcs.map((d) => d.id)).toEqual(["RFC-0001", "RFC-0002"]);
  });

  it("byType returns the seeded ADR fixtures sorted by id", async () => {
    const adrs = await byType("adr");
    expect(adrs.length).toBe(2);
    expect(adrs.map((d) => d.id)).toEqual(["ADR-0001", "ADR-0002"]);
  });

  it("byType returns an empty array for unknown types", async () => {
    expect(await byType("nonexistent")).toEqual([]);
  });

  it("populates the body field with the markdown after frontmatter", async () => {
    const doc = await findById("rfc", "RFC-0001");
    expect(doc?.body).toBeDefined();
    expect(doc?.body).toContain("# Adopt MSW-backed dev mode");
    // The raw frontmatter delimiters should NOT appear in the body.
    expect(doc?.body).not.toContain("\n---\n");
  });

  it("preserves required Document fields from frontmatter", async () => {
    const doc = await findById("adr", "ADR-0001");
    expect(doc).toMatchObject({
      id: "ADR-0001",
      type: "adr",
      status: "accepted",
    });
    expect(doc?.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(doc?.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(doc?.source.repo).toBe("donaldgifford/rfc-api");
  });

  it("caches the index — repeated calls return the same array reference", async () => {
    // The cache holds a single FixtureCache promise; every call to
    // loadFixtures resolves to the same `all` array. Object identity
    // (===) is the cheapest way to assert "no re-read happened" without
    // spying on ESM bindings (vitest can't replace read-only node:fs
    // exports).
    _resetCacheForTests();
    const first = await loadFixtures();
    const second = await loadFixtures();
    const third = await loadFixtures();
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it("rebuilds the cache after _resetCacheForTests()", async () => {
    const first = await loadFixtures();
    _resetCacheForTests();
    const second = await loadFixtures();
    // Different array references after a reset, but same content.
    expect(second).not.toBe(first);
    expect(second.length).toBe(first.length);
  });
});
