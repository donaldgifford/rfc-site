---
id: DESIGN-0002
title: "Markdown rendering pipeline"
status: Draft
author: Donald Gifford
created: 2026-04-27
---
<!-- markdownlint-disable-file MD025 MD041 -->

# DESIGN 0002: Markdown rendering pipeline

**Status:** Draft
**Author:** Donald Gifford
**Date:** 2026-04-27

<!--toc:start-->
- [Overview](#overview)
- [Goals and Non-Goals](#goals-and-non-goals)
  - [Goals](#goals)
  - [Non-Goals](#non-goals)
- [Background](#background)
- [Detailed Design](#detailed-design)
  - [Pipeline at a glance](#pipeline-at-a-glance)
  - [Plugin chain](#plugin-chain)
  - [Cross-document link resolution](#cross-document-link-resolution)
  - [Stripping docz boilerplate](#stripping-docz-boilerplate)
  - [Mermaid strategy: client-side hydration](#mermaid-strategy-client-side-hydration)
  - [Search-snippet rendering](#search-snippet-rendering)
  - [Where it lives in the codebase](#where-it-lives-in-the-codebase)
- [API / Interface Changes](#api--interface-changes)
- [Data Model](#data-model)
- [Testing Strategy](#testing-strategy)
- [Migration / Rollout Plan](#migration--rollout-plan)
- [Open Questions](#open-questions)
  - [Resolved during initial review](#resolved-during-initial-review)
  - [Still open](#still-open)
- [References](#references)
<!--toc:end-->

## Overview

`rfc-api` returns each document's body as **raw Markdown**; the portal SSR-renders it to sanitized HTML. This design specifies the parser, plugin chain, syntax-highlighting strategy, mermaid handling, sanitization rules, and where the pipeline sits in the codebase. The rendered output must be safe (no raw HTML / JS passthrough), accessible (heading anchors, link semantics), and consistent across the document corpus that `rfc-api` ingests from any docz repo.

This design is the deferred *"Markdown rendering pipeline"* open question from [DESIGN-0001](./0001-portal-architecture-and-ds-candidates-promotion-model.md#open-questions).

## Goals and Non-Goals

### Goals

- Render `Document.body` (raw Markdown) to sanitized HTML in the SSR pass, so documents are search-engine readable and visible without JS.
- Support the Markdown features actually present in docz-authored content: GFM (tables, task lists, autolinks, strikethrough), fenced code blocks with language hints, mermaid diagrams, GitHub-style admonition-ish blockquotes.
- Strip docz boilerplate (`<!-- toc:start ... toc:end -->`, `<!-- markdownlint-disable-file ... -->`) before rendering — these are author-tooling artifacts, not content.
- Resolve cross-document links from `Document.links[]` (per [DESIGN-0001 §Where the API client lives](./0001-portal-architecture-and-ds-candidates-promotion-model.md#where-the-api-client-lives)), not by parsing relative paths in the body.
- Add stable heading IDs + autolinks (`#section-slug`) to support deep-linking from search results (`section_slug` in `SearchResult`).
- Sanitize aggressively — assume the Markdown could contain hostile HTML, even though `rfc-api` says it shouldn't.

### Non-Goals

- **MDX / JSX in Markdown.** Per the [integration reference](../integration/rfc-api-reference.md#markdown-contract), `rfc-api` parses pure Markdown and the portal does not interpret JSX. If a document contains literal `<Component />`, it gets sanitized to escaped text.
- **AsciiDoc.** Oxide's `rfd-site` renders AsciiDoc; we do not. `rfc-api` is Markdown-only.
- **Authoring UX.** This design is read-only rendering. Editing, previewing, or round-tripping Markdown is out of scope.
- **Building the page-level TOC component.** The portal will surface a per-page TOC sidebar from heading data, but that's a portal-feature concern. This design only ensures heading IDs are stable so the TOC can deep-link.
- **Caching / memoization of rendered HTML.** Per-pod cache of `body → HTML` is a future optimization; for v1 we render on every SSR request.

## Background

`rfc-api`'s [Markdown contract](../integration/rfc-api-reference.md#markdown-contract) tells us what to expect in the body:

- GitHub-Flavored Markdown baseline (headings, lists, tables, task lists, fenced code blocks, autolinks, reference-style links).
- Code fences with language hints (` ```go `, ` ```sh `, ` ```json `).
- Mermaid diagrams in fenced `mermaid` blocks.
- Admonition-ish patterns (`> **Note:** ...`) that are *not* syntactically special — they render as ordinary blockquotes.
- Relative cross-document links (e.g. `[DESIGN-0001](./0001-...md)`) that the portal resolves from `Document.links[]`, **not** by parsing the body.
- HTML comments at the top of the file, specifically `<!-- toc:start --> ... <!-- toc:end -->` and `<!-- markdownlint-disable-file MD025 MD041 -->`, which are tooling artifacts to strip.

And tells us what we *will not* see:

- No raw HTML passthrough (but sanitize anyway — defense in depth against future author drift).
- No JSX / MDX.
- No `<script>`, `<iframe>`, or `<style>`.

The React/TypeScript ecosystem for Markdown rendering converges on the [unified](https://unifiedjs.com/) toolchain: `remark-*` (Markdown AST), `rehype-*` (HTML AST), and pluggable transforms between them. `react-markdown` is the React-friendly wrapper around unified that produces React elements directly. We adopt that stack.

## Detailed Design

### Pipeline at a glance

```
Markdown body (string)
       ↓
remark-parse                    ← Markdown → mdast
       ↓
remark-gfm                      ← GFM extensions (tables, task lists, autolinks, strikethrough)
       ↓
remark-strip-docz-boilerplate   ← custom: drop <!-- toc:* --> and <!-- markdownlint-* --> nodes
       ↓
remark-rehype                   ← mdast → hast (HTML AST)
       ↓
rehype-slug                     ← add stable id="..." to headings
       ↓
rehype-autolink-headings        ← add <a class="anchor" href="#slug"> to headings
       ↓
@shikijs/rehype                 ← syntax-highlight fenced code blocks (themed)
       ↓
rehype-mermaid-marker           ← custom: leave mermaid <pre><code> blocks unhighlighted
                                   and tag them so the client picks them up
       ↓
rehype-sanitize                 ← drop anything not on the allowlist
       ↓
react-markdown                  ← hast → React elements with custom component overrides
       ↓
React tree (server-rendered HTML, then hydrated for mermaid + future interactivity)
```

### Plugin chain

| Stage | Package | Role |
|---|---|---|
| Parser | [`react-markdown`](https://github.com/remarkjs/react-markdown) | Top-level React wrapper around unified. Accepts plugins for both remark and rehype phases via `remarkPlugins` / `rehypePlugins`. |
| GFM | [`remark-gfm`](https://github.com/remarkjs/remark-gfm) | Tables, task lists, autolinks, strikethrough, footnotes. Matches what's in our docz corpus. |
| Boilerplate strip | (custom — see below) | Walk the mdast and remove `html` nodes matching docz-tooling comment patterns. |
| Heading IDs | [`rehype-slug`](https://github.com/rehypejs/rehype-slug) | Stable `id="kebab-case-heading"`. Aligns with `SearchResult.section_slug` from `rfc-api` so deep-links from search work. |
| Heading autolinks | [`rehype-autolink-headings`](https://github.com/rehypejs/rehype-autolink-headings) | Append `<a class="anchor" href="#slug" aria-label="...">` to each heading. Hover-reveal styled in CSS. |
| Code highlighting | [`@shikijs/rehype`](https://shiki.style/) | Build/render-time syntax highlighting using TextMate grammars. SSR-safe — produces pre-highlighted HTML, no client runtime. Configured with **dual themes** via Shiki's `themes: { light, dark }` option — Shiki emits HTML with both palettes inlined and a CSS variable switch keyed off `data-theme`, so code blocks restyle when the design-system theme flips with no JS. The two themes are picked to match the design system's `--color-bg-code` / `--color-fg-code` tokens in light and dark mode respectively. |
| Mermaid marker | (custom) | Recognize ```` ```mermaid ```` fences, prevent shiki from highlighting them, and emit a marker (`data-mermaid-source="..."` on a `<pre>`) so the client component can render the diagram on hydration. |
| Sanitization | [`rehype-sanitize`](https://github.com/rehypejs/rehype-sanitize) | Filter the hast against an allowlist. Start from the GFM-extended `defaultSchema` and add: `data-mermaid-*` attrs, `class` on `<pre>`/`<code>`/`<span>` (for shiki output), `id` on headings (for slugs), `class="anchor"` on heading autolinks, `<mark>` and `<em>` (for search snippets, see below). Reject everything else: `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `style` attribute, `on*` event handlers, `javascript:` URLs. |
| Custom React components | (in `react-markdown` `components` prop) | Override `<a>`, `<pre>`, `<code>`, `<img>` to inject portal-specific behaviour (link resolution from `links[]`; mermaid hydration; lazy image loading). |

### Cross-document link resolution

This is the load-bearing rule from [DESIGN-0001](./0001-portal-architecture-and-ds-candidates-promotion-model.md#where-the-api-client-lives): cross-document links are resolved from the doc payload's `links[]` array, **not** by parsing relative paths in the body.

Concretely, the renderer is given two inputs: `(body: string, links: Link[])`. The custom `<a>` component consults `links` first:

```tsx
function Anchor({ href, children, ...rest }: AnchorProps) {
  const resolved = useMemo(
    () => links.find((l) => l.href === href || l.target === href),
    [href, links],
  );
  if (resolved) {
    return <Link to={apiHrefToPortalRoute(resolved.href)}>{children}</Link>;
  }
  if (isExternalUrl(href)) {
    return <a href={href} rel="noopener noreferrer" target="_blank" {...rest}>{children}</a>;
  }
  // Unknown internal href — render as plain text or "broken link" indicator.
  return <span data-broken-link>{children}</span>;
}
```

**`Link.href` shape.** Per the [integration reference example](../integration/rfc-api-reference.md#document-payload-shape), `Link.href` is API-shaped — e.g. `"/api/v1/adr/1"`, not `"/adr/1"`. The portal must translate to a route path before handing it to `<Link>`. `apiHrefToPortalRoute` strips the `/api/v1` prefix:

```ts
function apiHrefToPortalRoute(apiHref: string): string {
  return apiHref.replace(/^\/api\/v1/, "");
}
```

The bare-numeric URL `:id` segment in `Link.href` (`/api/v1/adr/1`) is preserved through this translation — the result `/adr/1` is exactly what the route loader at `$type.$id.tsx` expects per the OpenAPI `DocID` contract (`^[0-9]+$`). Sending the canonical id (`/adr/ADR-0001`) would 404 server-side, the same trap commit `f8883c7` fixed for directory-card links. See the **CLAUDE.md §Hard rules** entry on the URL form of `Document.id`, and `src/portal/api/docId.ts` for the `urlIdFromCanonical` / `canonicalFromUrl` helpers used elsewhere in the portal.

The `links` array is provided via React context from the page-level `<DocumentView document={...} />` component. Candidate primitives in `ds-candidates/` never see `links` and never know about cross-document resolution — that logic lives in `portal/` per DESIGN-0001.

### Stripping docz boilerplate

docz-authored documents typically open with:

```markdown
<!-- markdownlint-disable-file MD025 MD041 -->

# DESIGN 0001: Title

<!--toc:start-->
- [Overview](#overview)
...
<!--toc:end-->

## Overview
```

These three constructs (`markdownlint-disable-file` HTML comment, `toc:start ... toc:end` block, the auto-generated TOC list inside) are author-tooling artifacts. Rendered as-is they show up either as visible Markdown lists (the TOC) or as nothing visible (the comments) — but they clutter the heading-derived TOC the portal builds and confuse readers who see two TOCs.

**Strategy:** a small custom remark plugin (`remark-strip-docz-boilerplate`) walks the mdast and removes:

- Any `html` node whose value matches `/^<!--\s*markdownlint-/`.
- Any subtree between an `html` node matching `/^<!--\s*toc:start\s*-->/` and the next `html` node matching `/^<!--\s*toc:end\s*-->/`, inclusive.

This runs *before* `remark-rehype` so the rest of the pipeline never sees these nodes. The plugin lives in `src/portal/markdown/plugins/strip-docz-boilerplate.ts` and is unit-tested with realistic fixtures.

### Mermaid strategy: client-side hydration

Two viable approaches:

1. **SSR mermaid:** invoke `@mermaid-js/mermaid-cli` (headless Chromium) at render time to produce SVG. Cached HTML is fully self-contained.
2. **Client-side render:** ship the source mermaid in a `<pre data-mermaid-source="...">`, hydrate with the `mermaid` package on the client, replace the `<pre>` with the rendered SVG.

**We adopt option 2 (client-side hydration)** for v1.

Why:

- SSR mermaid requires a headless browser at request time (or a build-time cache), which adds infra complexity disproportionate to the use case (most docs have zero or one mermaid diagram).
- Client-side render is graceful-degradable: if JS is disabled, the user sees the mermaid source in a code block, not a broken image.
- The mermaid library's CSR API is straightforward: `mermaid.run({ nodes: [el] })`.
- TTFB and Lighthouse scores stay better with a deferred client render than with build-time SVG generation that has to ship the full SVG inline.

The trade-off is that mermaid diagrams flicker on hydration (raw text → rendered diagram). Mitigated by a `<pre>` skeleton sized to the source's likely render area, plus a CSS `min-height` to avoid layout shift.

If TTFB becomes a real issue for diagram-heavy docs later, switching to option 1 is a render-pipeline change that doesn't affect the rest of the codebase.

**Theme matching:** mermaid is initialized with a theme config tied to `data-theme`. The `<MermaidBlock>` component reads the current theme from `useTheme()` (the design-system hook) and calls `mermaid.initialize({ theme: ... })` accordingly — `'default'` for light, `'dark'` for dark, or a `'base'` config with overrides if the built-in mermaid themes don't visually match design-system tokens closely enough. On theme toggle, diagrams re-render. This keeps mermaid output visually consistent with the rest of the design-system-themed page.

### Search-snippet rendering

`rfc-api`'s `SearchResult.snippet` is matched prose with `<em>...</em>` highlight tags (per the integration reference). This is rendered via a *separate, narrower* sanitize pass — it's not full Markdown, just sanitized HTML.

For snippet rendering:

- Pipeline is `rehype-parse` → `rehype-sanitize` (allowlist: `<em>`, `<mark>`, `<strong>`, `<code>` — nothing else) → `rehype-react`.
- Lives in `src/portal/markdown/snippet.tsx`, used by the search-results page.
- Falls back to `SearchResult.matched_terms` (a string array) for accessibility tooling and for environments where HTML rendering isn't appropriate.

### Where it lives in the codebase

```
src/portal/markdown/
  index.ts                            ← public exports
  DocumentView.tsx                    ← renders body + provides links context
  Snippet.tsx                         ← search-snippet renderer
  pipeline.ts                         ← unified plugin chain configuration
  components/
    Anchor.tsx                        ← custom <a> with links[] resolution
    Code.tsx                          ← custom <pre>/<code> wrapper (copy button, mermaid swap)
    MermaidBlock.tsx                  ← client-side mermaid hydration
  plugins/
    strip-docz-boilerplate.ts         ← remark plugin (TOC + markdownlint comments)
    mermaid-marker.ts                 ← rehype plugin (tag mermaid blocks for the client)
  __tests__/                          (or colocated .test.tsx; per DESIGN-0001 we colocate)
```

Per [DESIGN-0001](./0001-portal-architecture-and-ds-candidates-promotion-model.md): all of this lives under `portal/` and is **never promoted** to the design system. Documents and Markdown rendering are portal-specific concerns.

If a primitive *inside* the rendered Markdown is reusable enough to be a `ds-candidate` (e.g., a generic `<CodeBlock>`), the candidate is shaped per DESIGN-0001 — accepts `language` and `children` props, knows nothing about Markdown — and the portal's `<Code>` wrapper above adapts to it. The wrapper stays in `portal/`; the inner primitive can promote.

## API / Interface Changes

This design introduces no portal-public API. Internal exports from `src/portal/markdown/`:

- `<DocumentView document={Document} />` — renders a full document body. Pulls `body` and `links` off the payload.
- `<Snippet html={string} />` — renders a sanitized search-snippet HTML string.

The unified plugin chain configuration (`pipeline.ts`) is a private implementation detail; consumers shouldn't reach into it.

## Data Model

No new persistent state. The renderer's inputs are the existing `Document.body` (string) and `Document.links` (array) from `rfc-api` per the [vendored OpenAPI spec](../../api/openapi.yaml).

Heading IDs are derived deterministically by `rehype-slug` from heading text — they must match `SearchResult.section_slug` from `rfc-api` (which is also slug-derived from `section_heading`). If the two slugifiers ever drift, deep-links from search results break silently.

**Resolution:** assume parity for v1, but confirm during implementation against a representative sample of headings (Unicode normalization and punctuation handling are the likely divergence points). If a divergence is found, raise it upstream in `rfc-api` as a contract bug — the canonical slug should match what readers see in the URL bar after clicking a same-page anchor. **A contract test will be added to `rfc-api/test/contract/` that asserts `slug(section_heading) == section_slug` for the corpus**, so future drift surfaces in CI rather than as silently broken deep-links.

## Testing Strategy

- **Unit tests** (vitest) for each custom plugin:
  - `strip-docz-boilerplate`: fixtures for "comment only", "TOC only", "both", "neither", malformed pairs, nested unrelated comments.
  - `mermaid-marker`: fixtures for code fences (mermaid, non-mermaid, no language hint).
- **Integration tests** for the full pipeline: feed realistic `Document.body` strings and assert the rendered HTML matches a stable snapshot. The fixture corpus at [`tests/examples/docs/<type>/*.md`](../../tests/examples/docs/) (8 hand-curated docz-shaped fixtures shipped in [IMPL-0002](../impl/0002-wire-up-apimodemsw-local-dev-mode.md) Phase 1) is the canonical source — same content the dev-mode MSW handlers serve, and `Document.body` strings come out of the loader in `src/portal/api/msw/fixtures.ts` already trimmed of frontmatter. Route-level renders go through the shared MSW handlers in `tests/api/server.ts` + `setupMswLifecycle()` (per IMPL-0002 Phase 4) so the full SSR path — loader → fetcher → MSW → `<DocumentView>` — is exercised end-to-end.
- **Sanitization tests**: feed adversarial Markdown — `<script>`, `<iframe>`, `javascript:` href, `style="..."`, `on*` handlers — and assert each is stripped or escaped.
- **Slug parity test** (future, requires a live `rfc-api` or fixture): for a representative set of heading texts, assert `rehype-slug`'s output equals `rfc-api`'s `section_slug`.
- **`<Anchor>` tests**: links[] hit, links[] miss + external URL, links[] miss + internal-looking URL (broken link).
- **Mermaid hydration smoke test**: jsdom-friendly assertion that the client component finds `[data-mermaid-source]` and replaces it.

## Migration / Rollout Plan

This is greenfield rendering — there's nothing to migrate from. The rollout is:

1. **Land the dependencies.** `react-markdown`, `remark-gfm`, `rehype-slug`, `rehype-autolink-headings`, `@shikijs/rehype`, `rehype-sanitize`, `mermaid` (client-only).
2. **Build the plugin chain.** `pipeline.ts` first, with no custom plugins — just GFM + slug + autolink + shiki + sanitize. Render a hand-written Markdown sample.
3. **Add the custom plugins.** `strip-docz-boilerplate` and `mermaid-marker`. Test against real docz corpus content.
4. **Add the React component overrides.** `<Anchor>` with `links[]` resolution; `<Code>` with mermaid swap; `<MermaidBlock>` with client hydration.
5. **Replace the `<pre>` body placeholder in `src/routes/$type.$id.tsx`** with `<DocumentView document={loaderData} />`. (IMPL-0001 Phase 4 shipped a placeholder rendering — `<pre className={styles.body}>{doc.body ?? ""}</pre>` — explicitly so this design could land as a focused swap rather than greenfield wiring.) Cycle on real content until rendering is correct against both the live `rfc-api` and `just dev-msw`.
6. **Add `<Snippet>`** when wiring the search-results page.

Each step is independent enough to merge as its own PR.

## Open Questions

### Resolved during initial review

- ~~**Shiki theme:**~~ **Dual theme, follow design system.** Use Shiki's `themes: { light, dark }` option to emit HTML with both palettes inlined; switching is keyed off `data-theme` via CSS, no JS. The themes are picked to match the design system's `--color-bg-code` / `--color-fg-code` tokens. If a needed code-related token doesn't exist in the design system, add it there (per DESIGN-0001 — "no theme branching inside components"; the missing piece is always a semantic token, never a component branch).
- ~~**Slug parity contract test:**~~ **Assume parity for v1; confirm during implementation; add a contract test in `rfc-api`.** Concretely: a test in `rfc-api/test/contract/` that asserts `slug(section_heading) == section_slug` for every indexed section in the corpus. Drift surfaces in CI on the upstream side, not as silently broken deep-links on this side. Tracked upstream as [donaldgifford/rfc-api#20](https://github.com/donaldgifford/rfc-api/issues/20).
- ~~**Code-block copy button:**~~ **Deferred but planned.** Not in v1. Recorded here so the `<Code>` component is built in a way that admits a copy button later (i.e., it owns the `<pre>` wrapper element where a button would attach).
- ~~**Heading-anchor styling:**~~ **GitHub-style: prepend the anchor, invisible until hover.** Configure `rehype-autolink-headings` with `behavior: 'prepend'` and a `class="heading-anchor"` controlled by CSS for the hover-reveal.
- ~~**Mermaid theme:**~~ **Match design-system theme.** `<MermaidBlock>` reads the current theme from `useTheme()` and calls `mermaid.initialize({ theme: ... })` accordingly (`'default'` / `'dark'`, or a `'base'` config with token-derived overrides if needed). Diagrams re-render on theme toggle.
- ~~**Footnotes:**~~ **Yes, supported via `remark-gfm`.** ID-collision namespacing is deferred — for v1 we render one document per page, so collisions can't happen. When we render multiple documents on the same page (search-results preview, side-by-side compare, etc.), namespace the footnote IDs by document, likely via a small custom rehype plugin keyed off `Document.id`.

### Still open

- *(none currently — all questions raised on initial review have been resolved)*

## References

In this repo:

- [DESIGN-0001 — Portal architecture and ds-candidates promotion model](./0001-portal-architecture-and-ds-candidates-promotion-model.md) — establishes that the renderer lives under `portal/`, never `ds-candidates/`, and the cross-document-link rule.
- [ADR-0001 — Consume rfc-api via its published OpenAPI contract](../adr/0001-consume-rfc-api-via-its-published-openapi-contract.md) — the data contract this pipeline reads from. Note the **"Document id in URLs"** row — this design's `<Anchor>` translates `Link.href` accordingly.
- [ADR-0002 — Adopt the portal frontend stack](../adr/0002-adopt-portal-frontend-stack.md) — React 19 + RR7 + TanStack Query + orval; this design slots into that stack.
- [IMPL-0002 — Wire up `API_MODE=msw` local dev mode](../impl/0002-wire-up-apimodemsw-local-dev-mode.md) — established the fixture corpus and shared MSW handlers this design's tests build on.
- [Integration reference §Markdown contract](../integration/rfc-api-reference.md#markdown-contract) — what the body actually contains and the soft recommendations this design formalizes.
- [Vendored OpenAPI spec — `api/openapi.yaml`](../../api/openapi.yaml) — `Document.body`, `Document.links[]`, `SearchResult.snippet` shapes.
- **`CLAUDE.md` §Hard rules** — load-bearing rules for portal code, including the `Document.id` URL form (bare numeric, not canonical) that `<Anchor>` must respect.

External:

- [unified](https://unifiedjs.com/) — the AST toolchain.
- [react-markdown](https://github.com/remarkjs/react-markdown) — top-level wrapper.
- [remark-gfm](https://github.com/remarkjs/remark-gfm) — GFM extensions.
- [rehype-sanitize](https://github.com/rehypejs/rehype-sanitize) — HTML sanitization with allowlist schema.
- [rehype-slug](https://github.com/rehypejs/rehype-slug) + [rehype-autolink-headings](https://github.com/rehypejs/rehype-autolink-headings) — heading IDs and anchors.
- [Shiki](https://shiki.style/) + [`@shikijs/rehype`](https://shiki.style/packages/rehype) — SSR syntax highlighting.
- [Mermaid](https://mermaid.js.org/) — client-side diagram rendering.
