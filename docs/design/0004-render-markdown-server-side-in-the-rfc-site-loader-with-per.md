---
id: DESIGN-0004
title: "Render Markdown server-side in the rfc-site loader with per-commit caching"
status: Draft
author: Donald Gifford
created: 2026-05-18
---
<!-- markdownlint-disable-file MD025 MD041 -->

# DESIGN 0004: Render Markdown server-side in the rfc-site loader with per-commit caching

**Status:** Draft
**Author:** Donald Gifford
**Date:** 2026-05-18

<!--toc:start-->
- [Overview](#overview)
- [Goals and Non-Goals](#goals-and-non-goals)
  - [Goals](#goals)
  - [Non-Goals](#non-goals)
- [Background](#background)
  - [How rendering works today](#how-rendering-works-today)
  - [Plugin chain that must survive the move](#plugin-chain-that-must-survive-the-move)
- [Detailed Design](#detailed-design)
  - [1. New module: src/portal/markdown/renderMarkdown.ts](#1-new-module-srcportalmarkdownrendermarkdownts)
  - [2. New plugin: resolve-anchor-links](#2-new-plugin-resolve-anchor-links)
  - [3. Loader integration: $type.$id.tsx](#3-loader-integration-typeidtsx)
  - [4. Cache module: src/portal/markdown/renderCache.ts](#4-cache-module-srcportalmarkdownrendercachets)
  - [5. <DocumentView> becomes thin](#5-documentview-becomes-thin)
  - [6. Mermaid hydration](#6-mermaid-hydration)
  - [7. Visual parity with the mockup](#7-visual-parity-with-the-mockup)
    - [Code-block palette → Tokyo Night via CSS variables](#code-block-palette--tokyo-night-via-css-variables)
    - [Mermaid colors → mockup tokens](#mermaid-colors--mockup-tokens)
- [API / Interface Changes](#api--interface-changes)
- [Data Model](#data-model)
- [Testing Strategy](#testing-strategy)
  - [Unit tests (vitest)](#unit-tests-vitest)
  - [Integration tests](#integration-tests)
  - [Cache behaviour test (manual)](#cache-behaviour-test-manual)
- [Migration / Rollout Plan](#migration--rollout-plan)
  - [Phase 1 — Loader-side render (Option A baseline)](#phase-1--loader-side-render-option-a-baseline)
  - [Phase 2 — Per-commit cache (Option C)](#phase-2--per-commit-cache-option-c)
  - [Risk control](#risk-control)
  - [Rollback](#rollback)
- [Open Questions](#open-questions)
  - [Resolved — verification required during IMPL](#resolved--verification-required-during-impl)
  - [Resolved — folded into the design](#resolved--folded-into-the-design)
- [References](#references)
<!--toc:end-->

## Overview

Move the unified Markdown → HTML rendering pipeline out of the React component tree (where it runs client-side via `MarkdownHooks` + `<Suspense>`) and into the `$type.$id.tsx` loader. The loader returns a sanitized HTML string; `<DocumentView>` injects it via `dangerouslySetInnerHTML`. A process-local cache keyed by `${doc.id}@${doc.source.commit}` ensures hot reads skip the render. Eliminates the visible article-area redraw on hard refresh and unblocks future page-weight reductions by removing the Markdown pipeline from the client bundle.

## Goals and Non-Goals

### Goals

- **Eliminate the post-hydration article redraw.** Hard-refresh of `/{type}/{id}` arrives with the article body in the initial HTML payload, fully painted.
- **Skip the render on warm reads.** Process-local cache keyed by `(doc.id, source.commit)` short-circuits the pipeline when the doc hasn't changed since last render.
- **Preserve every existing pipeline behaviour.** Same plugin chain, same sanitize schema. Visual parity bar is the **mockup**, not the current implementation — see §Visual parity with the mockup.
- **Align code-block + mermaid colors with the mockup.** Current implementation ships Shiki's `github-dark` palette with inline hex colors. The mockup uses the Tokyo Night palette driven by `--code-*` design tokens (mockup §49-61). This migration is the opportunity to close that gap.
- **Keep cross-document link resolution working.** The `links[]`-driven `<Anchor>` behaviour (DESIGN-0002 §Cross-document link resolution) must survive the move.
- **Mermaid still renders.** The client-side mermaid hydration for `[data-mermaid-source]` blocks continues to work post-migration, themed against `--bg-raised` / `--border-hairline` per the mockup's `.mermaid-diagram` container styling (mockup §1157-1167).

### Non-Goals

- **rfc-api changes.** Out of scope per INV-0004 — rfc-api stays a raw-Markdown data API.
- **Pre-rendering at build time.** This is request-time SSR caching, not static export. New docs land via webhook → cache miss on next request → render on demand.
- **Distributed cache.** Process-local only. A single rfc-site replica's warm cache is the unit; multiple replicas each warm independently. Distributed caching becomes interesting at deployment-replica counts we're not at.
- **Theme switching at runtime.** Today the site is dark-only (`<html data-theme="dark">`, CLAUDE.md §Hard rules). The cached HTML is the dark-theme render. If/when light theme is wanted, the cache key extends to include theme.
- **Markdown rendering in `<Snippet>`** (search result HTML). That path stays client-side; snippets are small, already pre-sanitized by rfc-api, and don't share the cold-start cost.

## Background

[INV-0004](../investigation/0004-eliminate-the-rfc-page-render-flash-on-hard-refresh.md) settled the question of *where* to render: rfc-site loader (Option A) with per-commit caching (Option C). The trigger was a user observation on 2026-05-17 that the RFC body content visibly redraws after hard refresh. Inspection of the Oxide RFD site (`https://rfd.shared.oxide.computer/rfd/0004`) confirmed that React Router v7 SSR with a pre-rendered article body is a working pattern at production scale; we just don't use it yet.

### How rendering works today

`src/portal/markdown/DocumentView.tsx`:

```tsx
<Suspense fallback={null}>
  <MarkdownHooks
    remarkPlugins={remarkPlugins}
    rehypePlugins={rehypePlugins}
    components={{ a: Anchor, pre: Pre }}
  >
    {document.body ?? ""}
  </MarkdownHooks>
</Suspense>
```

`MarkdownHooks` is the `use()`-backed variant of `react-markdown`. It exists specifically because `@shikijs/rehype` is async — Shiki loads themes and language grammars on demand. The Suspense boundary lets SSR stream the pipeline result once Shiki resolves. In practice, the streamed chunk arrives noticeably late on cold sessions, producing the visible redraw.

### Plugin chain that must survive the move

From `src/portal/markdown/pipeline.ts`:

| Phase | Plugin | What it does |
|-------|--------|--------------|
| remark | `remark-gfm` | GFM tables / strikethrough / task lists |
| remark | `strip-docz-boilerplate` | drop tooling artefacts (markdownlint comments, auto-TOC blocks) |
| remark | `remark-github-alerts` | `> [!NOTE\|WARNING\|TIP\|CAUTION\|IMPORTANT]` → `<div class="admonition <kind>">` |
| rehype | `rehype-slug` | add `id` to headings |
| rehype | `rehype-autolink-headings` | prepend a `<a class="heading-anchor">` to each heading |
| rehype | `mermaid-marker` | tag `language-mermaid` blocks before Shiki sees them |
| rehype | `@shikijs/rehype` | syntax-highlight everything else |
| rehype | `normalize-hast-properties` | bridge Shiki's HTML attr names → hast camelCase |
| rehype | `rehype-sanitize` (extended schema) | LAST line of defence |

Two React component overrides also currently apply through react-markdown's `components` prop:

- `a → <Anchor>` — uses `useDocumentLinks()` to resolve cross-document `href`s against the doc's `links[]` array. This is the load-bearing handler for `[RFC-0001](./0001-...)` style cross-references.
- `pre → <Pre>` — splits between mermaid (rendered client-side via the mermaid lib) and plain code (Shiki output). Reads `data-mermaid-source` written by the mermaid-marker plugin.

These overrides are the main complication: `dangerouslySetInnerHTML` doesn't run React component overrides. The design must replace them with build-time/server-time equivalents.

## Detailed Design

### 1. New module: `src/portal/markdown/renderMarkdown.ts`

Pure, isomorphic function. Takes a `Document`, returns an HTML string. Runs the full unified pipeline plus two new server-time rehype passes that subsume the React component overrides.

```ts
// src/portal/markdown/renderMarkdown.ts
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { remarkPlugins, rehypePlugins } from "./pipeline";
import { resolveAnchorLinks } from "./plugins/resolve-anchor-links";
import type { Document } from "../api/__generated__/model";

const pipeline = unified()
  .use(remarkParse)
  .use(remarkPlugins)
  .use(remarkRehype, { allowDangerousHtml: false })
  .use(rehypePlugins)
  .use(resolveAnchorLinks)   // NEW — replaces <Anchor>'s link resolution
  .use(rehypeStringify);

export async function renderMarkdown(doc: Document): Promise<string> {
  const file = await pipeline.process({
    value: doc.body ?? "",
    data: { documentLinks: doc.links ?? [] },
  });
  return String(file);
}
```

**Notes:**
- `pipeline` is module-scoped — Shiki's theme + grammar caches live for the lifetime of the Node process. Cold-start cost is paid once per process, not per request.
- The two existing rehype `rehype-sanitize` and `normalize-hast-properties` passes stay where they are in `rehypePlugins`. We insert `resolveAnchorLinks` BEFORE sanitize so the sanitizer sees only the rewritten URLs.
- `pipeline.process(...)` is async because `@shikijs/rehype` is async. The loader awaits it.

### 2. New plugin: `resolve-anchor-links`

Replaces `<Anchor>`'s runtime React behaviour with a server-side rehype pass. Walks the hast tree, finds every `<a href="…">`, and rewrites the `href` against the document's `links[]` table using the existing `apiHrefToPortalRoute` logic from `src/portal/api/docId.ts`.

```ts
// src/portal/markdown/plugins/resolve-anchor-links.ts
import type { Plugin } from "unified";
import type { Root, Element } from "hast";
import { visit } from "unist-util-visit";
import { apiHrefToPortalRoute } from "../../api/docId";
import type { Link as DocLink } from "../../api/__generated__/model";

interface FileData { documentLinks?: readonly DocLink[]; }

export const resolveAnchorLinks: Plugin<[], Root> = function () {
  return (tree, file) => {
    const links = ((file.data as FileData).documentLinks) ?? [];
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "a") return;
      const href = node.properties?.href;
      if (typeof href !== "string") return;
      const portalRoute = apiHrefToPortalRoute(href, links);
      if (portalRoute) {
        node.properties = { ...node.properties, href: portalRoute, "data-cross-doc": "1" };
      }
      // External and broken-link sentinels handled by the existing
      // apiHrefToPortalRoute return semantics — see docId.ts.
    });
  };
};
```

A small client-side hydration script wraps `<a data-cross-doc="1">` clicks with React Router navigation. That script lives in `entry.client.tsx`'s post-hydrate hook (TBD whether a dedicated effect or just rely on RR7's existing intercept of internal hrefs — investigation during implementation).

### 3. Loader integration: `$type.$id.tsx`

```ts
// src/routes/$type.$id.tsx
import { renderMarkdownCached } from "../portal/markdown/renderCache";

export async function loader({ params }: LoaderArgs) {
  const doc = await fetchDoc(params.type, params.id);
  const bodyHtml = await renderMarkdownCached(doc);
  return { doc, bodyHtml };
}
```

### 4. Cache module: `src/portal/markdown/renderCache.ts`

```ts
// src/portal/markdown/renderCache.ts
import { renderMarkdown } from "./renderMarkdown";
import type { Document } from "../api/__generated__/model";

interface CacheEntry { html: string; lastAccess: number; }
const cache = new Map<string, CacheEntry>();
const MAX_ENTRIES = 256;           // ~5MB at average doc HTML size
const ENTRY_TTL_MS = 60 * 60_000;  // 1h hard TTL as a backstop

function cacheKey(doc: Document): string | null {
  const commit = doc.source?.commit;
  if (!commit) return null;        // unknown commit → bypass cache
  return `${doc.id}@${commit}`;
}

export async function renderMarkdownCached(doc: Document): Promise<string> {
  const key = cacheKey(doc);
  if (key !== null) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.lastAccess < ENTRY_TTL_MS) {
      hit.lastAccess = Date.now();
      return hit.html;
    }
  }
  const html = await renderMarkdown(doc);
  if (key !== null) {
    if (cache.size >= MAX_ENTRIES) evictOldest();
    cache.set(key, { html, lastAccess: Date.now() });
  }
  return html;
}

function evictOldest(): void {
  let oldestKey: string | null = null;
  let oldestAt = Infinity;
  for (const [k, v] of cache) {
    if (v.lastAccess < oldestAt) {
      oldestAt = v.lastAccess;
      oldestKey = k;
    }
  }
  if (oldestKey !== null) cache.delete(oldestKey);
}

// Test-only: clear cache between tests.
export function _clearRenderCache(): void { cache.clear(); }
```

**Cache invalidation:** automatic via the key. A webhook → re-ingest → new `source.commit` → next read sees a key miss → re-render. No explicit invalidation API needed, no stale risk.

**Memory budget:** at `MAX_ENTRIES = 256` and an average rendered RFC of ~20 KB HTML, the worst case is ~5 MB per replica. Well within the Node SSR process's memory budget. The LRU eviction is naive (linear scan) but `MAX_ENTRIES` is small enough that it doesn't matter.

**TTL backstop:** an entry that hasn't been read in an hour is dropped opportunistically on the next access. Prevents the cache holding rarely-accessed renders forever during long-lived process uptime.

### 5. `<DocumentView>` becomes thin

```tsx
// src/portal/markdown/DocumentView.tsx
import { useEffect } from "react";
import { hydrateMermaid } from "./mermaid-hydrate";

import "./styles.css";

interface DocumentViewProps { bodyHtml: string; }

export function DocumentView({ bodyHtml }: DocumentViewProps) {
  useEffect(() => { void hydrateMermaid(); }, [bodyHtml]);
  return (
    <article
      className="markdown-body"
      dangerouslySetInnerHTML={{ __html: bodyHtml }}
    />
  );
}
```

- `<Suspense>` gone.
- `<MarkdownHooks>` gone.
- `LinksContext` gone (link resolution happens server-side in `resolveAnchorLinks`).
- `<Anchor>` component gone (the `a` tag is rendered server-side with the resolved `href`).
- `<Pre>` component gone for code blocks (Shiki output is in the HTML string). Mermaid blocks are now hydrated by `hydrateMermaid()` walking `[data-mermaid-source]` elements after mount.

### 6. Mermaid hydration

```ts
// src/portal/markdown/mermaid-hydrate.ts
export async function hydrateMermaid(): Promise<void> {
  const blocks = document.querySelectorAll<HTMLElement>("[data-mermaid-source]");
  if (blocks.length === 0) return;
  const mermaid = await import("mermaid");
  mermaid.default.initialize({
    startOnLoad: false,
    theme: "base",
    themeVariables: mermaidThemeFromTokens(),
  });
  for (const block of blocks) {
    const source = block.getAttribute("data-mermaid-source") ?? "";
    const id = `mermaid-${Math.random().toString(36).slice(2)}`;
    try {
      const { svg } = await mermaid.default.render(id, source);
      block.classList.add("mermaid-diagram");
      block.innerHTML = svg;
    } catch (err) {
      block.textContent = "Failed to render diagram";
      console.error("[mermaid]", err);
    }
  }
}
```

- Lazy dynamic import — mermaid only ships to the client when the user lands on a doc that has at least one diagram.
- Runs in a `useEffect` so it's strictly client-side; SSR sends the `<pre data-mermaid-source="...">` placeholder unchanged.
- `theme: "base"` + `themeVariables` reads colors at hydration time from the document's computed `--code-*` / `--accent` / `--bg-raised` tokens so the SVG matches the mockup palette. Replaces the current hard-coded `theme: "dark"` (see CLAUDE.md §Phase 0 `<MermaidBlock>` change).
- `.mermaid-diagram` class is added to the placeholder so the mockup's container styling (mockup §1157-1167: `var(--bg-raised)` background, `var(--border-hairline)` border, `var(--r-sm)` radius, 32px/24px padding) applies.

### 7. Visual parity with the mockup

This migration is also the closing of two long-standing parity gaps:

#### Code-block palette → Tokyo Night via CSS variables

Today: `@shikijs/rehype` is configured with `themes: { light: "github-light", dark: "github-dark" }`. Shiki emits inline `style="color: #ABCDEF"` spans. Visually this drifts from the mockup, which uses the Tokyo Night palette (mockup §49-61):

| Token | Mockup value | Role |
|-------|--------------|------|
| `--code-bg` | `#161B28` | block background |
| `--code-fg` | `#C0CAF5` | default text |
| `--code-comment` | `#565F89` | comment (italic) |
| `--code-keyword` | `#BB9AF7` | keyword |
| `--code-function` | `#7AA2F7` | function / method |
| `--code-string` | `#9ECE6A` | string literal |
| `--code-number` | `#FF9E64` | number literal |
| `--code-type` | `#73DACA` | type |

Switch Shiki to **CSS-variables theme mode** (it has built-in support: `theme: 'css-variables'` or via `@shikijs/transformers`). Spans emit `style="color: var(--shiki-token-keyword)"` (or similar), and we map those Shiki token names to our `--code-*` tokens in `styles/tokens.css` (or via a one-pass alias block in the markdown prose stylesheet).

Same approach Oxide uses — the raw HTML from `rfd.shared.oxide.computer/rfd/0004` shows `<span style="color:var(--syntax-function)">` rather than inline hex.

**Token mapping (initial draft, to verify during IMPL):**

```css
/* in src/portal/markdown/styles.css */
.markdown-body {
  --shiki-token-keyword:   var(--code-keyword);
  --shiki-token-function:  var(--code-function);
  --shiki-token-string:    var(--code-string);
  --shiki-token-number:    var(--code-number);
  --shiki-token-comment:   var(--code-comment);
  --shiki-token-type:      var(--code-type);
  --shiki-token-constant:  var(--code-number);
  --shiki-token-parameter: var(--code-fg);
}
```

(The exact list of `--shiki-token-*` names depends on which transformer / theme mode we pick; this is a starting point, not a contract.)

#### Mermaid colors → mockup tokens

Today: `<MermaidBlock>` hard-codes `theme: "dark"` (Phase 0 of IMPL-0005). The resulting SVG uses mermaid's built-in dark palette, which doesn't match the mockup's container (`--bg-raised` background + `--border-hairline` border) or our text tokens.

The new `hydrateMermaid()` uses `theme: "base"` + `themeVariables` populated from `getComputedStyle(document.documentElement)` so node fills, edge colors, and text colors come from the actual `--code-*` / `--accent` / `--text-*` tokens. Mermaid's `themeVariables` accepts hex strings only, so we read the resolved values at hydration time rather than passing `var(--…)` references.

`mermaidThemeFromTokens()` (new helper) returns:

```ts
{
  primaryColor:      cssVar("--bg-raised"),
  primaryTextColor:  cssVar("--text-strong"),
  primaryBorderColor:cssVar("--border-hairline"),
  lineColor:         cssVar("--accent"),
  fontFamily:        "IBM Plex Mono, monospace",
  // ... (full list TBD during IMPL — depends on which mermaid node types
  //      our existing diagrams use; today: flowchart only)
}
```

This is a one-time read at first hydration. If the theme tokens change at runtime (they won't; dark-only per CLAUDE.md), the page would need a re-mount.

## API / Interface Changes

**rfc-api:** none. Same OpenAPI contract, same `Document.body` field.

**rfc-site internal API:**

- New module `src/portal/markdown/renderMarkdown.ts` — exports `renderMarkdown(doc): Promise<string>`.
- New module `src/portal/markdown/renderCache.ts` — exports `renderMarkdownCached(doc): Promise<string>`.
- New plugin `src/portal/markdown/plugins/resolve-anchor-links.ts`.
- New helper `src/portal/markdown/mermaid-hydrate.ts`.
- `DocumentView` prop changes: `{ document }` → `{ bodyHtml }`. Caller (`$type.$id.tsx`) passes through from loader data.
- `useDocumentLinks()` removed — no longer needed.
- `<Anchor>` component removed.
- `<Pre>` component reduced (mermaid path removed; plain-code path no longer needed since Shiki output is in the HTML string). Likely deletable in full.

## Data Model

N/A. No persisted state changes. Cache is process-local in-memory.

## Testing Strategy

### Unit tests (vitest)

- **`renderMarkdown.test.ts`** — fixture docs covering: GFM tables, admonitions (all 5 variants), mermaid blocks, syntax-highlighted code (yaml/go/sql), heading anchors, cross-doc links resolving against a `links[]` table, external links left alone, sanitization (script tags stripped). Snapshot-tested against expected HTML.
- **`resolve-anchor-links.test.ts`** — plugin in isolation: input hast tree + `links[]`, assert output `href`s.
- **`renderCache.test.ts`** — cache key generation, hit/miss behaviour, LRU eviction at `MAX_ENTRIES`, TTL backstop, `null` cache key when `source.commit` is missing.
- **`mermaid-hydrate.test.ts`** — jsdom + mocked `mermaid.render`. Assert SVG replaces the placeholder.

### Integration tests

- **`docPageRender.test.tsx`** (existing — needs an update). Switch from `document.body` source-driven assertions to `bodyHtml` assertions. The renderRoute helper loader now also produces `bodyHtml`.
- **Visual parity check (manual, gated on the implementation PR).** Side-by-side `before/after` screenshot of RFC-0001, RFC-0003 (mermaid), and RFC-0006 (admonitions + mermaid + tables). Document any pixel drift; the bar is zero diff modulo anti-aliasing.
- **No-flash check (manual).** Hard refresh of `/rfc/0001` in dev-msw — article body must be visible in the very first paint, not appear after hydration.

### Cache behaviour test (manual)

- Tail the server log with a small `console.time` instrumentation: first request to a doc → "render cache miss" + render time, subsequent requests → "render cache hit" with no render time. Confirm webhook-driven re-ingest results in a miss again.

## Migration / Rollout Plan

Phased within a single feature branch. Each phase ends with green tests + a working dev-msw smoke. No flag, no incremental production rollout — the change is internal to rfc-site.

### Phase 1 — Loader-side render (Option A baseline)

1. New modules: `renderMarkdown.ts`, `renderCache.ts`, `plugins/resolve-anchor-links.ts`, `mermaid-hydrate.ts` + tests.
2. Modify `pipeline.ts` to switch Shiki to CSS-variables theme mode + add the `--shiki-token-*` → `--code-*` alias block in the prose stylesheet.
3. Modify `$type.$id.tsx` loader to return `{ doc, bodyHtml }`.
4. Thin `DocumentView` to render `dangerouslySetInnerHTML` + run `useEffect(hydrateMermaid)`.
5. Delete `<Anchor>` + `<Pre>` + their tests (coverage moves to `renderMarkdown.test.ts` + `resolve-anchor-links.test.ts`).
6. **Verify OQ resolutions:** Shiki singleton instantiation (instrument + assert), RR7 streaming (view-source check on hard refresh).
7. **Visual diff check:** side-by-side `before/after` of RFC-0001, RFC-0003, RFC-0006. Capture diffs vs mockup, not vs current implementation. Note any token-coverage gaps that need a follow-up.

### Phase 2 — Per-commit cache (Option C)

1. Wire `renderMarkdownCached` into the loader. Add cache hit/miss instrumentation via `console.time`.
2. Manual cache-behavior verification: tail the SSR log across a sequence of (cold → warm → re-ingest → cold) requests.
3. Cache invalidation smoke: trigger an rfc-api worker run, confirm a subsequent rfc-site request shows a cache miss + re-render.

### Risk control

The existing `pipeline.ts` plugin arrays + sanitize schema are reused verbatim — the only **functional** changes in those modules are the Shiki theme switch (CSS variables) and the addition of `resolveAnchorLinks`. If anything drifts, it's:

1. Link resolution behaviour — full unit coverage in `resolve-anchor-links.test.ts`.
2. Shiki token coverage — caught by the visual diff check; gaps land as token aliases in the prose stylesheet.

### Rollback

Revert the PR. The pipeline chain itself doesn't change shape; rolling back returns to the `MarkdownHooks` + `<Suspense>` form with `github-dark` colors. The mockup-parity drift returns with it — that's acceptable as a rollback state since it's the current production behaviour.

## Open Questions

All four open questions resolved in a direction-setting conversation 2026-05-18. Resolutions captured here; verification is now a checkpoint in the IMPL.

### Resolved — verification required during IMPL

- **`@shikijs/rehype` instance reuse pattern.** **Resolution:** verify behaviour during IMPL Phase 1 by instrumenting `renderMarkdown.ts` with a counter on actual highlighter instantiation. **Acceptance:** the highlighter must be instantiated exactly once per Node process for the lifetime of `renderMarkdown.ts`'s module-level `pipeline` constant. If the unified plugin chain re-instantiates per `.process(...)` call, fall back to `createHighlighter({ themes, langs })` + manual transformer keyed off the explicit highlighter reference. **Why:** the warm-path latency target depends on this; a re-instantiation per request would make the per-commit cache the only thing preventing Shiki cold-start tax on every doc.

- **React Router v7 streaming behaviour with an awaiting loader.** **Resolution:** verify during IMPL Phase 1 with a real network capture of `/rfc/0001` and confirm the article body is in the **first byte** of the response, not a later streamed chunk. **Acceptance:** view-source on a hard refresh shows the rendered HTML in the initial document. If RR7 marks the route as deferred or chunks the article away from the layout, switch to an explicit `await` ordering in the loader that forces eager rendering, or move the route into a non-streaming entry. **Why:** the whole point of this design is that the article is in the initial paint — a streamed chunk that arrives 200ms later would defeat the migration.

### Resolved — folded into the design

- **External-link `rel` attributes.** **Resolution:** the `resolveAnchorLinks` plugin replicates `<Anchor>`'s current behaviour for links it does **not** rewrite to portal routes: external `http(s)://` hosts get `target="_blank" rel="noopener noreferrer"`; in-doc fragments (`#...`) are left alone; mailto/tel left alone. Captured here as a hard requirement; the plugin's test fixture has explicit cases for each branch.

- **Mockup parity for code blocks and mermaid.** **Resolution:** see §Visual parity with the mockup above. The migration includes the Shiki CSS-variables switch + the mermaid token-driven theming. This subsumes the earlier "mermaid theme on system theme change" question — theme is still dark-only (CLAUDE.md §Hard rules), but the colors now come from `--code-*` / `--bg-raised` / `--accent` tokens rather than being hard-coded in either Shiki's `github-dark` theme or mermaid's built-in `dark`. If/when we add a light theme later, swapping the tokens swaps the entire prose palette; the cache still doesn't need a theme dimension because the cached HTML references CSS variables, not resolved values.

## References

- [INV-0004](../investigation/0004-eliminate-the-rfc-page-render-flash-on-hard-refresh.md) — the investigation that decided the rendering seam.
- [DESIGN-0002](0002-markdown-rendering-pipeline.md) — the existing markdown pipeline. The plugin chain is preserved verbatim.
- [DESIGN-0003](0003-rebuild-rfc-site-against-the-mockup.md) — the rebuild plan that delivered the current client-side rendering shape; this DESIGN supersedes the rendering-location decision implicit in DESIGN-0003.
- [ADR-0001](../adr/0001-consume-rfc-api-via-its-published-openapi-contract.md) — the API contract discipline. This design respects it: zero rfc-api changes.
- **Mockup** — `~/code/design-system/rfc-portal-mockup_15.html`. Specifically §49-61 (`--code-*` token definitions), §782-995 (code-block prose styling using `var(--code-*)`), §1157-1167 (`.mermaid-diagram` container styling).
- [Oxide RFD site](https://rfd.shared.oxide.computer/rfd/0004) — existence proof of React Router v7 SSR with pre-rendered article body **and** CSS-variables-driven syntax highlighting (their spans emit `style="color:var(--syntax-function)"`).
