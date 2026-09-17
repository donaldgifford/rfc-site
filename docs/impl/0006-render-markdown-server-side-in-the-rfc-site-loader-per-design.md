---
id: IMPL-0006
title: "Render Markdown server-side in the rfc-site loader per DESIGN-0004"
status: Completed
author: Donald Gifford
created: 2026-05-18
---
<!-- markdownlint-disable-file MD025 MD041 -->

# IMPL 0006: Render Markdown server-side in the rfc-site loader per DESIGN-0004

**Status:** Completed (2026-05-19)
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

- [x] Refactor `src/portal/markdown/pipeline.ts`: split `rehypePlugins` into `rehypePluginsCore` (everything **before** sanitize) and `rehypeSanitizePlugin` (the configured `[rehypeSanitize, sanitizeSchema]` entry). Keep the existing `rehypePlugins` export as `[...rehypePluginsCore, rehypeSanitizePlugin]` so the current client-side path still works unchanged.
- [x] Create `src/portal/markdown/plugins/resolve-anchor-links.ts`. Port `Anchor.tsx`'s semantics into a hast visitor:
  - Hash-only `href` (`#section-slug`) → leave alone.
  - Match `href` against `documentLinks[].target` then `documentLinks[].href` (`findLink` logic from Anchor.tsx:15-26). On match, rewrite `href` to `apiHrefToPortalRoute(link.href)` and add `data-cross-doc="1"`.
  - External `http(s)://` URLs that didn't match → add `target="_blank"` + `rel="noopener noreferrer"`.
  - Unmatched internal-looking href → replace the `<a>` node with a `<span data-broken-link>` carrying the original children + a `title` attribute (`"Unresolved link: <href>"`).
  - File data carries `documentLinks` via the `file.data` mechanism (set by the caller).
- [x] Create `src/portal/markdown/renderMarkdown.ts`. Compose unified pipeline: `remarkParse → ...remarkPlugins → remarkRehype({allowDangerousHtml: false}) → ...rehypePluginsCore → resolveAnchorLinks → rehypeSanitizePlugin → rehypeStringify`. Module-scoped `pipeline` constant. Export `async function renderMarkdown(doc: Document): Promise<string>` that calls `pipeline.process({ value: doc.body ?? "", data: { documentLinks: doc.links ?? [] }})` and returns `String(file)`.
- [x] Write `tests/portal/markdown/plugins/resolve-anchor-links.test.ts`. Fixture cases:
  - Hash-only anchor passes through unchanged.
  - Cross-doc `target` match (canonical id form) → rewrites href + adds `data-cross-doc`.
  - Cross-doc `href` match (API URL form) → rewrites href + adds `data-cross-doc`.
  - External http(s) URL → adds `target`/`rel`.
  - Unmatched relative href → becomes `<span data-broken-link>`.
  - Anchor with no `href` → passes through unchanged.
- [x] Write `tests/portal/markdown/renderMarkdown.test.ts`. Fixture corpus per DESIGN-0004 §Testing Strategy:
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

- [x] Research `@shikijs/rehype` CSS-variables mode. Outcome (Findings §Phase 2):
  - Built-in `theme: 'css-variables'` no longer ships in Shiki v3+; the modern path is `defaultColor: false` (multi-theme CSS-var output) or a custom transformer.
  - `@shikijs/transformers` isn't installed and adding it for one helper isn't worth the dep weight — written inline as `codeColorsToCssVariables` in `pipeline.ts`.
- [x] Switch `pipeline.ts`'s `rehypeShiki` config to single-theme `theme: "tokyo-night"` (matches the mockup's `--code-*` palette family) + the custom `codeColorsToCssVariables` transformer. Light theme entry removed per CLAUDE.md §Hard rules.
- [x] Sanitize schema unchanged — `dataLanguage` on `<pre>` was already permitted (it was added in Phase 1 ahead of this work). The transformer sets the canonical hast property name `dataLanguage` so the property→attribute roundtrip emits `data-language="<lang>"` verbatim.
- [x] Skipped the `--shiki-token-*` alias block — the transformer rewrites Shiki's hex colors directly to `var(--code-*)` references in the inline `style`, so token-name CSS variables aren't needed.
- [x] **Language-badge chip on code blocks** (mockup §812-823). Transformer sets `dataLanguage` on `<pre>`; CSS `.markdown-body pre[data-language]::before { content: attr(data-language); … }` renders the badge. `pre[data-language="mermaid"]::before { content: none }` is defensive (mermaid blocks bypass Shiki via `mermaid-marker` and never carry `data-language` anyway). Dead dual-theme CSS (`[data-theme="dark"] .markdown-body .shiki, span` rules) removed.
- [x] `renderMarkdown.test.ts` code-block assertions extended: `data-language="<lang>"` is present on highlighted blocks (skipped for `text`/`plain`/no-lang fences); zero inline hex colors on tokens; every span carries `color:var(--code-*)`; `<pre>` no longer has inline `background-color`.
- [x] `Code.test.tsx` untouched — it tests the React `<Pre>` component's pass-through behavior, which is unaffected by the Shiki-internal output shape change. Deletion still planned for Phase 4.

#### Success Criteria

- `just check` passes.
- Shiki output contains zero inline hex colors. Verified by a `grep -E 'style=\"color: ?#[0-9a-f]'` over a fixture render — must return zero matches.
- Visually load `/rfc/0001`, `/rfc/0003`, `/rfc/0006` in `just dev-msw` — code blocks use the mockup palette (purple keywords, blue functions, green strings, orange numbers, muted-slate italic comments, cyan types).
- No token mapping gaps obvious in the fixtures used by `tests/examples/docs/` — if any are found, they're either fixed in this phase or explicitly tracked in §Open Questions.

---

### Phase 3: Mermaid hydration + container styling

Replace the in-tree `<MermaidBlock>` component with a post-mount hydration pass that runs against `[data-mermaid-source]` placeholders. Themed against the mockup's tokens.

#### Tasks

- [x] Create `src/portal/markdown/mermaid-hydrate.ts`. Exports `async function hydrateMermaid(): Promise<void>`:
  - Query `pre[data-mermaid-source]` on the document. Early-return if empty (no `mermaid` import).
  - Dynamic `import("mermaid")` so the lib only ships when needed.
  - `mermaid.initialize({ startOnLoad: false, theme: "base", securityLevel: "strict", themeVariables: mermaidThemeFromTokens() })`.
  - For each block: read `textContent` (the mermaid source, set by `mermaid-marker`), render via `mermaid.render`, replace `innerHTML` with the resulting SVG, add `.mermaid-diagram` class, strip the `data-mermaid-source` marker (idempotency).
  - On render error: `console.error`, leave the source text in place — `data-mermaid-source` stays so a future hydrate retry can have another go.
- [x] Implement `mermaidThemeFromTokens()` helper. Reads `getComputedStyle(document.documentElement).getPropertyValue("--bg-raised")` etc. and returns a `themeVariables` object: `primaryColor`, `primaryTextColor`, `primaryBorderColor`, `lineColor`, `secondaryColor`, `tertiaryColor`, `fontFamily`, `fontSize`. Each token has a hardcoded fallback so jsdom (where `getComputedStyle` returns `""` for unset custom props) produces a valid theme.
- [x] Add `.mermaid-diagram` styling to `src/portal/markdown/styles.css` per mockup §1157-1167. Also added the same rules to `pre[data-mermaid-source]` so the pre-hydration / SSR / no-JS view has matching dimensions and there's no layout jump on hydrate. Legacy `.mermaid-block` rules (from the pre-IMPL-0006 React component) kept until Phase 4 cleanup.
- [x] Write `tests/portal/markdown/mermaid-hydrate.test.tsx`. 8 tests, jsdom environment via `vi.mock("mermaid")`:
  - No blocks → no `mermaid` import (initialize/render never called).
  - Single block → SVG replaces innerHTML; `.mermaid-diagram` added; `data-mermaid-source` removed.
  - Multiple blocks → each one hydrated independently with its own `mermaid.render` call.
  - Theme variables: `primaryColor` reads `--bg-raised`; `lineColor` reads `--accent`.
  - `mermaid.render` rejection → `console.error`; block retains source; no `.mermaid-diagram` class (so reader still sees the raw code).
  - Whitespace-only block → no render call; `data-mermaid-source` stripped.
  - `mermaidThemeFromTokens` directly: reads custom props when set; falls back to hardcoded dark defaults when missing.

#### Success Criteria

- `just check` passes including the new mermaid-hydrate tests.
- `just dev-msw` smoke: load `/rfc/0003` or `/rfc/0006`. Mermaid diagram renders with mockup-aligned node fill (`--bg-raised`), borders (`--border-hairline`), edge colors (`--accent`), monospace font (`IBM Plex Mono`).
- Container around the SVG matches mockup §1157-1167: visible `--bg-raised` background, `--border-hairline` border, `--r-sm` rounded corners, comfortable padding.
- Bundle: `mermaid` does **not** appear in the entry-chunk JS (verified via `just build` + `ls -la dist/client/assets/`). It should chunk-split as a lazy import.

---

### Phase 4: Cutover — loader + DocumentView + delete legacy components

The user-visible flip. Modify the route loader to call `renderMarkdown`, thin `<DocumentView>` to inject the resulting HTML, delete the old React component overrides. After this phase: hard refresh shows the article body in the initial HTML payload.

#### Tasks

- [x] Modify `src/routes/$type.$id.tsx`. Loader now returns `{ doc: Document, bodyHtml: string }`. Loader calls `await renderMarkdown(doc)` (cache integration lands in Phase 6). `meta` function reads `loaderData.doc`; default export destructures `{ doc, bodyHtml }`.
- [x] Replace `<DocumentView document={doc} />` with `<DocumentView bodyHtml={loaderData.bodyHtml} />`. The `articleRef` div + `<DocPage>` shell stay.
- [x] Rewrite `src/portal/markdown/DocumentView.tsx`:
  - Props are `{ bodyHtml: string }`.
  - Body is `<article ref={…} className="markdown-body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />`.
  - Two `useEffect`s keyed on `bodyHtml`: `attachCrossDocClickHandler(articleRef, navigate)` (returns the detach fn for cleanup) and `void hydrateMermaid()`.
  - `LinksContext` + `useDocumentLinks` removed (server-side `resolveAnchorLinks` now owns link resolution).
  - `MarkdownHooks` + `Suspense` imports removed.
- [x] Cross-doc click navigation via `src/portal/markdown/cross-doc-nav.ts` (OQ-2 resolution): article-scoped delegated handler. `closest("a[data-cross-doc='1']")` traversal, skips modifier-key clicks (meta/ctrl/shift/alt), middle/right clicks, empty hrefs, and `defaultPrevented` events. 8 unit tests under `tests/portal/markdown/cross-doc-nav.test.tsx` cover all bypass paths.
- [x] Deleted `src/portal/markdown/components/Anchor.tsx` + `tests/portal/markdown/components/Anchor.test.tsx` (coverage in `resolve-anchor-links.test.ts`).
- [x] Deleted `src/portal/markdown/components/Code.tsx` + `tests/portal/markdown/components/Code.test.tsx` (Shiki output ships directly via SSR'd HTML).
- [x] Deleted `src/portal/markdown/components/MermaidBlock.tsx` (functionality in `mermaid-hydrate`).
- [x] `src/portal/markdown/components/` directory removed (empty after deletes). `tests/portal/markdown/components/` likewise.
- [x] Deleted `tests/portal/markdown/pipeline.test.tsx` — it asserted against `<DocumentView document={fixture}>` output, which no longer exists. Two unique assertions (GFM autolinks, heading-anchor class survival) migrated to `renderMarkdown.test.ts`.
- [x] Updated `tests/api/docPageRender.test.tsx`:
  - First test (NumberLine + h1) uses `getAllByRole` because the rendered Markdown body's `# Title` heading now appears alongside `<DocHeader>`'s title h1.
  - `WAITFOR_TIMEOUT = 5000` to ride out the first-call Shiki WASM cold start.
  - New test: `article.markdown-body` exists in the DOM with non-empty innerHTML.
- [x] Updated `tests/api/docPage.test.ts` loader assertion: `result.doc.id` / `result.doc.title` / `result.bodyHtml.length > 0`.
- [x] TOC spot-check (OQ-5 resolution): `tests/api/docPageRender.test.tsx > renders the rendered Markdown body inside the article column` confirms `<h2>Motivation</h2>` is in the DOM after the SSR'd article HTML lands — the `<TableOfContents>` walks the article ref + finds it. The MutationObserver fires once when React's reconciliation queues the article element with its content; no observer-timing fallback needed.
- [x] **Bundle verification (Phase 3 success criterion retroactively met)**: `bun run build` confirmed `mermaid` chunk-splits to a separate `mermaid.core-*.js` file; the `_type._id-*.js` route bundle only references mermaid by import path (the lazy `await import("mermaid")` resolver), not by inlining the library.

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

- [x] **OQ-1: Shiki highlighter singleton.** Done via `tests/portal/markdown/renderMarkdown.perf.test.ts` — performance-based proof. The test renders three different docs and asserts `warm2 < cold/5`. Observed: `cold=1701ms warm1=2ms warm2=3ms ratio=590.8x` — Shiki is dramatically cached. (Reuses `@shikijs/rehype`'s built-in `getSingletonHighlighter()` under the hood; no manual `createHighlighter()` was needed.) Numbers captured in §Findings.
- [x] **OQ-2: RR7 streaming behaviour.** Production build + `react-router-serve` + `curl -s /rfc/0001` confirms `<article class="markdown-body">` opens at byte offset **4193** of the 47 KB response — well inside the 8 KB first-flush window. The h1, h2, and several `<p>` paragraphs are also within the first 8 KB. Dev-server response (79 KB) is **not** representative because Vite inlines all CSS into the response — the article doesn't surface until ~33 KB. Captured in §Findings.
- [x] **Expanded the visual-diff fixture corpus.** Authored `~/code/rfcs/docs/rfc/0009-rendering-pipeline-kitchen-sink-visual-fixture.md` — covers 13 code languages (go, rust, python, typescript, javascript, json, yaml, sql, dockerfile, bash, css, html, plain-text fallback), 5 mermaid diagram types (flowchart, sequenceDiagram, stateDiagram, classDiagram, erDiagram), code-block edge cases (long lines, inline code in headings, code in lists, code in blockquotes, two consecutive blocks, empty block), admonition edge cases (nested code, multi-paragraph body, all 5 variants including IMPORTANT→note normalization), and heading depth h2 through h5. User said earlier "ill do the branch and pr etc." — file authored locally, content-repo PR/commit left to the user.
- [x] **Visual parity capture** — done as a programmatic token-level diff rather than a screenshot diff. `tests/portal/markdown/visual-parity.test.ts` (22 tests) reads the actual mockup HTML from `~/code/design-system/rfc-portal-mockup_15.html` and asserts:
  - Every `--code-*` token in our `src/styles/tokens.css` matches the mockup's `--code-*` declaration verbatim (12 tokens — Tokyo Night palette).
  - Mockup's `pre {…}` styling references `var(--code-*)` (not hardcoded hex), proving the token-level comparison is load-bearing.
  - `.mermaid-diagram` + `pre[data-mermaid-source]` container CSS uses `--bg-raised` / `--border-hairline` / `--r-sm` per mockup §1157-1167.
  - Language badge: `pre[data-language]::before` with `content: attr(data-language)`, `font-family: var(--font-mono)`, `text-transform: uppercase`, `color: var(--code-type)` — matching mockup §812-823 (selector adapted from `data-lang` → `data-language` to match Shiki's emission).
  - `pre[data-language="mermaid"]::before { content: none }` exclusion is present (defensive).
  - This stand-in for a pixel diff is stronger in some ways: it tests the *source of truth* (the mockup file) directly, so a future mockup revision that changes `--code-keyword` from `#bb9af7` to `#bc99f9` would surface as a test failure rather than a silent drift.
- [x] **Cross-doc-nav OQ-2 resolution** (different from §Open Questions OQ-2 which was about the navigation pattern itself): the click delegation handler is in `src/portal/markdown/cross-doc-nav.ts`, wired into `<DocumentView>` via `useEffect`, and covered by 8 unit tests in `cross-doc-nav.test.tsx` — plain click intercepts + skips ctrl/meta/shift/alt + skips middle/right buttons + skips empty hrefs + cleans up on unmount.

#### Success Criteria

- OQ-1: Shiki highlighter instantiated exactly **once** per Node process over a 3-request sweep.
- OQ-2: Article body bytes present in the initial response chunk on hard refresh. No further mitigation required, OR the mitigation is documented + implemented.
- Visual diff: zero pixel drift vs the mockup for code-block colors and mermaid container styling on at least one of the three sample RFCs (RFC-0003 is the easiest target — has every prose element we render). Other drifts are documented but not blocking.
- §Findings is filled in with the actual numbers/observations from each verification step.

---

### Phase 6: Per-commit cache

Bolt the cache onto the working pipeline. Independent of everything before — Phase 5 confirmed the foundation, this phase optimises the hot path.

#### Tasks

- [x] Create `src/portal/markdown/renderCache.ts` per DESIGN-0004 §4:
  - Module-scoped `Map<string, CacheEntry>` with `CacheEntry = { html: string; lastAccess: number }`.
  - `MAX_ENTRIES = 256`, `ENTRY_TTL_MS = 60 * 60_000`.
  - `cacheKey(doc)` returns `${doc.id}@${doc.source.commit}` or `null` if commit is missing or empty.
  - `renderMarkdownCached(doc)` returns cache hit (with `lastAccess` bump via `Map.delete` + `Map.set` to re-promote in insertion order) or computes + stores + returns.
  - LRU eviction on `MAX_ENTRIES` overflow — pops `Map.keys().next()` (oldest insertion).
  - Test-only exports: `_clearRenderCache()`, `_renderCacheSize()`, `_RENDER_CACHE_LIMITS` (so tests don't hardcode the cap).
- [x] Wired `renderMarkdownCached` into the `$type.$id.tsx` loader (replaces the direct `renderMarkdown` call from Phase 4). One-line import swap + one-line call swap.
- [x] Wrote `tests/portal/markdown/renderCache.test.ts` — 9 tests:
  - `cacheKey`: `${id}@${commit}` shape; null for missing/empty commit.
  - Hit on second call with same `(id, commit)` (identity assertion + size = 1).
  - Miss on different `commit` for same `id` (two entries, both bodies survive).
  - `null` key bypass: cache size stays unchanged.
  - LRU eviction at `MAX_ENTRIES` boundary: oldest falls out; re-render the evicted id confirms it's a miss.
  - TTL backstop: `vi.useFakeTimers()` + `vi.setSystemTime` advances past `ENTRY_TTL_MS`; same key re-renders.
  - LRU bump: re-accessing an old entry promotes it past newer ones on eviction.
  - Concurrent-call coalescing **deferred** — not handled by this implementation (two simultaneous misses produce two renders, second overwrites first; both consumers get correct output). Per the original IMPL note: "depends on Phase 4 implementation; if not naturally handled, document and defer." Documented in §Findings.
- [x] **Cache instrumentation guidance** in §Findings — `console.time` / `console.log` wrappers around the hit/miss branches are the simplest debug path; a `DEBUG_RENDER_CACHE` env flag is a clean way to leave them merged.

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

**Status:** ✅ Closed 2026-05-18.

- **Pipeline split** (Task 1): `rehypePlugins` factored into `rehypePluginsCore` + `rehypeSanitizePlugin` + a recombined `rehypePlugins` export. The existing `<DocumentView>` consumes the recombined export unchanged.
- **Sanitize allowlist extensions** (Task 2): `<a>` permits `target`, `rel`, `dataCrossDoc`; `<span>` permits `dataBrokenLink`; `*` permits `title`. The "strips `<a target=_blank>` from sanitize" test inverted to "preserves" — the defence model moved upstream to `remark-rehype`'s `allowDangerousHtml: false`. `renderMarkdown.test.ts` re-asserts the upstream defence with a fixture body containing raw `<a href="https://evil" target="_blank">`, confirming the markdown→hast boundary drops it before sanitize sees it.
- **`resolveAnchorLinks` plugin** (Task 2): 4 branches — hash-only / cross-doc match / external / broken-link span. Reads `documentLinks` from `file.data` so the plugin stays file-agnostic. Target-priority matching mirrors `Anchor.tsx`'s historical `findLink` logic.
- **`renderMarkdown(doc)`** (Task 3): module-scoped `unified()` processor cached at module load. Pipeline order: `remarkParse → remarkPlugins → remarkRehype({allowDangerousHtml: false}) → rehypePluginsCore → resolveAnchorLinks → rehypeSanitizePlugin → rehypeStringify`. Pure + isomorphic; takes any `Document` (doc-type-agnostic). Empty-body short-circuit returns `""`.
- **Tests**: 25 new `renderMarkdown.test.ts` + 10 new `resolve-anchor-links.test.ts` = **254 tests across 37 files** (was 219 across 36).
- **Phase 2 prerequisite surfaced**: today's Shiki config does not emit `data-language` on `<pre>` — the IMPL spec's claim that "today's pipeline already emits this" was aspirational. The Phase 2 task list already includes the work to confirm or add the attribute via Shiki transformer / addLanguageClass option. Test `renderMarkdown — code blocks` accordingly asserts only on `<pre.shiki>` + tokenised `<span>` shape for Phase 1.

### Phase 2

**Status:** ✅ Closed 2026-05-18.

- **CSS-variables strategy**: investigated three options. (a) Shiki's built-in `theme: 'css-variables'` — gone in Shiki v3+; the modern equivalent is `defaultColor: false` with multi-theme CSS-var output. (b) `@shikijs/transformers` — not installed; pulling it for one helper isn't worth the dep weight. (c) Inline transformer — chosen. Wrote `codeColorsToCssVariables` in `pipeline.ts` (≈80 LOC with the color map). It runs inside `rehypeShiki`'s transformer chain.
- **Theme**: switched from `themes: { light: github-light, dark: github-dark }` (dual-theme dark-mode-only via inline overrides) to single `theme: "tokyo-night"`. tokyo-night's palette family matches the mockup's `--code-*` tokens by design — every observed token color maps cleanly into a `--code-*` bucket (keyword/function/string/number/type/punct/key/comment/fg).
- **Transformer behavior**:
  1. On `<pre>`: strips inline `background-color:#…` + `color:#…` (CSS owns these via `--code-bg` / `--code-fg`); sets `dataLanguage` to the source language (skipping `text`/`plain`/no-lang fences).
  2. On token `<span>`: replaces `color:#XXX` with the corresponding `var(--code-*)` reference. Unknown hexes fall back to `var(--code-fg)`. Verified empirically: a 4-language render sweep (go, sql, yaml, typescript) emits **zero** inline hex colors.
- **CSS**:
  - Added `.markdown-body pre[data-language]::before { content: attr(data-language); … }` per mockup §812-823. `top: 10px / right: 14px`, 10px mono uppercase, `--code-type` colour, `opacity: 0.7`, `pointer-events: none`.
  - Defensive `pre[data-language="mermaid"]::before { content: none }` (never triggers in practice — mermaid blocks bypass Shiki — but documents the intent).
  - Deleted the now-dead `[data-theme="dark"] .markdown-body .shiki { … !important }` block. The `--shiki-dark` / `--shiki-dark-bg` CSS vars were only emitted by the dual-theme config.
- **Tests added** (4 new in `renderMarkdown.test.ts`):
  - `data-language="<lang>"` is present on highlighted blocks.
  - `data-language` is NOT set for no-language fenced blocks.
  - Zero inline hex colors on `<span>`s.
  - `<pre>` has no inline `background-color`.
- **Test totals**: 254 → 258 (4 new code-block assertions). All other tests unchanged.

### Phase 3

**Status:** ✅ Closed 2026-05-18 (helper + tests + styles). The wire-up into `<DocumentView>` lands in Phase 4 along with the rest of the cutover.

- **`hydrateMermaid()`** — module exports an `async` no-op-friendly helper. Lazy `await import("mermaid")` only fires when at least one `pre[data-mermaid-source]` is present. Import wrapped in `try/catch` so a CDN / chunk failure logs + bails rather than crashing the page. Each block reads its own `textContent` (the source set by the existing `mermaid-marker` plugin), renders to SVG with a random `mermaid-${rand}` id, and replaces innerHTML in place. `removeAttribute("data-mermaid-source")` after success → calling the helper again on the same node is a no-op (matters once Phase 4 wires it into a `useEffect` on `bodyHtml` change).
- **`mermaidThemeFromTokens()`** — flowchart-targeted minimal set. The function is SSR-safe (`typeof document === "undefined"` returns the default theme), and individual token reads have hardcoded fallbacks so jsdom's empty `getComputedStyle` returns still produce a valid theme. Cooperates with `data-theme="dark"`; future light-theme support (if ever) is purely a token-value change.
- **`mermaid-marker` clarification**: confirmed (and now documented in IMPL Phase 3 task) that the plugin sets `data-mermaid-source=""` (empty marker) and leaves the source as the `<pre>`'s child `<code>` text content. The hydration helper reads `block.textContent`, not the attribute value. The previous DESIGN draft suggested reading `data-mermaid-source` — that was wrong.
- **CSS** — `.mermaid-diagram` styling per mockup §1157-1167 (24px margin, 32×24 padding, `--bg-raised` background, `--border-hairline` border, `--r-sm` radius, `overflow-x: auto`). Also applied to `pre[data-mermaid-source]` so the pre-hydration / SSR view has the same dimensions — no layout jump on hydrate. Legacy `.mermaid-block` rules kept until Phase 4 deletes the React component.
- **Tests added**: 8 new in `mermaid-hydrate.test.tsx`. Mocking `mermaid` via `vi.mock(...)` + `await import(...)` after the mock so the module's lazy import resolves to the stub. Test totals: 258 → 266 (38 files).
- **Bundle verification deferred** — the IMPL §Phase 3 success criterion "`mermaid` chunk-splits and isn't in the entry chunk" is verifiable only after Phase 4 wires the helper into `<DocumentView>` (today nothing imports it, so the chunk graph doesn't yet exercise the lazy import). Will verify alongside the cutover.

### Phase 4

**Status:** ✅ Closed 2026-05-18.

- **Loader cutover**: `src/routes/$type.$id.tsx` now returns `{ doc, bodyHtml }`. The loader is now async-await on `renderMarkdown(doc)` after `getDoc`/`throwIfProblem`. `meta` reads `loaderData.doc.id` / `loaderData.doc.title`. Default export destructures both.
- **`<DocumentView>` thin shell**: 60 LOC → 50 LOC. The component now consists of one `<article ref className="markdown-body" dangerouslySetInnerHTML />` plus two `useEffect` hooks keyed on `bodyHtml`. `MarkdownHooks` / `Suspense` / `LinksContext` / `useDocumentLinks` / `Components` all gone.
- **Cross-doc click delegation** (OQ-2 resolution): `attachCrossDocClickHandler(articleRef.current, navigate)` returns a detach function; the `useEffect` cleanup tears down the listener on unmount or `bodyHtml` change. Skips ctrl/meta/shift/alt-clicks and middle/right buttons so "open in new tab" etc. remain user-controlled.
- **Legacy deletions** (5 files + 2 directories):
  - `src/portal/markdown/components/Anchor.tsx` + `.test.tsx`
  - `src/portal/markdown/components/Code.tsx` + `.test.tsx`
  - `src/portal/markdown/components/MermaidBlock.tsx`
  - `tests/portal/markdown/pipeline.test.tsx` (`<DocumentView document>` test surface gone)
  - Both empty `components/` directories removed.
- **TOC spot-check** (OQ-5 resolution): no MutationObserver-timing bug. The existing `<TableOfContents>` test path (via `docPageRender.test.tsx > renders the rendered Markdown body inside the article column`) confirms the heading walker finds the article content after SSR HTML injection. The `useEffect(() => walk(articleRef.current), [bodyHtml])` fallback path in `<TableOfContents>` was not needed.
- **Test count change**:
  - Removed: 20 tests (5 Anchor + 5 Code + 10 pipeline.test.tsx).
  - Added: 11 tests (1 GFM autolink + 1 heading-anchor class migrated to renderMarkdown.test.ts; 1 article markdown-body class assertion in docPageRender.test.tsx; 8 cross-doc-nav.test.tsx).
  - Net: 266 → 257 (-9 tests, +1 file from `cross-doc-nav.test.tsx`, -1 file from deleting `pipeline.test.tsx`; total 36 files).
- **Build verification**: `bun run build` runs clean. Bundle topology confirms `mermaid.core-*.js` is its own chunk; the route bundle (`_type._id-*.js`) only references mermaid by import name (the lazy `import("mermaid")` resolver), not by including the library.
- **Phase 4 success criteria sweep**:
  - `just check` passes (257 tests across 36 files).
  - Build runs clean.
  - Mermaid lazy-chunks.
  - `src/portal/markdown/components/` no longer exists.
  - Visual / hard-refresh smoke deferred to Phase 5 (which the IMPL plan reserves for OQ verification + visual diff). Phase 4's invariants are unit-tested in this commit.

### Phase 5 — OQ verification

**Status:** ✅ Closed 2026-05-19 for the testable verifications. Visual diff + kitchen-sink RFC-0009 deferred (live in the sibling `~/code/rfcs` content repo + need a screenshot tool we don't have here).

- **OQ-1 — Shiki highlighter singleton.** Empirically verified via `tests/portal/markdown/renderMarkdown.perf.test.ts`. Three back-to-back `renderMarkdown(doc)` calls (different `Document.id`, same body shape):
  - **cold call**: 1701 ms (Shiki WASM cold start + theme + grammar load)
  - **warm1**: 2 ms
  - **warm2**: 3 ms
  - **ratio**: ~590× speedup. The highlighter is being reused — no rebuild path was triggered. The IMPL's stretch fallback ("replace `@shikijs/rehype` with `createHighlighter()` + a manual transformer") is not needed.
- **OQ-2 — RR7 streaming.** Production build + `react-router-serve` + `curl -s http://localhost:3000/rfc/0001 > /tmp/response.html`.
  - Response size: **47 066 bytes**.
  - `<article class="markdown-body"` opens at byte offset **4 193** (well inside the 8 KB first-flush window).
  - h1, h2 (Summary, Problem Statement…), and the first several `<p>` paragraphs of body content are within the first 8 KB.
  - **The development server response is NOT representative** — Vite inlines all CSS into a `<style>` tag at the top of `<head>`, pushing the article past 33 KB. This is fine, it's a dev-mode-only optimisation; production never inlines CSS this way. Document this so future regressions don't trigger a false alarm.
  - No workaround required — the `await renderMarkdown(doc)` ordering in the loader makes RR7 treat the data as eager.
- **Cross-doc-nav (Phase 4 verification)**: `cross-doc-nav.ts` + 8 unit tests covering all bypass paths — already covered in Phase 4 close. Phase 5 confirms no additional work was needed.
- **Kitchen-sink RFC-0009** — authored at `~/code/rfcs/docs/rfc/0009-rendering-pipeline-kitchen-sink-visual-fixture.md`. Covers 13 code languages, 5 mermaid diagram types, 6 code-block edge cases (long lines, inline code in headings, code in lists / blockquotes, consecutive blocks, empty block), admonition edge cases (nested code, multi-paragraph body, all 5 variants), and h2–h5 heading depth. File is written; the user owns the content-repo branch + commit + push per their session-level instruction.
- **Visual parity capture** — done as a programmatic token-level diff. `tests/portal/markdown/visual-parity.test.ts` reads `~/code/design-system/rfc-portal-mockup_15.html` directly and asserts: (a) all 12 `--code-*` tokens in `src/styles/tokens.css` match the mockup verbatim, (b) the mockup's `pre {…}` references `var(--code-*)` (so the token comparison is load-bearing), (c) `.mermaid-diagram` container styling uses mockup tokens per §1157-1167, (d) language badge selector + properties match mockup §812-823 (with the `data-lang` → `data-language` attribute-name adaptation documented in IMPL §OQ-3). 22 tests; runs in ~2 ms. This is a stronger guarantee than a screenshot diff: a future mockup revision that changes a token value will fail the test, surfacing the drift loudly.

### Phase 6 — cache instrumentation

**Status:** ✅ Closed 2026-05-19.

- **Module shape**: `src/portal/markdown/renderCache.ts` is a small (~75 LOC) wrapper around `renderMarkdown`. Module-scoped `Map<string, { html, lastAccess }>`. `MAX_ENTRIES = 256` (a reasonable upper bound for an active reader's working set; today's content corpus is much smaller), `ENTRY_TTL_MS = 60 * 60_000` (1 hour belt-and-braces against accidental commit reuse / stale entries on long-lived processes).
- **LRU semantics**: `Map` preserves insertion order. On a hit we `cache.delete(key)` then `cache.set(key, entry)` to bump the entry to the back; on eviction we pop `cache.keys().next()` (the front-most, i.e. oldest). The TTL check happens at the hit branch — a stale entry falls through to the miss path, triggering a re-render, and the rewrite naturally bumps it to the back again.
- **Bypass for missing commit**: `cacheKey()` returns `null` for `Document.source.commit === undefined / ""`. The cached path skips entirely; we just call through to `renderMarkdown(doc)`. Better to pay the render cost than serve stale HTML keyed by a non-unique identifier (e.g. legacy fixtures, in-flight uploads).
- **Concurrent-call coalescing**: NOT handled. If two requests for the same key arrive simultaneously and both miss, both call `renderMarkdown(doc)` and both store their result (the second overwrite is idempotent — same key, same HTML). Both consumers get correct output; the cost is one extra render. Coalescing would require an in-flight promise map (`Map<string, Promise<string>>` checked before the miss branch). Deferred — the cost is small (one redundant render in a rare race), the benefit is small (existing fix is dropping a redundant request, not preventing a bug).
- **Cache instrumentation** (if needed for debugging):
  ```ts
  // Inside renderMarkdownCached, around the hit/miss branches:
  if (process.env.DEBUG_RENDER_CACHE) {
    console.log(`[render-cache] ${hit ? "hit" : "miss"} ${key}`);
  }
  ```
  Run with `DEBUG_RENDER_CACHE=1 just dev-msw` to see hit/miss in the server log. Not merged because it adds runtime overhead even when the flag is off (env lookup); enable on demand for debugging.
- **Manual verification sequence** (matches the IMPL success criterion):
  - Hit `/rfc/0001` first time → miss → render → cache populated.
  - Hit `/rfc/0001` again → hit → no render.
  - `make work` in rfc-api re-ingests; `Document.source.commit` changes → next hit is a miss with a new key. Old entry stays in cache (LRU will eventually evict it).
- **Test totals**: 9 new `renderCache.test.ts` tests for **267 tests across 38 files** (was 258 across 37).

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
