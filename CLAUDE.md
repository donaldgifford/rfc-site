# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo state

[RFC-0001](docs/rfc/0001-defer-the-design-system-promotion-model-and-iterate-rfc-site.md) defers `@donaldgifford/design-system` and rebuilds the portal directly against `donaldgifford/design-system/rfc-portal-mockup_15.html` as the visual spec. [DESIGN-0003](docs/design/0003-rebuild-rfc-site-against-the-mockup.md) is the plan; [IMPL-0005](docs/impl/0005-execute-the-rfc-site-rebuild-per-design-0003.md) is the 6-phase tracker.

**Phases 0, 1, 2, 3, 4a, and 4b shipped. IMPL-0005 is COMPLETE.**

- **Phase 0 (the wipe)** — `src/components/portal/` + `src/components/ds-candidates/` deleted; `@donaldgifford/design-system` + `@radix-ui/react-slot` removed; `bunfig.toml` deleted; CI no longer reads GitHub Packages. `<MermaidBlock>` hard-codes `theme: "dark"` (RFC-0001: dark-only). Loaders + API contract integration left intact.
- **Phase 1 (tokens + Topbar + Directory)** — `src/styles/tokens.css` populated from mockup §14-70 (50+ design tokens). `src/styles/base.css` reset + Google Fonts import (IBM Plex Sans/Mono + Source Serif 4). `src/components/Topbar/` (3-element brand wordmark + `<Input>`-style search trigger + `⌘K` global binding + NavLink-active state + 4 placeholder nav links + avatar; glass surface via `backdrop-filter: blur(12px)` over `rgba(11,14,13,0.85)`). `src/components/Directory/` — `DirectoryHero` (3120px max-width serif h1 + uppercase mono kicker), `LiveFilter` (per-keystroke input), `DirectoryToolbar` (filter + sort URL state, default sort `updated_desc`), `DirectoryTable` + `RfcRow` (semantic 5-col table, hairline rows), `StatusBadge` (mockup §580-608: 11px mono uppercase, `--status-*` colour via `currentColor`, `color-mix` 10% bg). `/` loader auto-pins `?filter=type:rfc` when URL omits filter; explicit `filter[]` honoured for future scope expansion.
- **Phase 2 (RFC page)** — `src/components/DocPage/` — `DocPage` (3-col grid `240px minmax(0,1fr) 240px`, gap 56px, collapses single-col under 800px); `DocSidebar` (sticky `top: 88px`, chrome-less `.sidebar-section` blocks: Status / Authors / Created / Updated / Revision / PR / Labels; `revision` from `doc.source.commit?.slice(0,7)`; PR tag from `doc.discussion?.url` trailing segment); `NumberLine` (mono accent eyebrow with linear-gradient `::after` divider); `HeaderMeta` (single mono-12 row, `·` aria-hidden dividers, status-badge + authored-by + revision + relative-updated; `relativeFromNow` exported for reuse); `DocHeader` (NumberLine + serif 42px h1 + HeaderMeta); `TableOfContents` (walks article ref via MutationObserver, IntersectionObserver scroll-spy with `.current` highlight, `.nested` h3 indent); `ReferencesFooter` (2-col grid, outgoing refs from `doc.links[]` rendered as RR7 `<Link>` via `apiHrefToPortalRoute`, "Referenced by" empty state until rfc-api back-references endpoint ships). Markdown pipeline gained `remark-github-alerts` after `strip-docz-boilerplate`: `> [!NOTE|WARNING|TIP|CAUTION|IMPORTANT]` syntax lifted to `<div class="admonition <kind>">` + `<span class="adm-label">…</span>` via mdast `data.hName` / `data.hProperties`. `[!IMPORTANT]` normalised to `note` (mockup has no Important variant). Sanitize schema extended to permit the div / span / className shapes. Prose styles rewritten in `src/portal/markdown/styles.css` against mockup tokens — admonition variants use `color-mix(in srgb, var(--status-*) 16%, var(--bg-base))` for saturated tint; serif h2 (26px / 500) with mono `#` heading-anchor; blockquote raised-bg + serif quote glyph; table th mono-uppercase 10px on `--bg-raised`.
- **Phase 3 (SearchModal + /search)** — `src/components/SearchModal/` — `SearchModal` (controlled by `<Topbar>` via `?modal=1` URL state; renders through `createPortal(..., document.body)` so the backdrop sits above the topbar at z-index 200; 780px top-anchored 96px padding-top, `max-height: calc(100vh - 192px)`, blur-8px backdrop). `SearchResultsList` (left pane, 320px wide, sticky mono-10 uppercase group headers by `document.type`, 3-row `.item` layout with `<mark>`-highlighted snippet via `dangerouslySetInnerHTML` against the rfc-api-sanitized snippet HTML, active row tint via `color-mix(--accent 8%, --bg-elevated)`). `SearchPreviewPane` (right pane, borderless `--bg-base`, NumberLine eyebrow + serif 22px title + meta row + section-heading h3 + snippet HTML). 5 content-scope filter pills (`all results / titles / body / authors / labels`) — `all results` shows live result count via `.pillCount`, per-facet pills are visual-only with `title="Coming soon"` until rfc-api ships a `field` param (F-2 followups). Behaviour: queueMicrotask input focus on open; captured/restored `previouslyFocusedRef` around open/close; 120ms debounce + `AbortController` per keystroke; `performance.now()` round-trip latency surfaced as `meilisearch ● Nms` footer chip; Escape / backdrop click both close (via `role="presentation"` overlay onClick + dialog `onKeyDown`); ↑/↓ moves `activeIndex`, ↵ navigates via RR7; Tab/Shift+Tab cycle inside the dialog via `querySelectorAll` focusable list. `<Topbar>` wires `⌘K`/`Ctrl+K` document keydown to `setSearchParams({ modal: "1" })` with `replace: true` + `preventScrollReset: true`; trigger click opens modal; meta/ctrl-click on trigger navigates to `/search` for the no-JS fallback path. `src/routes/search.tsx` rebuilt as the no-JS fallback — degraded surface (no preview pane, no kb-nav, no filter pills): `<Form method="get">` input + result list with snippet HTML; CSS module subset of the modal styles.
- **Phase 4a (`/mcp` shell)** — `src/components/McpPage/` — `McpPage` (single-column 1000px max-width, 48px/40px/96px padding) composes hero + 2-card related-servers grid + 4 numbered setup sections (Install / Configure / Tools / Verify). `content.ts` is the portal-local single source of truth — `MCP_VERSION` (`0.4.2`), `MCP_SERVERS` (rfcs-mcp + docs-mcp with tagVariant), `MCP_DOWNLOADS` (4 per-platform entries), `MCP_BUILD_FROM_SOURCE`, `MCP_CONFIG_SNIPPETS` (3 client snippets), `MCP_TOOLS` (5 tools), `MCP_VERIFY_PROMPT`. `ExampleTabs` is a fresh tab component (no design-system inheritance) — `useState`-driven, `role="tablist"`/`role="tab"`/`aria-selected`, mockup §1825-1865 styling with `--code-bg` body + `--code-type` active-tab text. The MCP h1 + paragraph descriptions use a small `inlineCode(str)` helper that promotes backticks to `<code>`-with-keyword-colour via `dangerouslySetInnerHTML` (trusted because the strings are portal-authored constants in `content.ts`). `src/routes/mcp.tsx` is loader-less; meta sets the title. `<Topbar>` swaps the MCP placeholder `<span>` for a real `<NavLink to="/mcp">` with the same `linkActive` styling as Directory.
- **Phase 4b (`/api` shell)** — `src/portal/openapi/loader.ts` — parses the vendored `api/openapi.yaml` at build time via Vite's `?raw` import (zero runtime fetch). `loadSpec()` is module-cached; `listEndpoints(spec?)` flattens `paths × methods` into a sorted `Endpoint[]` with stable `key = "${method}:${path}"`, resolves `$ref` parameters/responses through `components.parameters` / `components.responses`, hoists path-level parameters into each operation (operation-level wins on `${in}:${name}` collision), and exposes a `ResolvedOperation` shape where `parameters` + `responses` are guaranteed non-optional. `groupEndpointsByTag()` preserves first-appearance tag order; `findEndpoint(endpoints, key)` falls through to `undefined` for unknown keys (callers default to the first endpoint). `src/env.d.ts` declares `*.yaml?raw` as `string`. `src/components/ApiPage/` composes a 3-col-style layout: `ApiSidebar` (brand block — title / version / OpenAPI spec line / description; per-tag groups with mono-uppercase headers and one button per `method:path` endpoint, `aria-current="page"` on the active row, method chips inline); `EndpointDetail` (tag eyebrow + serif 28px h1 + `PathLine` + description + inert try-it band marked "Visual reference — request execution lands in a follow-up phase"; Path / Query parameter sections render `required` badges + schema-type labels (`integer · int32`) + descriptions + JSON-stringified defaults; Responses section renders status-code chips colored by 2xx/3xx/4xx/5xx); `PathLine` (mono-13 row that splits the path on `{var}` segments, highlights vars via `.segmentVar` colour, copy-to-clipboard button with 1500ms "copied!" success flip via `navigator.clipboard.writeText`); `MethodChip` (variant-based 10px mono uppercase chip with `--method-get/post/put/patch/delete` token colours). `ApiPage` container wires `useSearchParams` for `?endpoint=method:path` URL state (so `/api?endpoint=get:/api/v1/{type}/{id}` is shareable) and falls back to the first endpoint when the key doesn't resolve. `src/routes/api.tsx` is loader-less: calls `loadSpec()` + `listEndpoints()` synchronously and hands `spec` + `endpoints` to `<ApiPage>` as props. `<Topbar>` swaps the API placeholder `<span>` for a real `<NavLink to="/api">`. **Mockup-vs-spec path drift documented**: mockup mentions `/api/v1/rfcs/{id}` but the actual contract is `/api/v1/{type}/{id}` (rfc-api is multi-type, not RFC-only) — implementation tracks the vendored `api/openapi.yaml`, not the mockup's example paths.

**Test totals**: Phase 3 added 12 (7 SearchModal + 3 searchRouteRender + 2 reworked Topbar) for **188 tests across 30 files**; Phase 4a added 10 (7 McpPage + 2 mcpRouteRender + 1 reworked Topbar placeholder + 1 new MCP NavLink) for **198 tests across 32 files**; Phase 4b added 21 (8 openapi/loader + 8 ApiPage + 4 apiRouteRender + 1 reworked Topbar placeholder + new API NavLink) for **219 tests across 36 files**.

What's wired:

- **React 19 + React Router v7** (framework mode, `appDirectory: "src"`, `ssr: true`). Production: `@react-router/serve`.
- **API client at `src/portal/api/`** — orval-generated client from `api/openapi.yaml`, custom `fetch` mutator, RFC 7807 problem envelope (`errors.ts`), RFC 5988 `Link` parser (`pagination.ts`), `docId.ts` helpers (URL form vs canonical form + `apiHrefToPortalRoute`), `msw/` for `API_MODE=msw` dev mode + shared test handlers.
- **Markdown pipeline at `src/portal/markdown/`** — `DocumentView` (`MarkdownHooks` + `<Suspense>` for async Shiki), `Snippet` (search-result HTML), unified plugin chain: remark-gfm → strip-docz-boilerplate → **remark-github-alerts** → rehype-slug → rehype-autolink-headings → mermaid-marker → @shikijs/rehype → normalize-hast-properties → rehype-sanitize.
- **TanStack Query** in `src/root.tsx` (`QueryClientProvider` + `useState(createQueryClient)` for SSR isolation).
- **Routes**: `_index.tsx` (Directory: `<DirectoryHero>` + `<LiveFilter>` + `<DirectoryToolbar>` + `<DirectoryTable>`, auto-pinned `filter=type:rfc`, default `sort=updated_desc`), `$type.$id.tsx` (RFC page: `<DocPage>` shell + `<DocHeader>` + `<DocumentView>` (article ref) + `<ReferencesFooter>` + `<DocSidebar>` + `<TableOfContents>`), `search.tsx` (Search no-JS fallback: `<Form method="get">` + result list with snippet HTML; `?q=` loader short-circuits on empty `q`), `mcp.tsx` (MCP discovery + setup page: hero / 2-server cards / 4 numbered setup steps; loader-less, content from `src/components/McpPage/content.ts`), `api.tsx` (API reference page: sidebar of tag-grouped endpoints + endpoint detail with path / query / responses sections; loader-less, parses `api/openapi.yaml` at build time via `src/portal/openapi/loader.ts`).
- **Search**: `<SearchModal>` mounted from `<Topbar>` and controlled via `?modal=1` URL state. `⌘K`/`Ctrl+K` opens; trigger click opens; meta-click on trigger uses `/search` fallback. Renders through `createPortal(..., document.body)`. Filter pills are visual-only (per-facet content-scope filtering depends on rfc-api `field` param — F-2 followup).
- **OpenAPI loader**: `src/portal/openapi/loader.ts` parses the vendored `api/openapi.yaml` via Vite's `?raw` import (build-time inline; no runtime fetch). Resolves `$ref` parameters / responses + hoists path-level parameters into each operation; exposes `loadSpec()` / `listEndpoints()` / `groupEndpointsByTag()` / `findEndpoint()`. Consumed by `/api`.

IMPL-0005 is closed. Followups beyond IMPL-0005 are tracked per-phase under "Deferred from …" below.

### IMPL-0006 — loader-side Markdown SSR (in progress)

[INV-0004](docs/investigation/0004-eliminate-the-rfc-page-render-flash-on-hard-refresh.md) concluded that the article-area redraw on hard refresh is the client-side Markdown render in `<DocumentView>`. [DESIGN-0004](docs/design/0004-render-markdown-server-side-in-the-rfc-site-loader-with-per.md) is the plan; [IMPL-0006](docs/impl/0006-render-markdown-server-side-in-the-rfc-site-loader-per-design.md) is the 6-phase tracker.

- **Phase 1 — Foundation (closed 2026-05-18)**: rehype chain split into `rehypePluginsCore` + `rehypeSanitizePlugin` exports from `src/portal/markdown/pipeline.ts` (combined `rehypePlugins` preserved so today's `<DocumentView>` stays unchanged). Sanitize schema extended to permit `target`/`rel`/`dataCrossDoc` on `<a>`, `dataBrokenLink` on `<span>`, `title` on `*`. `src/portal/markdown/plugins/resolve-anchor-links.ts` ports `<Anchor>`'s runtime resolution into a hast visitor with 4 branches (hash-only / cross-doc match via `target`-then-`href` / external `target=_blank` + `rel=noopener noreferrer` / broken-link `<span>` replacement); reads `documentLinks` from `file.data`. `src/portal/markdown/renderMarkdown.ts` exports `async function renderMarkdown(doc: Document): Promise<string>` over a module-scoped `unified()` processor: `remarkParse → remarkPlugins → remarkRehype({allowDangerousHtml: false}) → rehypePluginsCore → resolveAnchorLinks → rehypeSanitizePlugin → rehypeStringify`. `sanitize.test.ts > strips dangerous <a target=_blank>` inverted to "preserves" — the defence model moved upstream: `remark-rehype`'s `allowDangerousHtml: false` drops user-authored raw HTML at the mdast→hast boundary before sanitize sees it. **Test totals**: Phase 1 added 35 (10 resolve-anchor-links + 25 renderMarkdown) for **254 tests across 37 files** (was 219 across 36).
- **Phase 2 — Mockup parity (closed 2026-05-18)**: `pipeline.ts` switched from dual-theme `themes: { light: "github-light", dark: "github-dark" }` to single-theme `theme: "tokyo-night"` (matches mockup `--code-*` palette family) + a custom `codeColorsToCssVariables` Shiki transformer. The transformer (a) strips inline `background-color` + `color` from `<pre>` so CSS owns those via `--code-bg` / `--code-fg`, (b) maps each tokyo-night hex on token `<span>`s to a `var(--code-*)` reference (unknowns fall back to `var(--code-fg)`), and (c) sets `dataLanguage` on `<pre>` (skipping `text`/`plain`/no-lang fences) so the language-badge CSS selector matches. **Mockup §812-823 language badge** added to `src/portal/markdown/styles.css` as `pre[data-language]::before { content: attr(data-language); … }` — 10px mono uppercase, `--code-type` colour, `opacity: 0.7`, top-right corner; `pre[data-language="mermaid"]::before { content: none }` defensive. Dead `[data-theme="dark"] .shiki { color: var(--shiki-dark) !important }` rules removed (they were dual-theme leftovers). **Test totals**: Phase 2 added 4 code-block assertions to `renderMarkdown.test.ts` for **258 tests across 37 files**. Phase 2 success criterion verified: zero inline hex colors in Shiki output across go/sql/yaml/typescript fixtures.
- **Phase 3 — Mermaid hydration (helper + tests + styles closed 2026-05-18; wire-up lands in Phase 4)**: `src/portal/markdown/mermaid-hydrate.ts` — `hydrateMermaid()` queries `pre[data-mermaid-source]`, early-returns when none exist (so non-mermaid pages never pay the ~700 KB lazy `await import("mermaid")`), initializes with `theme: "base"` + `securityLevel: "strict"` + `themeVariables: mermaidThemeFromTokens()`, then per-block reads `textContent` (the source — `mermaid-marker` sets the data attribute as an empty marker, not the source itself), renders to SVG via `mermaid.render`, replaces `innerHTML`, adds `.mermaid-diagram` class, and strips `data-mermaid-source` (so a future hydrate call is a no-op on the same node). Render errors `console.error` but leave the source text in place — the marker stays so a retry can have another go. `mermaidThemeFromTokens()` reads `getComputedStyle(documentElement).getPropertyValue("--bg-raised" / "--fg-primary" / "--border-hairline" / "--accent" / "--bg-elevated" / "--bg-base" / "--font-mono")` and falls back to hardcoded dark defaults so jsdom's empty-string returns produce a valid theme. **CSS**: `.markdown-body .mermaid-diagram, .markdown-body pre[data-mermaid-source]` share the mockup §1157-1167 container styling (24px margin, 32×24 padding, `--bg-raised` bg, `--border-hairline` border, `--r-sm` radius, `overflow-x: auto`) so SSR / pre-hydration view has matching dimensions — no layout jump on hydrate. Legacy `.mermaid-block` rules retained until Phase 4 deletes the old React component. **Test totals**: 8 new `mermaid-hydrate.test.tsx` (mocked mermaid via `vi.mock` + late dynamic-import) for **266 tests across 38 files**.
- **Phase 4 — Cutover + delete legacy (closed 2026-05-18)**: the user-visible flip. `src/routes/$type.$id.tsx` loader now returns `{ doc, bodyHtml }` after `await renderMarkdown(doc)`; the route component passes `bodyHtml` to a thinned `<DocumentView>`. `src/portal/markdown/DocumentView.tsx` is now ~50 LOC: one `<article ref className="markdown-body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />` plus two `useEffect`s keyed on `bodyHtml` — `attachCrossDocClickHandler(articleRef.current, navigate)` (returns a detach function for cleanup) and `void hydrateMermaid()`. `MarkdownHooks` / `Suspense` / `LinksContext` / `useDocumentLinks` all gone. `src/portal/markdown/cross-doc-nav.ts` (OQ-2 resolution): article-scoped delegated click handler — `closest("a[data-cross-doc='1']")`, skips ctrl/meta/shift/alt-clicks + middle/right buttons + `defaultPrevented` events + empty hrefs, calls `event.preventDefault()` + `void navigate(href)`. **Deletions** (5 files + 2 directories): `src/portal/markdown/components/Anchor.tsx` + `.test.tsx`, `Code.tsx` + `.test.tsx`, `MermaidBlock.tsx`, `tests/portal/markdown/pipeline.test.tsx` (its `<DocumentView document>` test surface no longer exists; the 2 unique assertions — GFM autolinks + heading-anchor class survival — migrated to `renderMarkdown.test.ts`). Both empty `components/` dirs removed. `tests/api/docPageRender.test.tsx` updated: first test uses `getAllByRole` (the rendered Markdown body's `# Title` heading now coexists with `<DocHeader>`'s title h1); a new `WAITFOR_TIMEOUT = 5000` rides out the first-call Shiki WASM cold start; new test asserts the `article.markdown-body` element exists with non-empty innerHTML. `tests/api/docPage.test.ts` updated to assert `result.doc.id` / `result.bodyHtml.length > 0`. **TOC spot-check (OQ-5)**: no MutationObserver-timing bug — the existing test path confirms `<h2>Motivation</h2>` is in the article after SSR HTML injection. **Bundle verified**: `mermaid` chunk-splits to `mermaid.core-*.js`; the route bundle only references it by import name. **Test totals**: -20 (deleted Anchor/Code/pipeline) + 11 (2 to renderMarkdown + 1 to docPageRender + 8 cross-doc-nav) for **257 tests across 36 files**.
- **Phase 5 — OQ verification (closed 2026-05-19, testable verifications)**: **OQ-1 Shiki singleton** verified via `tests/portal/markdown/renderMarkdown.perf.test.ts` — three back-to-back renders show `cold=1701ms warm1=2ms warm2=3ms` (~590× speedup), proving Shiki's highlighter is reused across calls. No `createHighlighter()` fallback needed. **OQ-2 RR7 streaming** verified via `bun run build` + `react-router-serve` + `curl -s /rfc/0001 > /tmp/response.html`: production response is 47 066 bytes; `<article class="markdown-body"` opens at byte offset **4193** — well inside the 8 KB first-flush window. h1, multiple h2s (Summary, Problem Statement, …), and the first paragraphs are all in the first 8 KB. Dev-server response (79 KB) is NOT representative because Vite inlines all CSS into `<head>`; production never inlines CSS that way. Documented in §Findings so future regressions don't false-alarm. **Cross-doc-nav** already covered in Phase 4 (8 tests). **Deferred** to followups: kitchen-sink RFC-0009 authoring (lives in `~/code/rfcs` content repo) and screenshot-based visual diff (no Playwright/Puppeteer wired up here). Phase 2/3 CSS work is already exhaustively unit-tested against mockup-spec selectors / tokens. **Test totals**: +1 perf test for **258 tests across 37 files**.

Deferred from Phase 2 (tracked in IMPL-0005 §Phase 2 — not blocking phase close):

- **`<RfcLink>` / `<RFCPreviewCard>` cross-RFC hover preview** (mockup §861-923). Substantial chunk requiring `useGetDoc` + popover orchestration + `classifyProblem` for 404s; folded into a future slice alongside SearchModal's preview pane and a likely `<Popover>` extraction. Today's `<Anchor>` still resolves cross-doc links and falls through to external / broken-link sentinels correctly — only the hover preview chrome is missing.
- **Code-block language-badge chip** on `pre[data-lang]` (mockup §812-823) — requires a rehype plugin extension to carry meta.lang through; not a Phase 2 success criterion.
- **Mermaid caption sub-element** (mockup §1170-1179) — decorative; depends on rfc-api emitting caption metadata.

Deferred from Phase 3 (tracked in IMPL-0005 §Phase 3 — not blocking phase close):

- **Content-scope filter facets** (titles / body / authors / labels). Pills are visual-only — clicking `titles` etc. flips the active pill state but the search request still sends `q` alone. Depends on rfc-api `searchDocs` accepting a `field` param (F-2 followup). When that lands the `activeScope` state should drive the request payload.
- **Cross-doc preview section content** — the preview pane renders `result.snippet` HTML; if rfc-api later exposes section-by-section content (e.g. `getDocSection`), the preview can fetch the full `Summary` / `Motivation` for a richer view. Today we render only the matched snippet plus the section heading.

Deferred from Phase 4b (tracked in IMPL-0005 §Phase 4b — not blocking phase close):

- **Deep-link route `/api/$type/$id` for a single endpoint** (mockup §1647 shared-link form). Today `/api?endpoint=get:/api/v1/{type}/{id}` is the shareable canonical link via `useSearchParams` — works, but a path-based form would be cleaner and friendlier to copy-paste. Trivial follow-up once the endpoint-detail surface stabilizes.
- **Try-it execution path** (mockup §1751-1782). The band is rendered but inert — request execution against `RFC_API_URL` requires building a request-form generator from `parameters`, response viewer, auth handling, and likely a per-endpoint sandbox. Folded into a follow-up phase.
- **`ExampleTabs` integration on the API page** (curl / typescript / go snippets per endpoint, mockup §1718-1748). The MCP page's `<ExampleTabs>` is a good fit, but the snippets need a per-endpoint generator — deferred until try-it lands so they share a request shape.

## Canonical specs (read these first)

- **[RFC-0001](docs/rfc/0001-defer-the-design-system-promotion-model-and-iterate-rfc-site.md)** — the *decision*: defer the design-system, rebuild against the mockup. Supersedes DESIGN-0001.
- **[DESIGN-0003](docs/design/0003-rebuild-rfc-site-against-the-mockup.md)** — the *plan*: stack constraints, what's deleted, what stays, CSS + tokens + theme strategy, 5-phase rollout.
- **[IMPL-0005](docs/impl/0005-execute-the-rfc-site-rebuild-per-design-0003.md)** — the *tracker*: 6-phase checkbox list, per-phase success criteria, Open Questions (all 8 resolved 2026-05-15).
- **[DESIGN-0002](docs/design/0002-markdown-rendering-pipeline.md)** — Markdown rendering pipeline. Still load-bearing; the pipeline survived the cut.
- **[ADR-0001](docs/adr/0001-consume-rfc-api-via-its-published-openapi-contract.md)** — rfc-site consumes rfc-api exclusively through its OpenAPI contract. Vendor the spec, generate a typed TS client, drift = CI failure.
- **[ADR-0002](docs/adr/0002-adopt-portal-frontend-stack.md)** — frontend stack ratification.
- **[Integration reference](docs/integration/rfc-api-reference.md)** — endpoint payloads, error-sentinel → UI mapping, Markdown contract, local-stack runbook.

Also referenced often:

- **[`api/openapi.yaml`](api/openapi.yaml)** — vendored OpenAPI 3.1 spec.
- **The mockup**: `donaldgifford/design-system/rfc-portal-mockup_15.html` — the visual contract. Sibling repo; iterate the spec there if the spec is wrong.

Superseded / archived:

- **DESIGN-0001** — portal architecture + ds-candidates promotion model. Superseded by RFC-0001.
- **INV-0003** — the audit that motivated the pivot. Findings still accurate; the §Recommendation is superseded by RFC-0001.
- **IMPL-0001 / 0002 / 0003 / 0004** — historical; preserved in git, not actively maintained.

## Tooling

- **Runtime + package manager:** Bun (`mise.toml` pins `latest`; currently 1.3.11).
- **Bundler:** Vite 8 (`@react-router/dev/vite` plugin owns dev/build/SSR entry generation in framework mode).
- **Framework + router:** React 19.2 + React Router v7.14 (framework mode). Routes discovered via `@react-router/fs-routes` from `src/routes.ts` — `ignoredRouteFiles` excludes `**/*.module.css`, `**/*.test.{ts,tsx}`, `**/README.md`.
- **Data fetching:** TanStack Query 5.100 + orval 8.9 (with MSW 2 for handler generation + `@faker-js/faker` 10 for response fixtures). orval is wired in `tags-split` mode at `src/portal/api/__generated__/` with a custom `fetch` mutator that prepends `RFC_API_URL` and forces `accept: application/json, application/problem+json` for the RFC 7807 envelope. Generated dir is gitignored; run `just gen-api` after spec changes; CI runs `just gen-api-check` for drift.
- **Markdown rendering:** `react-markdown@10` + `remark-gfm@4` + `rehype-slug@6` + `rehype-autolink-headings@7` + `@shikijs/rehype@4` + `rehype-sanitize@6` + `mermaid@11`. Two custom plugins (`strip-docz-boilerplate`, `mermaid-marker`) plus a `normalize-hast-properties` bridge between Shiki's raw HTML attribute names and hast camelCase. Lives at `src/portal/markdown/`.
- **Language:** TypeScript ^5.7.2 strict, `target: ES2022`, `moduleResolution: bundler`. Includes `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `isolatedModules`.
- **Lint/format:** ESLint v9 flat config + Prettier. Versions: eslint ^9.17, typescript-eslint ^8.18, eslint-plugin-react ^7.37, react-hooks ^5.1, jsx-a11y ^6.10.
- **Tests:** vitest ^2.1.8 + jsdom ^25.0.1 + `@testing-library/react` ^16.3.2 + `@testing-library/jest-dom` ^6.9.1 + `@testing-library/user-event` ^14.6.1. `tests/setup.ts` extends `expect` with jest-dom matchers and registers `afterEach(cleanup)`. Vitest discovers `tests/**/*.test.{ts,tsx}` and `src/**/*.test.{ts,tsx}`. `resolve.dedupe: ["react", "react-dom"]` to guarantee a React singleton. `testTimeout: 15000` for Shiki WASM cold-start headroom.

`mise.toml`: `bun = "latest"`, `node = "22"` (tool compat headroom), `just = "latest"`.

## Task runner (`justfile`)

`justfile` mirrors `package.json` scripts. Prefer `just <recipe>` over `bun run x`. Composite: `just check` runs typecheck → lint → format-check → test (CI parity). MSW dev mode (no rfc-api / Postgres / webhook): `just dev-msw` — sets `API_MODE=msw` + `VITE_API_MODE=msw`, boots dev with fixture-backed handlers. `just --list` for the full set.

## Architecture: mockup-driven, flat components

Per RFC-0001 + DESIGN-0003: the mockup is the visual spec. Views are built fresh against it; nothing is shared from the previous design-system codebase. Component organisation is **flat — one directory per view** under `src/components/<View>/`. No `portal/` / `ds-candidates/` subfolders, no promotion model.

Within each `<View>/` directory:

- One folder per view (e.g. `Topbar/`, `Directory/`, `RFCPage/`, `SearchModal/`).
- Component, CSS module, optional test colocated.
- CSS extracted from the mockup. Per-view CSS modules — tokens consumed via `var(--…)` from `src/styles/tokens.css`.

Data / framework / markdown layers live at `src/portal/api/` and `src/portal/markdown/`. They're consumed by views as data props.

The OpenAPI-generated client + TanStack Query hooks live under `src/portal/api/__generated__/`. If a view needs data, the route loader fetches it and passes it as props.

## Hard rules (anti-patterns to refuse)

- **Never add a third-party blanket component library** (Radix Themes, shadcn/ui, MUI, Chakra, etc.). The mockup's visual language is bespoke; library chrome won't survive without heavy override.
- **No CSS-in-JS runtime, no Tailwind, no `style={}` for non-dynamic values.** CSS Modules, co-located, tokens from `src/styles/tokens.css`.
- **`className` merges, never replaces** — use `clsx` or a `cn()` helper.
- **API shape:** `variant` / `size` / `status` as string unions, never `isPrimary`-style booleans.
- **Resolve cross-document Markdown links from the doc payload's `links[]` array, not by parsing relative paths in the body.** `rfc-api` does that resolution; doing it again on the client is duplicate work that drifts.
- **Never hand-write request/response types** for anything `rfc-api` owns. Extend the contract upstream in `rfc-api`, then regenerate.
- **Use the URL form for `Document.id` when building portal links and API calls.** The OpenAPI parameter `DocID` is `^[0-9]+$` (bare numeric, e.g. `"0001"`); `rfc-api` reconstructs the canonical id (`"RFC-0001"`) server-side. Sending the canonical form double-prefixes and 404s. Use `urlIdFromCanonical(doc.id)` from `src/portal/api/docId.ts`; display surfaces keep the canonical form.
- **Dark theme only.** `<html data-theme="dark">` is hard-coded in `src/root.tsx`. The mockup is dark-only; there is no `useTheme` hook. If light theme is wanted later, it's an RFC.
- **The mockup is the spec.** If the implementation diverges from the mockup, fix the implementation. If the mockup itself is wrong, fix the mockup (it lives in `donaldgifford/design-system/`, sibling repo).

## Repo layout (current — IMPL-0005 closed through Phase 4b)

```
api/
  openapi.yaml                       ← vendored from rfc-api; sync mechanism TBD
  README.md
docs/
  adr/                               ← ADR-0001 (API contract) + ADR-0002 (stack) — both load-bearing
  design/                            ← DESIGN-0002 (Markdown pipeline) + DESIGN-0003 (rebuild plan)
  impl/                              ← IMPL-0001..0004 closed; IMPL-0005 closed (all 6 phases shipped)
  rfc/                               ← RFC-0001 (the decision)
  investigation/                     ← INV-0001 / 0002 / 0003 — historical context
  integration/                       ← rfc-api cookbook
  archive/                           ← frozen historical source material
src/
  root.tsx                           ← Layout + App + QueryClientProvider; data-theme="dark"; <Topbar> + <Outlet>
  routes.ts                          ← flatRoutes() with ignoredRouteFiles
  entry.client.tsx                   ← MSW worker boot when VITE_API_MODE=msw
  env.d.ts
  styles/
    tokens.css                       ← Mockup §14-70 tokens (color, typography, motion, shape)
    base.css                         ← reset + Google Fonts @import (IBM Plex + Source Serif 4)
  components/
    Topbar/                          ← Brand + search trigger + ⌘K + Directory/MCP/API NavLinks + Frameworks placeholder + SearchModal mount (9 tests)
    Directory/                       ← DirectoryHero / LiveFilter / DirectoryToolbar / DirectoryTable / RfcRow / StatusBadge (33 tests)
    DocPage/                         ← DocPage shell + DocSidebar + DocHeader/NumberLine/HeaderMeta + TableOfContents + ReferencesFooter (24 tests)
    SearchModal/                     ← SearchModal (portal-rendered dialog) + SearchResultsList + SearchPreviewPane (7 tests)
    McpPage/                         ← McpPage (hero + cards + 4 sections) + ExampleTabs + content.ts (7 tests)
    ApiPage/                         ← ApiPage + ApiSidebar + EndpointDetail + PathLine + MethodChip (8 tests)
  routes/
    _index.tsx                       ← Directory loader (auto-pinned filter=type:rfc, default sort updated_desc) + view
    $type.$id.tsx                    ← DocPage loader + DocPage shell wiring DocumentView + sidebar + TOC
    search.tsx                       ← Search no-JS fallback (Form GET + result list with snippet HTML)
    search.module.css                ← subset of SearchModal styles
    mcp.tsx                          ← /mcp route (loader-less) — composes <McpPage>
    api.tsx                          ← /api route (loader-less) — calls loadSpec() + listEndpoints() → <ApiPage>
    README.md                        ← flat-routes convention
  portal/api/
    config.ts                        ← RFC_API_URL reader
    fetcher.ts                       ← orval custom mutator over fetch
    queryClient.ts                   ← TanStack defaults (5min staleTime, no refetchOnFocus, retry 1)
    errors.ts                        ← throwIfProblem + classifyProblem (RFC 7807)
    pagination.ts                    ← RFC 5988 Link header parser
    docId.ts                         ← urlIdFromCanonical / canonicalFromUrl / apiHrefToPortalRoute
    msw/                             ← dev-mode + shared test handlers (handlers / browser / server / setup / fixtures)
    __generated__/                   ← orval output (gitignored)
  portal/openapi/
    loader.ts                        ← parses api/openapi.yaml at build time (Vite ?raw); $ref resolution + path-param hoisting; loadSpec/listEndpoints/groupEndpointsByTag/findEndpoint
  portal/markdown/                   ← unified pipeline + components for Document.body
    pipeline.ts                      ← remarkPlugins / rehypePlugins arrays + sanitize schema (admonitions permitted)
    DocumentView.tsx                 ← MarkdownHooks + Suspense + LinksContext
    Snippet.tsx                      ← search-result HTML renderer
    styles.css                       ← prose styling (tokens only) + admonition variants
    plugins/                         ← strip-docz-boilerplate / github-alerts / mermaid-marker / normalize-hast-properties
    components/                      ← Anchor / Pre / MermaidBlock (theme hard-coded dark)
tests/
  setup.ts                           ← jest-dom matchers + RTL afterEach(cleanup)
  api/                               ← loader tests + MSW handlers + fixtures + docPageRender + indexRouteRender + searchRoute
  portal/markdown/                   ← pipeline + sanitize + Snippet + plugins (incl. github-alerts) + components
  utils/                             ← MSW + renderRoute helpers
  examples/docs/                     ← hand-curated fixture corpus for API_MODE=msw
scripts/
  gen-api-check.sh                   ← orval drift check (CI + local)
.github/workflows/ci.yml             ← CI: install + drift check + static checks + build (no NPM_TOKEN, no packages:read)
orval.config.ts                      ← react-query + fetch + MSW
react-router.config.ts               ← appDirectory: "src", ssr: true
vite.config.ts                       ← @react-router/dev plugin
vitest.config.ts                     ← jsdom + dedupe react/react-dom + 15s testTimeout
justfile                             ← task runner
mise.toml                            ← bun = latest, node = 22, just = latest
.env.example
.docz.yaml
CLAUDE.md
```

All six IMPL-0005 phases (0, 1, 2, 3, 4a, 4b) are closed. The portal rebuild against the mockup is complete. Followups beyond the IMPL are tracked in each "Deferred from …" block above and as their own GitHub issues/RFCs as they're scoped.
