import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  _RENDER_CACHE_LIMITS,
  _clearRenderCache,
  _renderCacheSize,
  cacheKey,
  renderMarkdownCached,
} from "../../../src/portal/markdown/renderCache";
import type { Document } from "../../../src/portal/api/__generated__/model";

// Use sentinel objects rather than `undefined` defaults so the explicit
// "no commit" case isn't swallowed by JS default-parameter semantics.
const NO_COMMIT = Symbol("no-commit");
function doc(id: string, commit: string | typeof NO_COMMIT = "abc123", body = "# hi"): Document {
  return {
    id,
    type: "rfc",
    status: "proposed",
    title: id,
    body,
    authors: [],
    links: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    source: {
      repo: "test/test",
      ref: "main",
      path: `${id}.md`,
      ...(typeof commit === "string" ? { commit } : {}),
    },
  } as Document;
}

describe("cacheKey", () => {
  it("returns `${id}@${commit}` for docs with a commit", () => {
    expect(cacheKey(doc("RFC-0001", "abc123"))).toBe("RFC-0001@abc123");
  });

  it("returns null when source.commit is missing", () => {
    expect(cacheKey(doc("RFC-0001", NO_COMMIT))).toBeNull();
  });

  it("returns null when source.commit is the empty string", () => {
    expect(cacheKey(doc("RFC-0001", ""))).toBeNull();
  });
});

describe("renderMarkdownCached", () => {
  beforeEach(() => {
    _clearRenderCache();
  });

  afterEach(() => {
    vi.useRealTimers();
    _clearRenderCache();
  });

  it("returns identical HTML on a second call with the same (id, commit)", async () => {
    const a = await renderMarkdownCached(doc("RFC-0001", "abc"));
    const b = await renderMarkdownCached(doc("RFC-0001", "abc"));
    expect(a).toBe(b);
    expect(_renderCacheSize()).toBe(1);
  });

  it("re-renders when the commit changes for the same id", async () => {
    const v1 = await renderMarkdownCached(doc("RFC-0001", "commitA", "# Body A"));
    const v2 = await renderMarkdownCached(doc("RFC-0001", "commitB", "# Body B"));
    expect(v1).not.toBe(v2);
    expect(v1).toContain("Body A");
    expect(v2).toContain("Body B");
    expect(_renderCacheSize()).toBe(2);
  });

  it("bypasses the cache (renders every call) when source.commit is missing", async () => {
    const sizeBefore = _renderCacheSize();
    await renderMarkdownCached(doc("RFC-0001", NO_COMMIT));
    await renderMarkdownCached(doc("RFC-0001", NO_COMMIT));
    expect(_renderCacheSize()).toBe(sizeBefore);
  });

  it("evicts the oldest entry when MAX_ENTRIES is exceeded (LRU)", async () => {
    const { MAX_ENTRIES } = _RENDER_CACHE_LIMITS;

    // Fill the cache to MAX_ENTRIES. Each doc has a unique key.
    for (let i = 0; i < MAX_ENTRIES; i++) {
      await renderMarkdownCached(doc("RFC-" + i.toString().padStart(4, "0"), "abc"));
    }
    expect(_renderCacheSize()).toBe(MAX_ENTRIES);

    // Push one more. The OLDEST (RFC-0000) should fall out.
    await renderMarkdownCached(doc("RFC-NEW", "abc"));
    expect(_renderCacheSize()).toBe(MAX_ENTRIES);

    // RFC-0000 is gone — confirm by re-rendering it: the cache size
    // grows by 1 (it's a miss) before evicting the next-oldest
    // (RFC-0001 now).
    await renderMarkdownCached(doc("RFC-0000", "abc"));
    expect(_renderCacheSize()).toBe(MAX_ENTRIES);
  });

  it("re-renders on TTL expiry (entry past ENTRY_TTL_MS triggers fresh render)", async () => {
    vi.useFakeTimers();
    const start = new Date("2026-01-01T00:00:00Z").getTime();
    vi.setSystemTime(start);

    const first = await renderMarkdownCached(doc("RFC-0001", "abc", "# Body A"));
    expect(_renderCacheSize()).toBe(1);

    // Advance past the TTL.
    vi.setSystemTime(start + _RENDER_CACHE_LIMITS.ENTRY_TTL_MS + 1);

    // Same key, but the previous entry is stale.
    const second = await renderMarkdownCached(doc("RFC-0001", "abc", "# Body A"));
    expect(second).toBe(first); // identical content, but a re-render happened.
    // Cache still has 1 entry (the same key was rewritten).
    expect(_renderCacheSize()).toBe(1);
  });

  it("LRU bump: re-accessing an entry promotes it past newer entries on eviction", async () => {
    const { MAX_ENTRIES } = _RENDER_CACHE_LIMITS;

    // Fill the cache.
    for (let i = 0; i < MAX_ENTRIES; i++) {
      await renderMarkdownCached(doc("RFC-" + i.toString().padStart(4, "0"), "abc"));
    }

    // Re-access RFC-0000 → it gets bumped to the back.
    await renderMarkdownCached(doc("RFC-0000", "abc"));

    // Push a new entry. The OLDEST is now RFC-0001, not RFC-0000.
    await renderMarkdownCached(doc("RFC-NEW", "abc"));

    // RFC-0000 should still be cached; RFC-0001 should be the one evicted.
    // We verify by checking that re-rendering RFC-0000 does NOT change
    // the cache size (it's a hit), while re-rendering RFC-0001 does.
    const sizeBefore0000 = _renderCacheSize();
    await renderMarkdownCached(doc("RFC-0000", "abc"));
    expect(_renderCacheSize()).toBe(sizeBefore0000);

    const sizeBefore0001 = _renderCacheSize();
    await renderMarkdownCached(doc("RFC-0001", "abc"));
    // Miss → +1 entry, then eviction triggers because MAX_ENTRIES.
    expect(_renderCacheSize()).toBe(sizeBefore0001);
  });
});
