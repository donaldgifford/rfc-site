---
id: IMPL-0006
title: "Render Markdown server-side in the rfc-site loader per DESIGN-0004"
status: Draft
author: Donald Gifford
created: 2026-05-18
---
<!-- markdownlint-disable-file MD025 MD041 -->

# IMPL 0006: Render Markdown server-side in the rfc-site loader per DESIGN-0004

**Status:** Draft
**Author:** Donald Gifford
**Date:** 2026-05-18

<!--toc:start-->
- [Objective](#objective)
- [Scope](#scope)
  - [In Scope](#in-scope)
  - [Reuse for Frameworks (forward-compatibility note)](#reuse-for-frameworks-forward-compatibility-note)
  - [Out of Scope](#out-of-scope)
- [Implementation Phases](#implementation-phases)
  - [Phase 1: Foundation — render function + anchor-resolution plugin](#phase-1-foundation--render-function--anchor-resolution-plugin)
    - [Tasks](#tasks)
    - [Success Criteria](#success-criteria)
  - [Phase 2: Mockup parity — Shiki CSS variables](#phase-2-mockup-parity--shiki-css-variables)
    - [Tasks](#tasks-1)
    - [Success Criteria](#success-criteria-1)
  - [Phase 3: Mermaid hydration + container styling](#phase-3-mermaid-hydration--container-styling)
    - [Tasks](#tasks-2)
    - [Success Criteria](#success-criteria-2)
  - [Phase 4: Cutover — loader + DocumentView + delete legacy components](#phase-4-cutover--loader--documentview--delete-legacy-components)
    - [Tasks](#tasks-3)
    - [Success Criteria](#success-criteria-3)
  - [Phase 5: Open-question verification + visual diff](#phase-5-open-question-verification--visual-diff)
    - [Tasks](#tasks-4)
    - [Success Criteria](#success-criteria-4)
  - [Phase 6: Per-commit cache](#phase-6-per-commit-cache)
    - [Tasks](#tasks-5)
    - [Success Criteria](#success-criteria-5)
- [File Changes](#file-changes)
  - [New files](#new-files)
  - [Modified files](#modified-files)
  - [Deleted files](#deleted-files)
- [Testing Plan](#testing-plan)
- [Dependencies](#dependencies)
- [Findings](#findings)
  - [Phase 1](#phase-1)
  - [Phase 2](#phase-2)
  - [Phase 3](#phase-3)
  - [Phase 4](#phase-4)
  - [Phase 5 — OQ verification](#phase-5--oq-verification)
  - [Phase 6 — cache instrumentation](#phase-6--cache-instrumentation)
- [Open Questions](#open-questions)
  - [OQ-1: rehype-sanitize ordering — pipeline.ts refactor approach ✅ RESOLVED](#oq-1-rehype-sanitize-ordering--pipelinets-refactor-approach--resolved)
  - [OQ-2: Cross-doc click navigation pattern ✅ RESOLVED](#oq-2-cross-doc-click-navigation-pattern--resolved)
  - [OQ-3: Language-badge chip on code blocks ✅ RESOLVED](#oq-3-language-badge-chip-on-code-blocks--resolved)
  - [OQ-4: Visual-diff fixture set + method ✅ RESOLVED](#oq-4-visual-diff-fixture-set--method--resolved)
  - [OQ-5: TOC behaviour with dangerouslySetInnerHTML ✅ RESOLVED](#oq-5-toc-behaviour-with-dangerouslysetinnerhtml--resolved)
- [References](#references)
<!--toc:end-->

## Objective

Execute [DESIGN-0004](../design/0004-render-markdown-server-side-in-the-rfc-site-loader-with-per.md): move the Markdown → HTML pipeline out of the React component tree and into the `$type.$id.tsx` loader; align code-block + mermaid colors with the mockup palette; add a per-commit cache so warm reads skip the render. Eliminates the visible article-area redraw on hard refresh.

**Implements:** [DESIGN-0004](../design/0004-render-markdown-server-side-in-the-rfc-site-loader-with-per.md). Resolves [INV-0004](../investigation/0004-eliminate-the-rfc-page-render-flash-on-hard-refresh.md).

## Scope

### In Scope

- New module `src/portal/markdown/renderMarkdown.ts` — pure, isomorphic, **doc-type-agnostic** server-side render function. Takes any `Document` (RFC today, Framework tomorrow); the pipeline doesn't care about `doc.type`.
- New module `src/portal/markdown/renderCache.ts` — process-local LRU + TTL cache keyed by `${doc.id}@${doc.source.commit}`. Also doc-type-agnostic.
- New plugin `src/portal/markdown/plugins/resolve-anchor-links.ts` — server-side replacement for `<Anchor>`'s link resolution logic.
- New helper `src/portal/markdown/mermaid-hydrate.ts` — client-side mermaid renderer driven by computed tokens.
- New helper `src/portal/markdown/cross-doc-nav.ts` — delegated click handler for `<a data-cross-doc="1">` to invoke RR7 navigation. **Per OQ-2 resolution:** Oxide doesn't use `dangerouslySetInnerHTML` (they render through a React component tree via `@oxide/react-asciidoc`) so their pattern doesn't transfer; for our HTML-injection approach the article-scoped click delegation is the right answer.
- Refactor `src/portal/markdown/pipeline.ts` — split the rehype plugin chain so `resolveAnchorLinks` can be inserted before `rehype-sanitize`. Per OQ-1 resolution, two-array split is accepted (the factory pattern would add ceremony without payoff at the one insertion point).
- Switch `@shikijs/rehype` config to CSS-variables theme mode.
- Add `--shiki-token-*` → `--code-*` alias block in `src/portal/markdown/styles.css`.
- Add the **language-badge chip** to code blocks per mockup §812-823 (CSS `::before` on `pre[data-language]`). Adapts the mockup selector from `data-lang` to `data-language` since that's what Shiki emits — semantically equivalent, just a naming choice.
- Add `.mermaid-diagram` container styling in `src/portal/markdown/styles.css` per mockup §1157-1167.
- Modify `src/routes/$type.$id.tsx` loader to return `{ doc, bodyHtml }`.
- Thin `src/portal/markdown/DocumentView.tsx` to `dangerouslySetInnerHTML` + mermaid hydration effect + cross-doc click delegation.
- Delete `src/portal/markdown/components/Anchor.tsx`, `Code.tsx`, `MermaidBlock.tsx` + their tests (coverage moves into the new pipeline + plugin tests).
- Update `tests/api/docPageRender.test.tsx` to assert against `bodyHtml`.
- Expand the visual-diff fixture set per OQ-4 (additional code languages + mermaid diagram types).

### Reuse for Frameworks (forward-compatibility note)

The Frameworks doc type (different layout, frontmatter-driven configuration, but Markdown body) will reuse every new module in this IMPL unchanged. `renderMarkdown(doc)` operates on `doc.body` + `doc.links`; the type field is opaque to the pipeline. The loader-level cache (`renderCache.ts`) is also doc-type-agnostic because the cache key includes the canonical id (`Framework-0001@...` vs `RFC-0001@...`). Frameworks-specific work — different sidebar shape, frontmatter-driven section layout — happens in the framework route component, not in the render pipeline.

### Out of Scope

- rfc-api changes. The Markdown contract stays raw.
- Build-time pre-rendering (static export).
- Distributed render cache.
- Light theme support (cache key extension reserved for future RFC).
- `<Snippet>` (search-result HTML) rendering — stays client-side; small surface, already pre-sanitized by rfc-api.

## Implementation Phases

Each phase builds on the previous one and ends with green tests + a working `just dev-msw` smoke. Commit per phase; the cutover (Phase 4) is the only phase whose user-visible behaviour shifts.

---

### Phase 1: Foundation — render function + anchor-resolution plugin

Build the new server-side render path **alongside** the existing client-side path. Nothing wired yet — Phase 1 is testable in isolation.

#### Tasks

- [ ] Refactor `src/portal/markdown/pipeline.ts`: split `rehypePlugins` into `rehypePluginsCore` (everything **before** sanitize) and `rehypeSanitizePlugin` (the configured `[rehypeSanitize, sanitizeSchema]` entry). Keep the existing `rehypePlugins` export as `[...rehypePluginsCore, rehypeSanitizePlugin]` so the current client-side path still works unchanged.
- [ ] Create `src/portal/markdown/plugins/resolve-anchor-links.ts`. Port `Anchor.tsx`'s semantics into a hast visitor:
  - Hash-only `href` (`#section-slug`) → leave alone.
  - Match `href` against `documentLinks[].target` then `documentLinks[].href` (`findLink` logic from Anchor.tsx:15-26). On match, rewrite `href` to `apiHrefToPortalRoute(link.href)` and add `data-cross-doc="1"`.
  - External `http(s)://` URLs that didn't match → add `target="_blank"` + `rel="noopener noreferrer"`.
  - Unmatched internal-looking href → replace the `<a>` node with a `<span data-broken-link>` carrying the original children + a `title` attribute (`"Unresolved link: <href>"`).
  - File data carries `documentLinks` via the `file.data` mechanism (set by the caller).
- [ ] Create `src/portal/markdown/renderMarkdown.ts`. Compose unified pipeline: `remarkParse → ...remarkPlugins → remarkRehype({allowDangerousHtml: false}) → ...rehypePluginsCore → resolveAnchorLinks → rehypeSanitizePlugin → rehypeStringify`. Module-scoped `pipeline` constant. Export `async function renderMarkdown(doc: Document): Promise<string>` that calls `pipeline.process({ value: doc.body ?? "", data: { documentLinks: doc.links ?? [] }})` and returns `String(file)`.
- [ ] Write `src/portal/markdown/plugins/resolve-anchor-links.test.ts`. Fixture cases:
  - Hash-only anchor passes through unchanged.
  - Cross-doc `target` match (canonical id form) → rewrites href + adds `data-cross-doc`.
  - Cross-doc `href` match (API URL form) → rewrites href + adds `data-cross-doc`.
  - External http(s) URL → adds `target`/`rel`.
  - Unmatched relative href → becomes `<span data-broken-link>`.
  - Anchor with no `href` → passes through unchanged.
- [ ] Write `tests/portal/markdown/renderMarkdown.test.ts`. Fixture corpus per DESIGN-0004 §Testing Strategy:
  - GFM table renders.
  - All 5 admonition variants (`NOTE/WARNING/TIP/CAUTION/IMPORTANT` → div class plus label span; `IMPORTANT` normalised to `note`).
  - Mermaid block emits `<pre data-mermaid-source="...">` placeholder (no Shiki on language-mermaid).
  - YAML / Go / SQL code block emits a `<pre class="shiki ...">` with `<span style="color:var(...)">` after Phase 2 lands — for Phase 1, just assert the block is present with `language-*` class.
  - Heading anchors prepended.
  - Cross-doc link resolves against a fixture `links[]` array.
  - External link emits `target="_blank" rel="noopener noreferrer"`.
  - Broken link emits `<span data-broken-link>`.
  - `<script>` injection → stripped by sanitize.

#### Success Criteria

- `just check` passes — typecheck + lint + format + all tests (existing 219 + new tests).
- `renderMarkdown(doc)` produces a non-empty HTML string for every fixture in `tests/examples/docs/`.
- The existing `<DocumentView>` client-side path still works (unchanged in behaviour) — `tests/api/docPageRender.test.tsx` passes unmodified.
- No new top-level dependencies installed (all of unified/remark-parse/remark-rehype/rehype-stringify/unist-util-visit already in `package.json`).

---

### Phase 2: Mockup parity — Shiki CSS variables

Switch `@shikijs/rehype` to emit CSS-variable references instead of inline hex colors, and map Shiki's token names to the mockup's `--code-*` tokens. The existing client-side path benefits from this immediately because it shares `pipeline.ts`.

#### Tasks

- [ ] Research `@shikijs/rehype` CSS-variables mode. Options to evaluate:
  - Pass `theme: 'css-variables'` (Shiki's built-in CSS-variables theme — emits `style="color: var(--shiki-token-...)"`).
  - Use `@shikijs/transformers`' `transformerStyleToCssVariables` or write a small custom transformer if the built-in theme's token names don't cover our palette.
- [ ] Switch `pipeline.ts`'s `rehypeShiki` config from `themes: { light: "github-light", dark: "github-dark" }` to the CSS-variables approach chosen above. Drop the light-theme entry (dark only per CLAUDE.md §Hard rules).
- [ ] Update `sanitizeSchema` if Shiki's CSS-variables mode emits any new attributes the schema doesn't already permit (it already permits `style`, `className`, `tabIndex`, `dataLanguage` on `pre`/`code`/`span`).
- [ ] Add `--shiki-token-*` → `--code-*` alias block in `src/portal/markdown/styles.css`. Initial mapping per DESIGN-0004 §7:
  ```css
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
  Verify and extend after running the actual fixtures — Shiki's full token-name list is theme-driven.
- [ ] **Language-badge chip on code blocks** (mockup §812-823). Per OQ-3 resolution, this lands in this migration since it's the canonical reading experience for `` ```go / ```bash / ```yaml `` etc. Implementation:
  - Confirm `<pre>` carries `data-language="<lang>"` after the pipeline runs. (Today's pipeline already emits this — sanitize schema permits `dataLanguage` on `pre`.)
  - Confirm `mermaid-marker` plugin still strips `data-language` from mermaid blocks (or ensure the badge selector excludes `data-language="mermaid"`).
  - Add to `src/portal/markdown/styles.css`:
    ```css
    .markdown-body pre[data-language] {
      position: relative;
    }
    .markdown-body pre[data-language]::before {
      content: attr(data-language);
      position: absolute;
      top: 10px;
      right: 14px;
      font-family: var(--font-mono);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: var(--code-type);
      opacity: 0.7;
    }
    .markdown-body pre[data-language="mermaid"]::before {
      content: none; /* mermaid container has its own caption affordance */
    }
    ```
- [ ] Update `renderMarkdown.test.ts` code-block assertions: spans inside `<pre class="shiki ...">` must use `style="color: var(...)"` rather than `style="color: #..."`; `<pre>` carries `data-language="<lang>"`.
- [ ] Update `tests/portal/markdown/components/Code.test.tsx` for the new output format (or delete if Phase 4 deletes the component — defer that decision to Phase 4).

#### Success Criteria

- `just check` passes.
- Shiki output contains zero inline hex colors. Verified by a `grep -E 'style=\"color: ?#[0-9a-f]'` over a fixture render — must return zero matches.
- Visually load `/rfc/0001`, `/rfc/0003`, `/rfc/0006` in `just dev-msw` — code blocks use the mockup palette (purple keywords, blue functions, green strings, orange numbers, muted-slate italic comments, cyan types).
- No token mapping gaps obvious in the fixtures used by `tests/examples/docs/` — if any are found, they're either fixed in this phase or explicitly tracked in §Open Questions.

---

### Phase 3: Mermaid hydration + container styling

Replace the in-tree `<MermaidBlock>` component with a post-mount hydration pass that runs against `[data-mermaid-source]` placeholders. Themed against the mockup's tokens.

#### Tasks

- [ ] Create `src/portal/markdown/mermaid-hydrate.ts`. Exports `async function hydrateMermaid(): Promise<void>`:
  - Query `[data-mermaid-source]` on the document. Early-return if empty.
  - Dynamic `import("mermaid")` so the lib only ships when needed.
  - `mermaid.initialize({ startOnLoad: false, theme: "base", themeVariables: mermaidThemeFromTokens() })`.
  - For each block: read `data-mermaid-source`, render via `mermaid.render`, replace `innerHTML` with the resulting SVG, add the `.mermaid-diagram` class to the placeholder.
  - On render error: set `textContent` to a fallback message + `console.error`.
- [ ] Implement `mermaidThemeFromTokens()` helper. Read `getComputedStyle(document.documentElement).getPropertyValue("--bg-raised")` etc. and return a `themeVariables` object with `primaryColor`, `primaryTextColor`, `primaryBorderColor`, `lineColor`, `fontFamily`. Start with the minimal set for flowchart (the only diagram type our fixtures currently use) — extend if other types appear.
- [ ] Add `.mermaid-diagram` styling to `src/portal/markdown/styles.css` per mockup §1157-1167:
  ```css
  .markdown-body .mermaid-diagram {
    margin: 24px 0;
    padding: 32px 24px;
    background: var(--bg-raised);
    border: 1px solid var(--border-hairline);
    border-radius: var(--r-sm);
  }
  .markdown-body .mermaid-diagram svg {
    display: block;
    margin: 0 auto;
    max-width: 100%;
  }
  ```
- [ ] Write `tests/portal/markdown/mermaid-hydrate.test.tsx`. JSDOM environment:
  - Mock `mermaid.render` to return a known SVG string.
  - Render a fixture document containing one mermaid block via the (still-current) `<DocumentView>` path (or build a minimal harness — the goal is to test the hydrate helper).
  - Call `hydrateMermaid()`. Assert the placeholder now contains the mocked SVG and has `.mermaid-diagram` class.
  - Second test: `hydrateMermaid()` with no `[data-mermaid-source]` elements — must not import `mermaid`.

#### Success Criteria

- `just check` passes including the new mermaid-hydrate tests.
- `just dev-msw` smoke: load `/rfc/0003` or `/rfc/0006`. Mermaid diagram renders with mockup-aligned node fill (`--bg-raised`), borders (`--border-hairline`), edge colors (`--accent`), monospace font (`IBM Plex Mono`).
- Container around the SVG matches mockup §1157-1167: visible `--bg-raised` background, `--border-hairline` border, `--r-sm` rounded corners, comfortable padding.
- Bundle: `mermaid` does **not** appear in the entry-chunk JS (verified via `just build` + `ls -la dist/client/assets/`). It should chunk-split as a lazy import.

---

### Phase 4: Cutover — loader + DocumentView + delete legacy components

The user-visible flip. Modify the route loader to call `renderMarkdown`, thin `<DocumentView>` to inject the resulting HTML, delete the old React component overrides. After this phase: hard refresh shows the article body in the initial HTML payload.

#### Tasks

- [ ] Modify `src/routes/$type.$id.tsx`. Loader returns `{ doc: Document, bodyHtml: string }` instead of bare `Document`. Loader calls `await renderMarkdown(doc)` (cache integration lands in Phase 6). Update the `meta` function + the default export's `loaderData` shape accordingly.
- [ ] Replace `<DocumentView document={doc} />` in `$type.$id.tsx` with `<DocumentView bodyHtml={loaderData.bodyHtml} />`. The `articleRef` div + `<DocPage>` shell stay.
- [ ] Rewrite `src/portal/markdown/DocumentView.tsx`:
  - Props become `{ bodyHtml: string }`.
  - Body becomes `<article className="markdown-body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />`.
  - Add `useEffect(() => { void hydrateMermaid(); }, [bodyHtml])`.
  - Delete `LinksContext` + `useDocumentLinks` exports (no longer needed).
  - Delete `MarkdownHooks` + `Suspense` imports.
- [ ] Wire up cross-doc click navigation. **Pending OQ-2 resolution** — see §Open Questions. Tentative: delegated `onClick` on `document.documentElement` that intercepts `<a data-cross-doc="1">` clicks and dispatches via RR7's `useNavigate()`. Lives in a small `src/portal/markdown/cross-doc-nav.ts` helper + a `useEffect` hook attached in `<DocumentView>`.
- [ ] Delete `src/portal/markdown/components/Anchor.tsx` + `tests/portal/markdown/components/Anchor.test.tsx` (coverage already in `resolve-anchor-links.test.ts`).
- [ ] Delete `src/portal/markdown/components/Code.tsx` + `tests/portal/markdown/components/Code.test.tsx` (Shiki output ships directly via SSR'd HTML; mermaid handled by `mermaid-hydrate`).
- [ ] Delete `src/portal/markdown/components/MermaidBlock.tsx` (functionality moved into `mermaid-hydrate`).
- [ ] Remove the now-orphaned `src/portal/markdown/components/` directory if it's empty after the deletes above.
- [ ] Update `tests/api/docPageRender.test.tsx`:
  - The renderRoute helper's loader now produces `{ doc, bodyHtml }`; tests assert against `bodyHtml` (rendered HTML string), not `doc.body` (raw markdown).
  - Add a test confirming a fixture with cross-doc links has portal routes in the rendered HTML.
- [ ] Spot-check the TOC behaviour. `<TableOfContents>` walks the article ref via `MutationObserver` + `IntersectionObserver`. After the cutover, headings still exist with their `id` attributes — confirm the TOC populates and the scroll-spy still highlights the current section.

#### Success Criteria

- `just check` passes.
- `just dev-msw` smoke on `/rfc/0001`:
  - **`view-source` shows the article HTML in the initial document** (no Suspense fallback, no client-fill). This is the explicit acceptance for OQ-2 from DESIGN-0004; see Phase 5.
  - No console errors / warnings related to hydration mismatch.
  - Cross-doc links (e.g. RFC-0001 → RFC-0006) navigate without a page reload.
  - External links open in a new tab with `rel="noopener noreferrer"`.
  - Broken/unresolved links render as inert `<span data-broken-link>`.
- TOC populates and scroll-spy highlights correctly on `/rfc/0001`.
- The previously-visible article redraw on hard refresh is gone. The whole page paints together.
- No file in `src/portal/markdown/components/` remains.

---

### Phase 5: Open-question verification + visual diff

Pure verification. No new functional code. Captures the data the DESIGN's Open Questions demanded.

#### Tasks

- [ ] **OQ-1: Shiki highlighter singleton.** Instrument `renderMarkdown.ts` (temporarily) with a counter that increments whenever the highlighter is instantiated. Hit `/rfc/0001`, then `/rfc/0003`, then `/rfc/0006` — counter must stay at `1` across all three requests. If it climbs, replace `@shikijs/rehype` with `createHighlighter()` + a manual transformer and re-verify. Remove the instrumentation after the verification lands. Document the outcome in §Findings.
- [ ] **OQ-2: RR7 streaming behaviour.** With dev-msw running, fetch `/rfc/0001` via `curl -sN` (no JS, no buffering). The response body must contain the article `<h2>` + `<p>` tags in the **first 8 KB** of bytes (a reasonable approximation of the initial flush). If the article appears in a later streamed chunk, document the workaround required (likely: explicit `await` ordering in the loader so RR7 treats the route as eager). Document the outcome.
- [ ] **Expand the visual-diff fixture corpus.** Per OQ-4 resolution, add a "kitchen-sink" RFC to `~/code/rfcs` (`RFC-0009`, title TBD) that exercises:
  - **Languages**: go, rust, python, typescript, javascript, json, yaml, sql, dockerfile, bash, css, html, plus one code block with `text` / no language to test the fallback.
  - **Mermaid diagram types**: at least flowchart, sequenceDiagram, stateDiagram, gantt, classDiagram, erDiagram (enumerate what mermaid 11 supports; pick ≥4 that are visually distinct).
  - **Code-block edge cases**: long lines (horizontal scroll), inline `code` in headings, code blocks inside list items, code blocks inside blockquotes, two consecutive code blocks (no separator), empty code block.
  - **Admonition edge cases**: nested code inside an admonition, multi-paragraph admonition body.
  - **Heading depth**: h2 / h3 / h4 / h5 to confirm anchor + TOC behaviour.
  Push to `~/code/rfcs`, then re-run the rfc-api worker so the fixture is queryable as a real doc.
- [ ] **Visual parity capture.** Take screenshots of `/rfc/0001` (sql + tables), `/rfc/0003` (mermaid + go), `/rfc/0007` (yaml + dockerfile + warnings), and the new `/rfc/0009` (kitchen sink). For each: this branch post-Phase 4 vs the mockup `~/code/design-system/rfc-portal-mockup_15.html` rendered locally as the canonical reference. Side-by-side compare. Document drifts in §Findings; anything blocking gets surfaced back to §Open Questions for triage.
- [ ] **Cross-doc-nav OQ-2 resolution.** If a `[data-cross-doc]` click delegation handler was needed (resolved in §Open Questions before Phase 4), confirm the pattern is documented in the codebase (`src/portal/markdown/cross-doc-nav.ts`) and has a unit test (`cross-doc-nav.test.tsx`) covering: click on a cross-doc link triggers `useNavigate()` instead of a full page nav; click on an external link is left alone; ctrl/meta-click is left alone (so users can still open in a new tab).

#### Success Criteria

- OQ-1: Shiki highlighter instantiated exactly **once** per Node process over a 3-request sweep.
- OQ-2: Article body bytes present in the initial response chunk on hard refresh. No further mitigation required, OR the mitigation is documented + implemented.
- Visual diff: zero pixel drift vs the mockup for code-block colors and mermaid container styling on at least one of the three sample RFCs (RFC-0003 is the easiest target — has every prose element we render). Other drifts are documented but not blocking.
- §Findings is filled in with the actual numbers/observations from each verification step.

---

### Phase 6: Per-commit cache

Bolt the cache onto the working pipeline. Independent of everything before — Phase 5 confirmed the foundation, this phase optimises the hot path.

#### Tasks

- [ ] Create `src/portal/markdown/renderCache.ts` per DESIGN-0004 §4:
  - Module-scoped `Map<string, CacheEntry>`.
  - `MAX_ENTRIES = 256`, `ENTRY_TTL_MS = 60 * 60_000`.
  - `cacheKey(doc)` returns `${doc.id}@${doc.source.commit}` or `null` if commit is missing.
  - `renderMarkdownCached(doc)` returns cache hit (with `lastAccess` bump) or computes + stores + returns.
  - LRU eviction on `MAX_ENTRIES` overflow.
  - Test-only `_clearRenderCache()` export.
- [ ] Wire `renderMarkdownCached` into the `$type.$id.tsx` loader (replacing the direct `renderMarkdown` call from Phase 4).
- [ ] Write `tests/portal/markdown/renderCache.test.ts`:
  - Hit on second call with same `(id, commit)`.
  - Miss on different `commit` even with same `id`.
  - Eviction when `MAX_ENTRIES` exceeded — oldest entry is dropped.
  - TTL backstop: an entry past `ENTRY_TTL_MS` triggers a fresh render.
  - `null` key bypass: doc with no `source.commit` renders every call (no cache).
  - Concurrent calls for the same key produce one render (optional — depends on Phase 4 implementation; if not naturally handled, document and defer).
- [ ] Add manual cache instrumentation guidance to the IMPL §Findings. Suggested approach: a one-line `console.time` wrapper around `renderMarkdown` inside `renderMarkdownCached`, plus a `console.log("[render-cache] hit", key)` / `"miss"` line. Strip before merging or leave behind a `DEBUG_RENDER_CACHE` env flag.

#### Success Criteria

- `just check` passes including the new cache tests.
- Manual verification: sequence `hit /rfc/0001` → `hit /rfc/0001` (warm cache hit, no render in the log) → `make work` in rfc-api to re-ingest → `hit /rfc/0001` (cache miss again because `source.commit` changed) → `hit /rfc/0001` (hit again).
- Memory: `node --inspect` or a brief manual check confirms cache size doesn't grow unbounded after a sweep of >256 docs (which we don't have today, but the LRU eviction is testable in isolation).
- §Findings documents cache hit rate over a representative warm session.

---

## File Changes

### New files

| Path | Phase |
|------|-------|
| `src/portal/markdown/renderMarkdown.ts` | 1 |
| `src/portal/markdown/renderCache.ts` | 6 |
| `src/portal/markdown/plugins/resolve-anchor-links.ts` | 1 |
| `src/portal/markdown/mermaid-hydrate.ts` | 3 |
| `src/portal/markdown/cross-doc-nav.ts` (pending OQ-2) | 4 |
| `tests/portal/markdown/renderMarkdown.test.ts` | 1 |
| `tests/portal/markdown/plugins/resolve-anchor-links.test.ts` | 1 |
| `tests/portal/markdown/mermaid-hydrate.test.tsx` | 3 |
| `tests/portal/markdown/renderCache.test.ts` | 6 |
| `tests/portal/markdown/cross-doc-nav.test.tsx` (pending OQ-2) | 4 |

### Modified files

| Path | Phase | Change |
|------|-------|--------|
| `src/portal/markdown/pipeline.ts` | 1, 2 | Split rehype chain into `rehypePluginsCore` + `rehypeSanitizePlugin`; switch Shiki to CSS-variables theme mode |
| `src/portal/markdown/styles.css` | 2, 3 | Add `--shiki-token-*` alias block; add `.mermaid-diagram` container styling |
| `src/portal/markdown/DocumentView.tsx` | 4 | Props `{ document }` → `{ bodyHtml }`; body becomes `dangerouslySetInnerHTML`; `useEffect(hydrateMermaid)`; delete `LinksContext` exports |
| `src/routes/$type.$id.tsx` | 4, 6 | Loader returns `{ doc, bodyHtml }`; component passes `bodyHtml` to `<DocumentView>`; Phase 6 swaps `renderMarkdown` → `renderMarkdownCached` |
| `tests/api/docPageRender.test.tsx` | 4 | Assert against rendered `bodyHtml` instead of raw `doc.body` |

### Deleted files

| Path | Phase | Reason |
|------|-------|--------|
| `src/portal/markdown/components/Anchor.tsx` | 4 | Replaced by `resolve-anchor-links` plugin |
| `src/portal/markdown/components/Code.tsx` | 4 | Code shipped via SSR'd Shiki output; mermaid via `mermaid-hydrate` |
| `src/portal/markdown/components/MermaidBlock.tsx` | 4 | Replaced by `mermaid-hydrate` |
| `tests/portal/markdown/components/Anchor.test.tsx` | 4 | Coverage moved to `resolve-anchor-links.test.ts` |
| `tests/portal/markdown/components/Code.test.tsx` | 4 | Coverage moved to `renderMarkdown.test.ts` |

## Testing Plan

- **Unit tests (vitest):** every new module gets a colocated test file covering the cases in DESIGN-0004 §Testing Strategy. The existing pipeline tests (`tests/portal/markdown/pipeline.test.tsx`, `sanitize.test.ts`, plugin tests under `plugins/`) stay green throughout — only their assertions about inline hex colors flip to CSS variables in Phase 2.
- **Integration tests:** `tests/api/docPageRender.test.tsx` is the main integration surface. It exercises the loader end-to-end via `renderRoute`. Phase 4 rewrites its assertions; the test count stays roughly constant.
- **Manual smoke (per phase):** `just dev-msw` against the local fixture corpus + `~/code/rfcs` content. Hard-refresh check on the most representative docs.
- **Visual diff (Phase 5):** screenshot comparison vs the mockup, captured in §Findings.

## Dependencies

No new package dependencies. The full unified stack is already installed:

- `unified ^11.0.5`
- `remark-parse ^11.0.0`
- `remark-rehype ^11.1.2`
- `rehype-stringify ^10.0.1`
- `unist-util-visit ^5.1.0`
- `@shikijs/rehype ^4.x` (already used)
- `rehype-sanitize ^6.x` (already used)
- `mermaid ^11.x` (already used; lazy-imported by Phase 3)

## Findings

<!-- Filled in as phases land. Captures actual numbers / observations
     for the OQ verifications (Phase 5) and the cache instrumentation
     (Phase 6). Keep this in the same doc rather than in a separate
     phase-close note — it's the historical record of what was true at
     migration time. -->

### Phase 1

_pending_

### Phase 2

_pending_

### Phase 3

_pending_

### Phase 4

_pending_

### Phase 5 — OQ verification

_pending_

### Phase 6 — cache instrumentation

_pending_

## Open Questions

All five OQs resolved in a direction-setting conversation 2026-05-18. Resolutions captured here; corresponding tasks already updated in the phase plans above.

### OQ-1: `rehype-sanitize` ordering — `pipeline.ts` refactor approach ✅ RESOLVED

> **Resolution:** Two-array split accepted: `rehypePluginsCore` (everything before sanitize) + `rehypeSanitizePlugin` (sanitize itself), with the existing `rehypePlugins = [...rehypePluginsCore, rehypeSanitizePlugin]` export preserved so the current client-side path keeps working unmodified. Factory pattern (`buildRehypeChain({ extraBeforeSanitize })`) considered and rejected as ceremony at the one current insertion point.
>
> **Note for forward-compat:** the new `renderMarkdown` + `renderCache` modules are doc-type-agnostic — `Document.body` + `Document.links[]` is the contract, `doc.type` is never inspected. **Frameworks (next doc type)** will reuse this pipeline unchanged. Frameworks' own concerns — frontmatter-driven layout selection, different sidebar shape — happen in the framework route component, not in the render pipeline.

### OQ-2: Cross-doc click navigation pattern ✅ RESOLVED

> **Resolution:** **Article-scoped delegated click handler** in `src/portal/markdown/cross-doc-nav.ts`, attached via a `useEffect` in `<DocumentView>`. The handler intercepts clicks on `<a data-cross-doc="1">` descendants of the article, calls `event.preventDefault()` + `navigate(href)` via `useNavigate()`, and skips ctrl/meta-click so "open in new tab" still works.
>
> **Oxide's pattern doesn't transfer.** Verified by reading their source: `app/components/AsciidocBlocks/Document.tsx` renders the asciidoc tree via `<Content blocks={document.blocks} />` from `@oxide/react-asciidoc` — a **React component tree**, not `dangerouslySetInnerHTML`. Their anchors are React components, so React Router's intercept fires naturally. They don't need a delegation handler because they don't have raw `<a>` tags to begin with.
>
> We picked HTML injection over React-tree rendering specifically because it caches simply (Phase 6 — cache HTML strings keyed by commit) and removes Shiki's async machinery from the render path. The click handler is the price.

### OQ-3: Language-badge chip on code blocks ✅ RESOLVED

> **Resolution:** **Add the language badge in this migration**, not as a follow-up. Mockup §812-823 implements it as pure CSS via `pre[data-lang]::before { content: attr(data-lang); ... }` — no JS, no rehype plugin needed beyond what Shiki already gives us.
>
> Shiki already emits `data-language="<lang>"` on `<pre>` elements (sanitize schema permits `dataLanguage`). Adapt the mockup selector from `pre[data-lang]` to `pre[data-language]` in `src/portal/markdown/styles.css` (named differently but semantically the mockup's intent). Exclude `pre[data-language="mermaid"]` so mermaid blocks don't get a `MERMAID` badge — they have their own container affordance from §1157-1167.
>
> Task added to Phase 2 with the full CSS block. `<Pre>` (Code.tsx) deletion still goes ahead in Phase 4 — it was never doing the badge work; the badge is CSS-only.

### OQ-4: Visual-diff fixture set + method ✅ RESOLVED

> **Resolution:** **Expand the fixture corpus**, then eyeball-compare against the mockup as the canonical reference (no perceptual-diff tool — overhead not worth it at this stage).
>
> Phase 5 now includes authoring a new "kitchen-sink" RFC (`RFC-0009`) in `~/code/rfcs` that exercises:
> - **12+ code languages** (go, rust, python, typescript, javascript, json, yaml, sql, dockerfile, bash, css, html, plus `text` fallback).
> - **≥4 distinct mermaid diagram types** (flowchart, sequenceDiagram, stateDiagram, plus one of gantt/classDiagram/erDiagram).
> - **Code-block edge cases**: long lines, inline code in headings, code in lists, code in blockquotes, consecutive blocks, empty block.
> - **Admonition edge cases**: nested code, multi-paragraph body.
> - **Heading depth**: h2 / h3 / h4 / h5 for anchor + TOC coverage.
>
> Final visual diff covers `/rfc/0001`, `/rfc/0003`, `/rfc/0007`, `/rfc/0009`. Each compared against the mockup as the source of truth.

### OQ-5: TOC behaviour with `dangerouslySetInnerHTML` ✅ RESOLVED

> **Resolution:** **Spot-check during Phase 4 as proposed.** Expected outcome: the MutationObserver fires once when the article's innerHTML lands (the `<article>` element commits and React's reconciliation queues a single mutation observable as "subtree changed"), the IntersectionObserver then attaches to the now-present headings, and scroll-spy continues to work unchanged.
>
> **Fallback path** (in case the spot-check surfaces a bug): swap the MutationObserver for a simple `useEffect(() => walk(articleRef.current), [bodyHtml])` in `<TableOfContents>` — this fires deterministically once per `bodyHtml` change. Easier than chasing observer timing semantics.

## References

- [DESIGN-0004](../design/0004-render-markdown-server-side-in-the-rfc-site-loader-with-per.md) — the design this IMPL executes.
- [INV-0004](../investigation/0004-eliminate-the-rfc-page-render-flash-on-hard-refresh.md) — the investigation that selected this approach.
- [DESIGN-0002](../design/0002-markdown-rendering-pipeline.md) — the underlying Markdown pipeline shape, preserved verbatim.
- [ADR-0001](../adr/0001-consume-rfc-api-via-its-published-openapi-contract.md) — API contract discipline; this IMPL has zero rfc-api changes.
- Mockup: `~/code/design-system/rfc-portal-mockup_15.html`. Specifically §49-61 (`--code-*` tokens), §782-995 (code-block prose styling using `var(--code-*)`), §1157-1167 (`.mermaid-diagram` container styling).
- [Oxide RFD](https://rfd.shared.oxide.computer/rfd/0004) — the existence-proof site for React Router v7 SSR + CSS-variables syntax highlighting.
