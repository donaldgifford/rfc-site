import type { Document } from "../api/__generated__/model";
import { renderMarkdown } from "./renderMarkdown";

/**
 * Process-local render cache (IMPL-0006 Phase 6 / DESIGN-0004 §4).
 *
 * Caches `renderMarkdown(doc)` output keyed by `${doc.id}@${doc.source.commit}`.
 * A doc's content is immutable for the lifetime of a given commit, so the
 * key safely identifies a unique rendered HTML body. A new ingest in
 * `rfc-api` produces a new `source.commit`, which produces a new key —
 * the old entry never matches again and falls out under LRU pressure.
 *
 * Bounds:
 *   - MAX_ENTRIES: hard cap, LRU-evicted on overflow.
 *   - ENTRY_TTL_MS: 1 hour. Belt-and-braces backstop in case a commit
 *     gets reused (rare — only a force-push to a content branch could
 *     do it) or if a long-running Node process accumulates entries
 *     that haven't been touched in ages.
 *
 * Bypass: docs without `source.commit` (legacy fixtures, in-flight
 * uploads) re-render every call. Better to pay the render cost than
 * serve stale HTML keyed by a non-unique identifier.
 */

const MAX_ENTRIES = 256;
const ENTRY_TTL_MS = 60 * 60_000;

interface CacheEntry {
  html: string;
  lastAccess: number;
}

const cache = new Map<string, CacheEntry>();

export function cacheKey(doc: Document): string | null {
  const commit = doc.source.commit;
  if (typeof commit !== "string" || commit.length === 0) return null;
  return `${doc.id}@${commit}`;
}

export async function renderMarkdownCached(doc: Document): Promise<string> {
  const key = cacheKey(doc);
  if (key === null) {
    return renderMarkdown(doc);
  }

  const now = Date.now();
  const hit = cache.get(key);
  if (hit !== undefined && now - hit.lastAccess < ENTRY_TTL_MS) {
    // LRU touch — `Map` preserves insertion order, so deleting + re-
    // setting moves the entry to the back of the iteration order.
    // Eviction (on overflow) takes from the front.
    cache.delete(key);
    cache.set(key, { html: hit.html, lastAccess: now });
    return hit.html;
  }

  // Miss (or TTL-stale). Compute and store.
  const html = await renderMarkdown(doc);
  cache.set(key, { html, lastAccess: now });

  // Evict the oldest if we've exceeded the cap. `Map.keys().next()`
  // yields the first-inserted key, which is the LRU under our
  // delete+set bump scheme.
  if (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) {
      cache.delete(oldest.value);
    }
  }
  return html;
}

// Test-only — reset the module state between tests. Production callers
// must NOT use this.
export function _clearRenderCache(): void {
  cache.clear();
}

// Test-only — expose the current cache size for assertions.
export function _renderCacheSize(): number {
  return cache.size;
}

// Test-only — expose MAX_ENTRIES / ENTRY_TTL_MS so tests can verify
// bounds without hardcoding them.
export const _RENDER_CACHE_LIMITS = {
  MAX_ENTRIES,
  ENTRY_TTL_MS,
} as const;
