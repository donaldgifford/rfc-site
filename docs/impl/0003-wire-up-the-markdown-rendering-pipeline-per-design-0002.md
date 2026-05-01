---
id: IMPL-0003
title: "Wire up the Markdown rendering pipeline per DESIGN-0002"
status: Draft
author: Donald Gifford
created: 2026-04-30
---
<!-- markdownlint-disable-file MD025 MD041 -->

# IMPL 0003: Wire up the Markdown rendering pipeline per DESIGN-0002

**Status:** Draft
**Author:** Donald Gifford
**Date:** 2026-04-30

<!--toc:start-->
- [Objective](#objective)
- [Scope](#scope)
  - [In Scope](#in-scope)
  - [Out of Scope](#out-of-scope)
- [Approach](#approach)
- [Implementation Phases](#implementation-phases)
  - [Phase 1: Land dependencies + scaffold `src/portal/markdown/`](#phase-1-land-dependencies--scaffold-srcportalmarkdown)
  - [Phase 2: Build the unified plugin chain (no custom plugins)](#phase-2-build-the-unified-plugin-chain-no-custom-plugins)
  - [Phase 3: Custom remark / rehype plugins](#phase-3-custom-remark--rehype-plugins)
  - [Phase 4: React component overrides](#phase-4-react-component-overrides)
  - [Phase 5: Replace the `<pre>` placeholder in `$type.$id.tsx`](#phase-5-replace-the-pre-placeholder-in-typeidtsx)
  - [Phase 6: Search-snippet renderer (`<Snippet>`)](#phase-6-search-snippet-renderer-snippet)
  - [Phase 7: Minimal search-results page](#phase-7-minimal-search-results-page)
- [File Changes](#file-changes)
- [Testing Plan](#testing-plan)
- [Dependencies](#dependencies)
- [Resolved Questions](#resolved-questions)
- [References](#references)
<!--toc:end-->

## Objective

Render every document's `body` (raw Markdown returned by `rfc-api`) to sanitized HTML in the SSR pass, replacing the `<pre>` placeholder that has shipped since IMPL-0001 Phase 4. The pipeline must support GFM, Shiki-highlighted code blocks, mermaid diagrams (client-hydrated), strip docz-tooling boilerplate, and resolve cross-document links from `Document.links[]` rather than parsing the body.

**Implements:** [DESIGN-0002](../design/0002-markdown-rendering-pipeline.md).

## Scope

### In Scope

- The full pipeline as specified in DESIGN-0002 §Detailed Design: parse → GFM → strip-boilerplate → rehype → slug → autolink → shiki → mermaid-marker → sanitize → `react-markdown`.
- Custom remark plugin `strip-docz-boilerplate` (markdownlint disable comment + `<!-- toc:* -->` block).
- Custom rehype plugin `mermaid-marker` (tag mermaid code fences for client hydration; bypass shiki).
- Custom React components: `<Anchor>` (links[] resolution + API-URL → portal-route translation), `<Code>` (mermaid swap + future copy button), `<MermaidBlock>` (client-side hydration).
- `<DocumentView>` page-level renderer wired into `src/routes/$type.$id.tsx`.
- Heading anchors stable enough to match `SearchResult.section_slug` (assumed parity per DESIGN-0002 Resolved Q2).
- Theme-aware Shiki output (dual-theme via `data-theme` CSS switch) and theme-aware mermaid rendering.
- Tests: per-plugin unit tests, full-pipeline integration tests against the IMPL-0002 fixture corpus, sanitization tests against adversarial input, route-level full-render tests through the shared MSW handlers.

### Out of Scope

- **MDX / JSX in Markdown** — stays explicit non-goal per DESIGN-0002.
- **Authoring UX** — read-only rendering only.
- **Per-page TOC sidebar** — heading IDs land here, but the TOC component is a future portal feature.
- **Caching / memoization of rendered HTML** — render on every SSR request for v1.
- **Search-results filtering / faceting / ranking UI** — Phase 7 ships a deliberately minimal `/search` page (q input + result list). Sort controls, type-filter chips, score visualisation, infinite scroll, etc. are deferred to a follow-up IMPL.
- **Slug-parity contract test** — that lives upstream in `rfc-api`; tracked at [donaldgifford/rfc-api#20](https://github.com/donaldgifford/rfc-api/issues/20).

## Approach

Each phase builds on the previous. The ordering matches DESIGN-0002 §Migration / Rollout Plan, with two extensions: Phase 6 ships `<Snippet>` and Phase 7 wires it into a minimal `/search` page so the component is shaped to a real caller.

Phases 1–4 are safe to merge as separate PRs; Phase 5 is the user-visible swap and should land alongside a `just dev` smoke against a seeded `rfc-api` row to confirm the full SSR path. Phases 6–7 are independent of Phases 1–5 once the pipeline exists, but share the same testing infra.

## Implementation Phases

Each phase is complete when all its tasks are checked off and its success criteria pass.

---

### Phase 1: Land dependencies + scaffold `src/portal/markdown/`

Foundation phase. Lands the new dependencies and the directory scaffold so subsequent phases drop into a known shape. No user-visible behavior change — the `<pre>` placeholder still ships at the end of this phase.

#### Tasks

- [x] `bun add` the runtime deps: `react-markdown`, `remark-gfm`, `rehype-slug`, `rehype-autolink-headings`, `@shikijs/rehype`, `rehype-sanitize`, `mermaid`. Confirm each pins to a major version compatible with React 19 + ESM-first Vite 8. _Resolved versions: `react-markdown@10.1.0`, `remark-gfm@4.0.1`, `rehype-slug@6.0.0`, `rehype-autolink-headings@7.1.0`, `@shikijs/rehype@4.0.2`, `rehype-sanitize@6.0.0`, `mermaid@11.14.0`._
- [x] `bun add -d` the dev-only deps: `unified`, `unist-util-visit` (for the custom plugins' AST traversal), `@types/hast`, `@types/mdast` (TypeScript helpers). _Resolved: `unified@11.0.5`, `unist-util-visit@5.1.0`, `@types/hast@3.0.4`, `@types/mdast@4.0.4`._
- [x] Create the `src/portal/markdown/` directory with empty stubs per DESIGN-0002 §Where it lives:
  - `src/portal/markdown/index.ts` (public exports — re-exports `<DocumentView>` + `<Snippet>`)
  - `src/portal/markdown/pipeline.ts` (plugin chain — empty `export {}` stub)
  - `src/portal/markdown/DocumentView.tsx` (page-level renderer — typed prop interface, returns `null`)
  - `src/portal/markdown/Snippet.tsx` (search snippet — typed prop interface, returns `null`)
  - `src/portal/markdown/components/{Anchor,Code,MermaidBlock}.tsx` (empty stubs with TODO comments tying back to Phase 4)
  - `src/portal/markdown/plugins/{strip-docz-boilerplate,mermaid-marker}.ts` (empty stubs with TODO comments tying back to Phase 3)
  - `src/portal/markdown/README.md` (pointer to DESIGN-0002 + IMPL-0003 with the public-API and internal-layout sections)
- [x] Run `just check` — typecheck, lint, format, tests should all stay green with the new deps installed and stubs in place. _36/36 tests green._
- [x] Run `just build` — confirm the new deps don't break the production build. Note any chunk-size changes. _Bundle sizes unchanged from pre-IMPL-0003 baseline (pipeline.ts is `export {}`, so the new deps are tree-shaken). Build remains MSW-clean._

#### Success Criteria

- `bun install` resolves cleanly with no peer-dependency warnings.
- `just check` exits 0; 36/36 existing tests still green.
- `just build` succeeds; the production bundle is still MSW-clean (no regressions to the IMPL-0002 success criteria).
- New module tree is in place under `src/portal/markdown/` with all eight stub files.

---

### Phase 2: Build the unified plugin chain (no custom plugins)

Wire the first-party plugin chain end-to-end with no custom plugins yet. This proves the SSR-renders-Markdown path in isolation; custom plugins land in Phase 3.

#### Tasks

- [ ] In `src/portal/markdown/pipeline.ts`, define the unified processor factory: `remark-parse` → `remark-gfm` → `remark-rehype` → `rehype-slug` → `rehype-autolink-headings` → `@shikijs/rehype` → `rehype-sanitize`. Cache as a **module-level singleton** to avoid re-instantiating per render (Resolved §6).
- [ ] Configure `@shikijs/rehype` with the dual-theme option (`themes: { light, dark }`) per DESIGN-0002 Resolved Q1. Use the `--color-bg-code` / `--color-fg-code` design-system tokens once they ship in `@donaldgifford/design-system@0.3.0` (Resolved §2 — that bump is a hard prerequisite for Phase 2).
- [ ] Configure `rehype-autolink-headings` with `behavior: 'prepend'`, `class: 'heading-anchor'`, and an `ariaLabel` of `"Permalink to <heading text>"` per DESIGN-0002 Resolved Q4 + Resolved §5.
- [ ] Configure `rehype-sanitize` starting from the GFM-extended `defaultSchema`, plus the DESIGN-0002 allowlist additions: `data-mermaid-*` attrs, `class` on `<pre>` / `<code>` / `<span>` (Shiki output), `id` on headings, `class="heading-anchor"` on anchor links, `<mark>` (snippet rendering — even though Phase 6 hasn't shipped yet, the schema is shared).
- [ ] Implement `<DocumentView document={document} />` in `src/portal/markdown/DocumentView.tsx`: takes a `Document`, runs `document.body` through the processor, returns a React tree. Provide `links` via a React context provider so Phase 4's `<Anchor>` can consume it without prop drilling.
- [ ] Add `src/portal/markdown/styles.css` (or a CSS module — TBD per repo convention) for prose styling: heading hierarchy, paragraph spacing, list styles, code-block frame, blockquote, tables. **Tokens only**, no raw colors.
- [ ] Unit tests in `tests/portal/markdown/pipeline.test.ts`:
  - GFM features: tables, task lists, autolinks, strikethrough.
  - Heading IDs are stable kebab-case slugs.
  - Heading anchors are prepended with the right class.
  - Shiki-highlighted code blocks render `<pre><code class="language-..."><span style="...">` shape.
  - Sanitization passes through allowlisted attrs, drops everything else.
- [ ] Adversarial sanitization tests in `tests/portal/markdown/sanitize.test.ts`: feed `<script>`, `<iframe>`, `<object>`, `<form>`, `style="..."`, `on*` handlers, `javascript:` href — assert each is stripped or escaped.

#### Success Criteria

- `<DocumentView>` renders a representative fixture body to expected HTML (snapshot test against one of the IMPL-0002 fixtures).
- All five GFM extensions render correctly.
- Headings have stable `id` attrs and prepended anchors with `class="heading-anchor"`.
- Code blocks are syntax-highlighted with both light and dark theme spans embedded; switching `data-theme` re-styles them with no JS.
- Sanitizer rejects every adversarial input in the test set.
- `just check` 100% green; new tests added are isolated and don't leak state.

---

### Phase 3: Custom remark / rehype plugins

Land the two custom plugins that handle docz-specific concerns and mermaid handoff to Phase 4.

#### Tasks

- [ ] Implement `src/portal/markdown/plugins/strip-docz-boilerplate.ts` per DESIGN-0002 §Stripping docz boilerplate. Walk the mdast and remove:
  - Any `html` node whose value matches `/^<!--\s*markdownlint-/`.
  - Any subtree between an `html` node matching `/^<!--\s*toc:start\s*-->/` and the next `html` node matching `/^<!--\s*toc:end\s*-->/`, inclusive.
- [ ] Implement `src/portal/markdown/plugins/mermaid-marker.ts`: walk the hast, find `<pre><code class="language-mermaid">` (after `remark-rehype`, before `@shikijs/rehype` so shiki doesn't try to highlight the diagram source). Replace with a `<pre data-mermaid-source="<source>">` element so Phase 4's `<MermaidBlock>` picks it up.
- [ ] Insert both plugins into `pipeline.ts` at the correct stages (`strip-docz-boilerplate` between `remark-gfm` and `remark-rehype`; `mermaid-marker` between `remark-rehype` and `@shikijs/rehype`).
- [ ] Update the sanitize allowlist to permit `data-mermaid-source` on `<pre>`.
- [ ] Unit tests in `tests/portal/markdown/plugins/strip-docz-boilerplate.test.ts` per DESIGN-0002 §Testing Strategy:
  - Comment-only fixture.
  - TOC-only fixture (start + end markers + nested list).
  - Both comment and TOC.
  - Neither (no-op).
  - Malformed pairs (start without end, end without start).
  - Nested unrelated comments (e.g., a literal `<!-- not-a-toc -->` should pass through).
- [ ] Unit tests in `tests/portal/markdown/plugins/mermaid-marker.test.ts`:
  - `mermaid` fence — replaced with `data-mermaid-source` `<pre>`.
  - Non-mermaid fence (`go`, `sh`) — untouched.
  - No-language fence — untouched.
  - Multiple mermaid blocks in one doc — each replaced independently.

#### Success Criteria

- Feeding a real fixture (e.g., `tests/examples/docs/rfc/0001-adopt-msw-dev-mode.md`'s body) through the pipeline produces output with no `<!-- markdownlint-* -->` or `<!-- toc:* -->` artifacts.
- A doc containing a ` ```mermaid ` fence emits a `<pre data-mermaid-source="...">` instead of a syntax-highlighted `<pre><code>`.
- All plugin unit tests pass; existing pipeline tests from Phase 2 stay green.

---

### Phase 4: React component overrides

Add the page-aware components that consume the rendered tree: link resolution, code-block wrapper, mermaid hydration.

#### Tasks

- [ ] Implement `<Anchor>` in `src/portal/markdown/components/Anchor.tsx` per DESIGN-0002 §Cross-document link resolution:
  - Consume `links` via context.
  - Match the `href` against `links[].target` first, then fall back to `links[].href` (Resolved §4).
  - Translate API-shaped `href` to portal route via `apiHrefToPortalRoute` in `src/portal/api/docId.ts` (Resolved §1 — colocated with `urlIdFromCanonical` / `canonicalFromUrl`).
  - Render `<Link>` (RR7) for resolved internal links, `<a target="_blank" rel="noopener noreferrer">` for external URLs, `<span data-broken-link>` for unmatched internal hrefs.
- [ ] Implement `<Code>` in `src/portal/markdown/components/Code.tsx`:
  - Pass through to a `<pre>` wrapper that owns the styling surface.
  - Detect `data-mermaid-source` and route to `<MermaidBlock>` when present.
  - Leave the `<pre>` shape ready for a future copy button (DESIGN-0002 Resolved Q3).
- [ ] Implement `<MermaidBlock>` in `src/portal/markdown/components/MermaidBlock.tsx`:
  - SSR safety: render the source in a placeholder `<pre>` until hydration so search engines + no-JS clients see the diagram source.
  - On client mount (`useEffect`): import the `mermaid` package dynamically via `await import("mermaid")` so non-mermaid pages don't pay the ~700KB JS cost (Resolved §7), then call `mermaid.run({ nodes: [el] })`.
  - Read the current theme via `useTheme()` from `@donaldgifford/design-system/theme`; pass `'default'` (light) or `'dark'` to `mermaid.initialize`. Re-render diagrams when the theme flips.
  - Skeleton placeholder `<pre>` with a CSS `min-height` to avoid layout shift on hydration.
- [ ] Wire all three components into `react-markdown`'s `components` prop inside `<DocumentView>`.
- [ ] Tests in `tests/portal/markdown/components/`:
  - `Anchor.test.tsx`: links[] hit (resolves to portal `<Link>`), links[] miss + external URL (renders `<a>` with rel/target), links[] miss + internal-looking URL (renders broken-link `<span>`), API-href translation produces the right portal route.
  - `Code.test.tsx`: passes through plain code blocks; routes to `<MermaidBlock>` when `data-mermaid-source` is present.
  - `MermaidBlock.test.tsx`: jsdom-friendly assertion that the placeholder `<pre>` is rendered SSR-side; mock `mermaid` so the test doesn't need the actual library.

#### Success Criteria

- `<Anchor>` renders the right element for each of the four cases (resolved-internal, external, broken, plain-text).
- `<Code>` passes plain code blocks through unchanged but swaps to `<MermaidBlock>` for mermaid sources.
- `<MermaidBlock>` ships a placeholder in SSR that's replaced after client hydration; the `mermaid` import is dynamic (verified by inspecting the production bundle's chunk graph).
- Theme toggle re-renders mermaid diagrams in the new palette.
- All component unit tests pass; pipeline tests from Phase 2/3 still green.

---

### Phase 5: Replace the `<pre>` placeholder in `$type.$id.tsx`

The user-visible swap. Removes the `<pre className={styles.body}>{doc.body ?? ""}</pre>` placeholder shipped in IMPL-0001 Phase 4 and replaces it with `<DocumentView document={loaderData} />`.

#### Tasks

- [ ] In `src/routes/$type.$id.tsx`, replace the `<pre>` element with `<DocumentView document={doc} />`. Keep the page chrome (breadcrumb, title, dateline, `<Badge>`, authors line) unchanged.
- [ ] Update or remove `$type.$id.module.css`'s `.body` class — the `<pre>` is gone; the prose styling now lives in `src/portal/markdown/styles.css`.
- [ ] Add a `tests/api/docPageRender.test.tsx` assertion that the rendered output contains GFM-rendered HTML elements (e.g., `<h2>` from a `## Motivation` source) — not raw Markdown text in a `<pre>`. The existing assertion `expect(screen.getByText(/Iterating on the portal currently/)).toBeInTheDocument()` should still work because the prose text is preserved; the assertion can be tightened to `screen.getByRole("heading", { level: 2, name: "Motivation" })`.
- [ ] Smoke against `just dev-msw` and `just dev` (with a seeded `rfc-api` row): visit a doc page, confirm the body renders as proper headings / lists / code blocks / mermaid diagrams (where present in fixtures).
- [ ] Verify `<RouteErrorBoundary>` still surfaces the 7807 not-found path correctly — the error boundary contract is upstream of `<DocumentView>` and shouldn't be affected, but worth confirming end-to-end.

#### Success Criteria

- The `<pre>` placeholder is gone from `$type.$id.tsx`.
- A doc page with a fixture body renders proper Markdown HTML (headings, code blocks, links, etc.) per visual inspection.
- `tests/api/docPageRender.test.tsx` assertions reflect the new rendered shape and stay green.
- `just dev-msw` smoke: `/rfc/0001` shows a rendered `# Adopt MSW-backed dev mode for the portal` heading + structured prose, not raw Markdown.
- `just check` 100% green; `just build` succeeds with no MSW/faker regressions.

---

### Phase 6: Search-snippet renderer (`<Snippet>`)

Smaller, narrower pipeline for `SearchResult.snippet` HTML. Phase 7 wires it into a minimal `/search` page so the component is shaped to a real caller (Resolved §3).

#### Tasks

- [ ] Implement `<Snippet html={...} />` in `src/portal/markdown/Snippet.tsx` per DESIGN-0002 §Search-snippet rendering:
  - Pipeline: `rehype-parse` → `rehype-sanitize` (allowlist: `<em>`, `<mark>`, `<strong>`, `<code>` only — strict) → `rehype-react`.
  - Falls back to a plain-text rendering of `matched_terms` when HTML rendering isn't appropriate (a11y tooling, RSS, etc.).
- [ ] Tests in `tests/portal/markdown/Snippet.test.tsx`:
  - Allowlisted tags (`<em>`, `<mark>`, `<strong>`, `<code>`) survive the sanitize pass.
  - Disallowed tags (`<script>`, `<a>`, `<img>`, anything else) are stripped.
  - Plain-text fallback renders the matched-terms array when the `html` prop is unset.

#### Success Criteria

- `<Snippet>` renders allowlisted HTML correctly.
- `<Snippet>` strips everything else.
- Plain-text fallback works.
- `<Snippet>` exists as a ready-to-use export; Phase 7 consumes it.

---

### Phase 7: Minimal search-results page

Wire `<Snippet>` into a real caller so the component's API gets exercised end-to-end. Deliberately narrow — q input, list of results, snippet preview, link to the doc page. Sort/filter/facet UI is out of scope.

#### Tasks

- [ ] Add `src/routes/search.tsx` (RR7 flat-routes convention). Define a `loader` that reads `?q=` from the URL, calls the orval-generated `searchDocs` hook against `rfc-api`, and returns `{ q, results }`. Empty `q` returns `{ q: "", results: [] }` (no API call) so the page renders a stable empty state.
- [ ] Implement the route component:
  - Search input bound to the `q` query param (controlled via `useSearchParams`).
  - Result list: each item shows `result.type` + `result.id` + title (linked to `/${type}/${urlIdFromCanonical(id)}`), `<Snippet html={result.snippet} fallbackTerms={result.matched_terms} />`, and the score (raw — visualisation is a follow-up).
  - Empty `q` state: prompt copy ("Search across all documents…").
  - No-results state: explicit "no results for `<q>`" message.
- [ ] Export `loader`, `default` component, `HydrateFallback`, and `ErrorBoundary` (the shared `<RouteErrorBoundary>` per IMPL-0001 Phase 4). Reuse the `<Skeleton>` pattern for the hydrate fallback.
- [ ] Add `src/routes/search.module.css` for the page-specific layout (input, result-card grid). Tokens only.
- [ ] Add a navigation entry to `src/routes/_index.tsx` or the layout chrome so users can reach `/search` (a simple `<Link to="/search">` in the directory page header is sufficient — full nav redesign out of scope).
- [ ] Tests:
  - `tests/api/searchRoute.test.ts` — loader unit: empty `q` short-circuits, populated `q` calls `searchDocs` with the right params, problem responses propagate to `<RouteErrorBoundary>`.
  - `tests/api/searchRouteRender.test.tsx` — full render via `createRoutesStub` against the shared MSW handlers: empty state, populated results render `<Snippet>` content, doc-link `href` uses the URL form (`/rfc/0001`, not `/RFC-0001`).
- [ ] Smoke against `just dev-msw`: visit `/search?q=postgres`, confirm the ADR-0001 fixture surfaces with snippet HTML rendered.

#### Success Criteria

- `/search` route is reachable from the directory page.
- Empty `q` renders the prompt state with no API call.
- A populated `q` renders a result list using `<Snippet>` for each item; doc links route to the correct portal page (URL form, not canonical).
- Loader, render, and full-route tests all green.
- `just dev-msw` smoke: `?q=postgres` returns the seeded ADR-0001 fixture; `?q=zzz` renders the no-results state.
- `just check` 100% green; `just build` clean.

---

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | Add the seven Phase-1 runtime deps + four dev deps. |
| `src/portal/markdown/index.ts` | Create | Public exports (`<DocumentView>`, `<Snippet>`). |
| `src/portal/markdown/pipeline.ts` | Create | Module-level singleton unified processor factory. |
| `src/portal/markdown/DocumentView.tsx` | Create | Page-level renderer; provides `links` context. |
| `src/portal/markdown/Snippet.tsx` | Create | Search-snippet renderer (Phase 6). |
| `src/portal/markdown/components/Anchor.tsx` | Create | Custom `<a>`: links[] resolution + API-URL translation. |
| `src/portal/markdown/components/Code.tsx` | Create | Custom `<pre>`/`<code>` wrapper; mermaid swap. |
| `src/portal/markdown/components/MermaidBlock.tsx` | Create | Client-side mermaid hydration. |
| `src/portal/markdown/plugins/strip-docz-boilerplate.ts` | Create | Custom remark plugin (TOC + markdownlint comments). |
| `src/portal/markdown/plugins/mermaid-marker.ts` | Create | Custom rehype plugin (tag mermaid blocks). |
| `src/portal/markdown/styles.css` | Create | Prose styling — tokens only, no raw colors. |
| `src/portal/markdown/README.md` | Create | One-paragraph pointer to DESIGN-0002 + this IMPL. |
| `src/routes/$type.$id.tsx` | Modify | Phase 5: swap `<pre>` for `<DocumentView>`. |
| `src/routes/$type.$id.module.css` | Modify | Phase 5: drop `.body` rule. |
| `src/portal/api/docId.ts` | Modify | Phase 4: add `apiHrefToPortalRoute` alongside `urlIdFromCanonical` / `canonicalFromUrl`. |
| `src/routes/search.tsx` | Create | Phase 7: minimal `/search` route (loader + component + boundaries). |
| `src/routes/search.module.css` | Create | Phase 7: search-page layout. |
| `src/routes/_index.tsx` | Modify | Phase 7: add nav entry to `/search`. |
| `tests/portal/markdown/**` | Create | Plugin, pipeline, sanitize, component tests. |
| `tests/api/docPageRender.test.tsx` | Modify | Phase 5: assertion shape change (HTML not `<pre>`). |
| `tests/api/searchRoute.test.ts` | Create | Phase 7: search loader unit tests. |
| `tests/api/searchRouteRender.test.tsx` | Create | Phase 7: search full-render via `createRoutesStub`. |
| `package.json` (design-system bump) | Modify | Phase 2 prerequisite: bump to `@donaldgifford/design-system@0.3.0` once code tokens ship. |
| `CLAUDE.md` | Modify | Per-phase repo-state updates as IMPL-0003 progresses. |

## Testing Plan

- **Phase 1** (scaffold): `just check` 36/36 green; `just build` clean.
- **Phase 2** (pipeline): pipeline + sanitize unit tests against a representative fixture body and adversarial-input set.
- **Phase 3** (plugins): strip-docz-boilerplate fixtures (six cases per DESIGN-0002 §Testing Strategy); mermaid-marker fixtures.
- **Phase 4** (components): Anchor / Code / MermaidBlock unit tests; mock `mermaid` to keep tests jsdom-friendly.
- **Phase 5** (route swap): `tests/api/docPageRender.test.tsx` updated to assert the new rendered shape; manual `just dev-msw` + `just dev` smoke.
- **Phase 6** (snippet): `<Snippet>` allowlist + fallback tests.
- **Phase 7** (search page): loader + full-render tests; `just dev-msw` smoke against the seeded fixture corpus.

All new tests use the existing test infrastructure: vitest + jsdom + RTL + the shared MSW handlers from `tests/api/server.ts`. The IMPL-0002 fixture corpus at `tests/examples/docs/<type>/*.md` is the canonical realistic-content source.

## Dependencies

- **Hard:** `react-markdown@^9`, `remark-gfm@^4`, `rehype-slug@^6`, `rehype-autolink-headings@^7`, `@shikijs/rehype@^1`, `rehype-sanitize@^6`, `mermaid@^11`, plus `unified` and `unist-util-visit` for the custom plugins. _(Versions to verify against React 19 + Vite 8 compat during Phase 1.)_
- **Hard (cross-repo):** `@donaldgifford/design-system@0.3.0` shipping `--color-bg-code` / `--color-fg-code` tokens is a Phase 2 prerequisite (Resolved §2). If the tokens aren't available yet, ship the bump in the design-system repo first (changeset + release workflow per CLAUDE.md §When iterating on the design system in parallel).
- **Soft (Phase 7):** the orval-generated `searchDocs` hook must already exist in `src/portal/api/__generated__/`. It does (verified during IMPL-0001). No spec drift expected.
- **Upstream:** [donaldgifford/rfc-api#20](https://github.com/donaldgifford/rfc-api/issues/20) (slug-parity contract test) is parallel work, not a blocker.

## Resolved Questions

Decisions made before Phase 1 starts. All seven open questions resolved 2026-05-01; Phase 7 added in response to §3.

1. **`apiHrefToPortalRoute` placement.** Lives in `src/portal/api/docId.ts` alongside `urlIdFromCanonical` / `canonicalFromUrl`. Symmetry with the existing helpers wins over keeping it private to `<Anchor>`.
2. **Shiki theme tokens.** Add `--color-bg-code` / `--color-fg-code` (and any companion code-syntax tokens needed for dual-theme alignment) to `@donaldgifford/design-system@0.3.0` before Phase 2. The "no theme branching, missing piece is a token" rule in CLAUDE.md applies.
3. **`<Snippet>` consumer.** Phase 7 ships a deliberately minimal `/search` page so `<Snippet>` gets exercised end-to-end against the IMPL-0002 fixture corpus + shared MSW handlers. Sort/filter/facet UI is a follow-up IMPL.
4. **`<Anchor>` link match precedence.** Match `links[].target` first (canonical id — the stable identifier; relative paths get rewritten by `rfc-api`'s ingest), then fall back to `links[].href` (API URL).
5. **Heading anchor `aria-label`.** `Permalink to <heading text>`.
6. **Processor caching.** Module-level singleton. SSR render is pure (input: body string, output: HTML), so the processor safely outlives requests. Reassess only if a future plugin needs request-scoped state.
7. **Mermaid lazy loading.** Dynamic `await import("mermaid")` inside `<MermaidBlock>`'s `useEffect`. Keeps the ~700KB library out of the main bundle for non-mermaid pages.

## References

In this repo:

- [DESIGN-0002 — Markdown rendering pipeline](../design/0002-markdown-rendering-pipeline.md) — the design this IMPL implements; phase ordering follows §Migration / Rollout Plan.
- [DESIGN-0001 — Portal architecture and ds-candidates promotion model](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md) — the renderer lives under `portal/`, never `ds-candidates/`.
- [ADR-0001 — Consume rfc-api via its published OpenAPI contract](../adr/0001-consume-rfc-api-via-its-published-openapi-contract.md) — `Document.body`, `Document.links[]`, `SearchResult.snippet` shapes; URL form contract for `Document.id`.
- [IMPL-0001 — Bootstrap the portal scaffold](./0001-bootstrap-portal-scaffold-per-design-0001.md) — Phase 4 shipped the `<pre>` placeholder this IMPL replaces.
- [IMPL-0002 — Wire up `API_MODE=msw` local dev mode](./0002-wire-up-apimodemsw-local-dev-mode.md) — fixture corpus + shared MSW handlers this IMPL's tests build on.
- [Integration reference §Markdown contract](../integration/rfc-api-reference.md#markdown-contract) — what the body actually contains.
- [Vendored OpenAPI spec — `api/openapi.yaml`](../../api/openapi.yaml) — `Document`, `Link`, `SearchResult` schemas.
- **`CLAUDE.md` §Hard rules** — load-bearing rules for portal code, including the `Document.id` URL form rule that `<Anchor>` must respect.

External:

- [unified](https://unifiedjs.com/) — AST toolchain.
- [react-markdown](https://github.com/remarkjs/react-markdown) — top-level wrapper.
- [remark-gfm](https://github.com/remarkjs/remark-gfm) — GFM extensions.
- [rehype-sanitize](https://github.com/rehypejs/rehype-sanitize) — HTML sanitization with allowlist schema.
- [rehype-slug](https://github.com/rehypejs/rehype-slug) + [rehype-autolink-headings](https://github.com/rehypejs/rehype-autolink-headings) — heading IDs and anchors.
- [Shiki](https://shiki.style/) + [`@shikijs/rehype`](https://shiki.style/packages/rehype) — SSR syntax highlighting.
- [Mermaid](https://mermaid.js.org/) — client-side diagram rendering.
