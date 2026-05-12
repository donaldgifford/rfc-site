# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo state

All 6 phases of [IMPL-0001](docs/impl/0001-bootstrap-portal-scaffold-per-design-0001.md) shipped. The portal SSR-renders a card-grid directory at `/` and a doc detail page at `/$type/$id`, both backed by the orval-generated rfc-api client through RR7 route loaders. Problem+JSON errors propagate through a shared `<RouteErrorBoundary>` that renders a not-found surface for `ErrNotFound` and a generic surface (with `request_id`) for everything else. `<Badge>` was promoted to `@donaldgifford/design-system@0.2.0` in Phase 6 and is now consumed as a published primitive. Phases 1-7 of [IMPL-0002](docs/impl/0002-wire-up-apimodemsw-local-dev-mode.md) shipped: `just dev-msw` boots the portal against a hand-curated fixture corpus with no `rfc-api` / Postgres / GitHub-webhook dependency. All 7 phases of [IMPL-0003](docs/impl/0003-wire-up-the-markdown-rendering-pipeline-per-design-0002.md) shipped on `feat/design-0002`: `Document.body` renders as proper HTML through `<DocumentView>` (unified plugin chain: remark-gfm → strip-docz-boilerplate → rehype-slug → rehype-autolink-headings → mermaid-marker → @shikijs/rehype → normalize-hast-properties → rehype-sanitize), heading IDs match `SearchResult.section_slug`, mermaid diagrams hydrate client-side via dynamic import, and a minimal `/search` route consumes `<Snippet>` against the shared MSW handlers. Live-rfc-api smoke verified end-to-end with a seeded `documents` row (commit `f8883c7` fixed a doc-page URL contract bug — see Hard rules). Production build is MSW-clean except the static worker file.

What's wired:

- React 19 + React Router v7 (framework mode) + Vite, served by `react-router-serve`.
- `src/root.tsx`: Layout (sets `<html data-theme="dark">`) + App (wraps `<Outlet />` in `<QueryClientProvider>` with `useState(createQueryClient)` for SSR isolation).
- Routes: `src/routes/_index.tsx` (directory `<DirectoryTable>` + Link-header pagination via `?cursor=` — IMPL-0004 Phase 7a swapped the card grid for a semantic table); `src/routes/$type.$id.tsx` (doc page with title h1, `<Badge>`, dateline, authors, plus a two-column layout — IMPL-0004 Phase 8a — where `<DocSidebar>` sits beside `<DocumentView>`); `src/routes/search.tsx` (IMPL-0003 Phase 7 — full-text search bound to `?q=`, results rendered with `<Snippet>`, links use the URL form per Hard rules). All three wire `RouteErrorBoundary` as their `ErrorBoundary` export.
- Design-system consumed from GitHub Packages: `package.json` declares `@donaldgifford/design-system: ^0.3.0` and `bun.lock` resolves it from `https://npm.pkg.github.com/`. Bumped from `0.2.0` → `0.3.0` to pick up the new `--shadow-*` / `--tracking-*` / `--z-*` primitive token groups. `bun link` against `../design-system` is reserved for parallel-iteration on the design-system itself — see §When iterating in parallel; never the default.
- Portal components: `<ThemeToggle>` (IMPL-0001 Phase 2), `<DocCard>` (IMPL-0001 Phase 4 — retained through IMPL-0004 Phase 7 per Resolved §13, no live route consumes it now that the directory uses `<DirectoryTable>`), `<RouteErrorBoundary>` (Phase 4), `<Skeleton>` (Phase 4 polish — shimmer placeholder backing the route-level `HydrateFallback` exports; honours `prefers-reduced-motion`), `<Topbar>` (IMPL-0004 Phase 3 + Phase 9a + Phase 9b — sticky 3-col grid hosting the brand wordmark, the `<Input>`+`<Kbd>⌘K</Kbd>` search trigger, future-route placeholders, and `<ThemeToggle>`; binds the global `⌘K`/`Ctrl+K` shortcut to open `<SearchModal>`; meta-click / middle-click on the trigger navigates to `/search` for power users; modal open/close state mirrored to the URL via `?modal=1` per Resolved §11 — opening pushes history so browser-back closes it, refresh re-opens; 9 tests), `<DirectoryTable>` (IMPL-0004 Phase 7a — semantic 5-column table consumed by `_index.tsx`, replaced the `<DocCard>` grid; one clickable cell per row, hairline rows, em-dash author fallback, `<time>` element preserves raw ISO timestamps, 5 tests), `<DocSidebar>` (IMPL-0004 Phase 8a — metadata sidebar consumed by `$type.$id.tsx` two-column layout; renders Status / Authors / Created / Updated / Source via `<Card variant="elevated">` blocks plus conditional Discussion + Labels blocks; uses `--tracking-wider` for the uppercase mono labels and `--shadow-sm` via the Card variant, 7 tests), `<RFCPreviewCard>` (IMPL-0004 Phase 8b — hover/focus popover wrapping resolved internal `<Anchor>` links; uses `useGetDoc` orval hook with `enabled` gating so untouched preview-enabled links cost nothing; `role="tooltip"`, `aria-describedby`, Escape-to-close, 150ms open-delay, inert error surface via `classifyProblem` for 404s; 5 tests with a local MSW server), `<SearchModal>` (IMPL-0004 Phase 9a — fixed-position overlay using `--z-overlay` over a translucent backdrop; hosts `searchDocs` self-contained with AbortController per-keystroke; `role="dialog"` + `aria-modal` + `aria-labelledby`; input focused on open via `queueMicrotask`; Escape / backdrop / Close-button all dismiss; Snippet rendering matches the route surface; Phase 9b extensions: (a) `role="toolbar"` filter pills using `<Badge variant="filter">` from `@donaldgifford/design-system@0.4.0-pre` — `All` + 6 per-type pills (`RFC` / `ADR` / `Design` / `Impl` / `Plan` / `Inv`), multi-select on per-type pills, `All` clears them; filter is client-side over the rendered `SearchResult[]` so the `searchDocs` payload is unchanged. (b) Grouped-by-`document.type` results — each non-empty bucket renders inside its own `<section aria-labelledby data-group-type>` with a `position: sticky` uppercase mono `<h3>` heading; bucket order follows `FILTER_TYPES` so the layout is stable across queries, and unrecognised types fall through to a trailing bucket. (c) WAI-ARIA Dialog focus-trap — Tab + Shift+Tab cycle inside the dialog only; the previously-focused element is captured on open and restored on close so keyboard users don't drop to the document root. Implemented via a document-level `keydown` listener bound only while open; the surrounding `<Outlet>` stays interactive (no `inert` / `aria-hidden` on the rest of the page). (d) Side preview pane — hovering or focusing a hit sets it as the active result; the preview pane on the right renders the doc's id / title / status `<Badge>` / authors / dateline / snippet via `useGetDoc` (lazy). The pane collapses below 760px via CSS only — narrow viewports get the unchanged single-column layout. 14 tests with a local MSW server). `<StatusPill>` was inline in Phase 4 and superseded by the Phase 5 `<Badge>` candidate (deleted from portal/).
- ds-candidates in flight (IMPL-0004): `<Tabs>` (Phase 4 — uncontrolled / controlled / URL-state opt-in via `urlParam`, full WAI-ARIA keyboard pattern, `Tabs.List` / `Tabs.Trigger` / `Tabs.Content`, 6 tests). `<CodeBlock>` (Phase 4 — standalone async-Shiki primitive for non-Markdown contexts; lazy-import singleton `loadShiki()` so multiple instances share one transform load, SSR `<pre><code>` fallback then `useEffect` swaps to `dangerouslySetInnerHTML` with Shiki's dual-theme `github-light` / `github-dark` output, copy button via `<Button variant="ghost" size="sm">` consumed from `@donaldgifford/design-system` with 1.5s "Copied" flash, 5 tests with `vi.mock("shiki", …)` so jsdom doesn't load the real WASM regex engine). `<Breadcrumb>` (Phase 5 — accessible nav-landmark + ordered list per WAI-ARIA, `Breadcrumb.Item` with `href` / `param` / `current` / `asChild`, link vs span branch by `href` presence, `data-param="true"` on the `<li>` for mono + accent treatment of `{type}` / `{id}` segments, 6 tests). All three stay until a future-IMPL route consumes them — no current `portal/` usage.
- Promoted to `@donaldgifford/design-system@0.4.0-pre` (IMPL-0004 Phase 6, consumed locally via `bun link` until 0.4.0 publishes — the full batch of four cleared all promotion-eligible candidates from `ds-candidates/`): `<Kbd>` (design-system commit `e66886a`), `<Input>` (commit `ca47c3a`), `<Card>` (variants flat/elevated × padding sm/md/lg, `asChild` via Slot, `Card.Header` / `Card.Body` / `Card.Footer` sub-components via `Object.assign(CardRoot, …)`; CSS converted to prefixed-global `.ds-card` / `.ds-card__header` / `.ds-card__body` / `.ds-card__footer` per [INV-0001](docs/investigation/0001-ship-css-modules-from-design-system-tsup-build.md); 7 tests migrated; consumed by `<DocSidebar>` + `<RFCPreviewCard>`), `<Button>` (variants primary/secondary/ghost/icon × sizes sm/md/lg, `asChild` via Slot, default `type="button"`, `aria-disabled` mirror; CSS converted to prefixed-global `.ds-button` per INV-0001; 9 tests migrated with `user-event` → `fireEvent` and `<Link>` → plain `<a>` for the `asChild` test; consumed by `src/routes/search.tsx` + `<SearchModal>` + `<CodeBlock>`'s copy-button). All four ds-candidate folders deleted; tests migrated to `tests/primitives/{Kbd,Input,Card,Button}.test.tsx` in the design-system repo.
- `<Badge>` is now consumed from `@donaldgifford/design-system` (promoted in Phase 6, published as `0.2.0`). Import sites: `src/components/portal/DocCard/DocCard.tsx`, `src/routes/$type.$id.tsx`. The primitive's CSS is loaded via the `@donaldgifford/design-system/styles.css` sub-path import in `src/root.tsx` — one import covers all current and future primitives. Prefixed-global-class shape is documented in [INV-0001](docs/investigation/0001-ship-css-modules-from-design-system-tsup-build.md).
- API client at `src/portal/api/`: `config.ts` (RFC_API_URL reader), `fetcher.ts` (custom orval mutator over `fetch`), `queryClient.ts` (TanStack defaults: 5min staleTime, no refetchOnWindowFocus, retry 1), `errors.ts` (`throwIfProblem` + `classifyProblem` for the 7807 envelope), `pagination.ts` (RFC 5988 `Link` header parser), `docId.ts` (`urlIdFromCanonical` + `canonicalFromUrl` + IMPL-0003's `apiHrefToPortalRoute` for translating `links[].target` API hrefs into portal routes), `msw/` (IMPL-0002 dev-mode + shared test handlers), `__generated__/` (orval output, gitignored).
- Markdown rendering at `src/portal/markdown/` (IMPL-0003): `pipeline.ts` (module-level `remarkPlugins` / `rehypePlugins` arrays consumed by `react-markdown`'s plugin props + the custom sanitize schema), `DocumentView.tsx` (uses `MarkdownHooks` + `<Suspense>` to handle async Shiki, exposes `useDocumentLinks()` via `LinksContext` for `<Anchor>`), `Snippet.tsx` (search-result HTML renderer: rehype-parse → strict-allowlist rehype-sanitize → hast-util-to-jsx-runtime; falls back to plain-text `fallbackTerms` when `html` is unset), `plugins/` (`strip-docz-boilerplate.ts`, `mermaid-marker.ts`, `normalize-hast-properties.ts` — bridges Shiki's raw HTML attribute names back to hast camelCase so sanitize doesn't strip them), `components/` (`Anchor.tsx`, `Code.tsx` exported as `Pre`, `MermaidBlock.tsx`), `styles.css` (prose-only token-driven styling).
- vitest configured with `resolve.dedupe: ["react", "react-dom"]` and an RTL `cleanup` afterEach hook in `tests/setup.ts`. MSW (`msw/node`) wires the **shared fixture-backed handlers** from `src/portal/api/msw/handlers.ts` (IMPL-0002 Phase 3-4) — the same handlers that serve `API_MODE=msw` dev mode also back the integration tests. Per-test overrides go through `server.use(...)` directly, or `mockProblem(urlPattern, status, body)` for explicit error-path injection.
- Tests: `getDoc` hook+MSW (IMPL-0001 Phase 3); `$type.$id` loader (200/404/500) + full-render via `createRoutesStub`; `_index` loader (cursors / Link header / query forwarding) + full-render; `<RouteErrorBoundary>` (404 + 500); `<ThemeToggle>`; IMPL-0002 fixture-loader (10) + MSW handlers (9, incl. paginated `/docs` round-trip + search-envelope contract); IMPL-0003 markdown pipeline (10) + sanitize schema (12) + `<Snippet>` (6) + `strip-docz-boilerplate` plugin (7) + `mermaid-marker` plugin (4) + `<Anchor>` component (5) + `<Pre>` / `<MermaidBlock>` (5); IMPL-0003 `/search` loader (4) + full-render (4). **93 tests across 18 files.** (The 9-test `<Badge>` suite migrated to design-system at `tests/primitives/Badge.test.tsx` in IMPL-0001 Phase 6.)
- CI: `.github/workflows/ci.yml` runs `bun install --frozen-lockfile` (using `secrets.GITHUB_TOKEN` for GitHub Packages), the orval drift check (`scripts/gen-api-check.sh`), and the full static-check + build pipeline.

What's pending manual verification:

- The "live rfc-api" Phase 4 success criteria — running `rfc-api` locally and confirming `bun run dev` shows real data, the 404 path renders for `/rfc/9999`, etc. The loop's environment doesn't have rfc-api running; MSW-backed tests cover the contract against a fixture surface.

What's in flight:

- [IMPL-0003](docs/impl/0003-wire-up-the-markdown-rendering-pipeline-per-design-0002.md) all 7 phases shipped on `feat/design-0002`. Phase 1 landed runtime deps (`react-markdown@10`, `remark-gfm@4`, `rehype-slug@6`, `rehype-autolink-headings@7`, `@shikijs/rehype@4`, `rehype-sanitize@6`, `mermaid@11`) + dev deps (`unified@11`, `unist-util-visit@5`, `@types/hast`, `@types/mdast`, plus `rehype-parse` / `remark-parse` / `remark-rehype` / `rehype-stringify` for tests) and the module-tree scaffold under `src/portal/markdown/`. Phase 2 wired the unified plugin chain (`pipeline.ts`: remark-gfm → rehype-slug → rehype-autolink-headings → @shikijs/rehype → normalize-hast-properties → rehype-sanitize), the dual-theme Shiki config (`github-light` / `github-dark` with the design-system `--color-code-*` palette wrapping the chrome), `<DocumentView>` (uses `MarkdownHooks` + Suspense for async Shiki, exposes `useDocumentLinks()` for Phase 4), and `styles.css` for prose styling (tokens only). 22 new tests (10 pipeline + 12 sanitize). Phase 3 added the two custom plugins per DESIGN-0002 (`strip-docz-boilerplate.ts` removes markdownlint comments + TOC blocks from mdast; `mermaid-marker.ts` tags `language-mermaid` blocks with `dataMermaidSource` and strips the language class so Shiki skips them) plus 11 new tests (7 strip-docz + 4 mermaid-marker). Phase 4 wired the React component overrides: `<Anchor>` (resolves doc links via `links[].target` then `links[].href`, translates API URLs to portal routes via the new `apiHrefToPortalRoute` helper in `src/portal/api/docId.ts`, falls back to external `<a target=_blank rel=noopener>` for `http(s)://` and `<span data-broken-link>` for unresolved internal-looking hrefs); `<Pre>` (passes plain code blocks through to Shiki output unchanged, routes `data-mermaid-source` blocks to `<MermaidBlock>`); `<MermaidBlock>` (dynamic `await import("mermaid")` inside `useEffect` per Resolved §7, theme-aware via `useTheme()`, SSR fallback `<pre>` until hydration). Wired into `<DocumentView>`'s `components` prop. 10 new tests (5 Anchor + 5 Code/MermaidBlock). Phase 5 swapped the `<pre className={styles.body}>{doc.body}</pre>` placeholder in `src/routes/$type.$id.tsx` for `<DocumentView document={doc} />`; dropped `.body` from `$type.$id.module.css` (prose styles now live in `src/portal/markdown/styles.css`); tightened the docPageRender assertion to `getByRole("heading", { level: 2, name: /Motivation/i })`. Phase 6 added `<Snippet>` (search-result HTML renderer): narrower rehype-parse → rehype-sanitize (strict allowlist: `<em>`, `<strong>`, `<mark>`, `<code>` only, no attributes) → hast-util-to-jsx-runtime pipeline; plain-text fallback over `fallbackTerms` when `html` is unset. Phase 7 wired the minimal `/search` route: `searchDocs` loader (empty `q` short-circuits to no API call), `<Form method="get">` input bound to `?q=`, result list with `<Snippet>`-rendered hits linking to `/<type>/<urlId>` (URL form per CLAUDE.md hard rules), empty / no-results states, `<Skeleton>` HydrateFallback. Directory header gained a Search link. Discovered + fixed an IMPL-0002 contract bug along the way: the MSW search handler was returning `Document[]` instead of the OpenAPI-spec `SearchResult[]` envelope; now wraps each fixture with synthesised `<em>q</em>` snippet + `matched_terms` + placeholder score. **93 tests across 18 files.** Production build now ships rendered Markdown + the `/search` route; bundle includes Shiki language grammars (each lang code-split per Vite's chunk graph) plus mermaid (dynamically imported, only on pages that need it). MSW-clean preserved.

Phase 2 gotchas worth remembering:

- `@shikijs/rehype` v4 emits raw HTML attribute names (`class`, `tabindex`) instead of hast camelCase (`className`, `tabIndex`). `rehype-sanitize` looks up by property name, so the raw forms get silently stripped. Fix: `src/portal/markdown/plugins/normalize-hast-properties.ts` runs between Shiki and sanitize to bridge the convention gap.
- `hast-util-sanitize`'s `findDefinition` returns the **first** allowlist entry matching an attribute name. The defaultSchema's `<a>` already has `["className", "data-footnote-backref"]`, so a second `["className", /^heading-anchor$/]` entry is ignored. Fix: merge into a single definition (`["className", "data-footnote-backref", /^heading-anchor$/]`).
- `id` is removed from the sanitize `clobber` array so heading IDs render verbatim — they must match `SearchResult.section_slug` references coming from `rfc-api`. The default `clobberPrefix: "user-content-"` is otherwise a footgun for cross-document anchor links.

What's not wired yet:

- _(none — IMPL-0001 + IMPL-0002 + IMPL-0003 are all complete.)_ The `feat/design-0002` branch is ready for review; manual `just dev` + `just dev-msw` browser smokes are the only outstanding items, and those are covered functionally by the integration tests.

What IMPL-0002 added (`just dev-msw`):

- Hand-curated fixture corpus at `tests/examples/docs/<type>/*.md` — 8 fixtures across `rfc/adr/design/impl/plan/inv` types, frontmatter validated against the `Document` schema (`^[A-Z]+-[0-9]+$` ID pattern enforced).
- Async fixture loader at `src/portal/api/msw/fixtures.ts` — branches on `typeof window` so the SSR side reads via `await import("node:fs")` and the client side via `import.meta.glob<string>(...)?raw`. Cache is lazy + idempotent.
- MSW handlers at `src/portal/api/msw/{handlers,browser,server}.ts` — real RFC 5988 cursor pagination (opaque base64-int offsets), RFC 7807 problem responses with seeded `faker` request IDs, and listing-vs-fetch route ordering that respects MSW's last-match-wins.
- SSR boot at `src/portal/api/msw/setup.ts` — gated on `import.meta.env.SSR && import.meta.env.DEV && process.env.API_MODE === "msw"`. The two build-time-replaced flags let Vite DCE the entire branch from production artefacts; the runtime check decides per-process whether to start.
- Client boot at `src/entry.client.tsx` — overrides RR7's auto-generated entry to start the MSW worker before `hydrateRoot` when `VITE_API_MODE=msw`. Production / non-MSW dev gets the dynamic import tree-shaken.
- Operator surface: `bun run dev:msw`, `just dev-msw`, `.env.example` with the split-flags rationale, README §Local development without rfc-api, and a `CLAUDE.md §Task runner` pointer.
- Test infra: `tests/api/server.ts` now mounts the same handlers as the dev-mode SSR boot, so the integration suite exercises the exact paths the dev server runs. `mockProblem(urlPattern, status, body)` is the only remaining bespoke override helper, kept narrow for explicit error-path tests.

What IMPL-0003 added (Markdown rendering + `/search`):

- **Pipeline** at `src/portal/markdown/pipeline.ts`. Plugin chain: remark-gfm → `strip-docz-boilerplate` (removes markdownlint comments + TOC blocks from mdast, with defensive handling for orphan toc markers) → rehype-slug → rehype-autolink-headings → `mermaid-marker` (tags `language-mermaid` blocks with `dataMermaidSource` and strips the language class so Shiki skips them) → `@shikijs/rehype` (dual-theme `github-light` / `github-dark` wired to the design-system `--color-code-*` palette) → `normalize-hast-properties` → `rehype-sanitize`. The plugin arrays are module-level constants consumed via `react-markdown`'s `remarkPlugins` / `rehypePlugins` props.
- **`<DocumentView>`** at `src/portal/markdown/DocumentView.tsx` — uses `MarkdownHooks` + `<Suspense>` to handle Shiki's async transform without React 19 throwing "runSync finished async". Provides `LinksContext` with the doc payload's `links[]` array; `<Anchor>` consumes it via the exported `useDocumentLinks()` hook. Wired into `src/routes/$type.$id.tsx` Phase 5, replacing the `<pre>` placeholder.
- **`<Snippet>`** at `src/portal/markdown/Snippet.tsx` — narrower pipeline for search-result HTML: rehype-parse → rehype-sanitize (strict allowlist: `<em>`, `<strong>`, `<mark>`, `<code>`; no attributes) → hast-util-to-jsx-runtime. Falls back to plain-text rendering with `<mark>` over `fallbackTerms` when `html` is unset.
- **Component overrides** at `src/portal/markdown/components/`: `<Anchor>` (resolves doc links via `links[].target` first, then `links[].href`, then external `http(s)://` with `target=_blank rel=noopener`, then `<span data-broken-link>` for unresolved internal-looking hrefs); `<Pre>` (passes plain code blocks through Shiki's HTML unchanged, routes `data-mermaid-source` blocks to `<MermaidBlock>`); `<MermaidBlock>` (dynamic `await import("mermaid")` inside `useEffect`, theme-aware via `useTheme()`, SSR fallback `<pre>` until hydration, object-sentinel cancellation pattern for eslint compatibility).
- **`/search` route** at `src/routes/search.tsx` — empty `q` short-circuits the loader (no API call); non-empty calls `searchDocs({ q, limit: 25 })` and renders hits with `<Snippet>` linking to `/<type>/<urlId>` (URL form per Hard rules). Empty / no-results / loading states; `<Skeleton>` HydrateFallback. Directory header gained a Search link.
- **Helper** at `src/portal/api/docId.ts`: `apiHrefToPortalRoute(apiHref)` translates `links[].target` API hrefs (e.g. `/api/v1/rfc/0001`) into portal routes (`/rfc/0001`).
- **MSW contract fix** in `src/portal/api/msw/handlers.ts` — the IMPL-0002 search handler was returning `Document[]` instead of the OpenAPI-spec `SearchResult[]`. Now wraps each fixture in a `SearchResult` envelope with synthesised `<em>q</em>` snippet, `matched_terms`, and a placeholder score.
- **Bundle impact:** Production build ships rendered Markdown + the `/search` route, including Shiki language grammars (code-split per language via Vite's chunk graph) and mermaid (dynamically imported only on pages that need it). MSW-clean preserved.

IMPL-0003 gotchas worth remembering:

- `@shikijs/rehype` v4 emits raw HTML attribute names (`class`, `tabindex`) instead of hast camelCase (`className`, `tabIndex`). `rehype-sanitize` looks up by property name, so the raw forms get silently stripped — including the `.shiki` class on `<pre>` that the prose CSS targets. Fix: `src/portal/markdown/plugins/normalize-hast-properties.ts` runs between Shiki and sanitize to bridge the convention gap.
- `hast-util-sanitize`'s `findDefinition` returns the **first** allowlist entry matching an attribute name. The defaultSchema's `<a>` already has `["className", "data-footnote-backref"]`, so a second `["className", /^heading-anchor$/]` entry is silently ignored. Fix: merge into a single definition (`["className", "data-footnote-backref", /^heading-anchor$/]`).
- `id` is removed from the sanitize `clobber` array so heading IDs render verbatim — they must match `SearchResult.section_slug` references coming from `rfc-api`. The default `clobberPrefix: "user-content-"` is otherwise a footgun for cross-document anchor links.
- React 19 + Shiki: `<Markdown>` synchronous render throws "runSync finished async" because `@shikijs/rehype`'s transform is async. Use `<MarkdownHooks>` (the hooks variant suspends correctly) inside a `<Suspense>` boundary.

## Canonical specs (read these first)

The load-bearing set for any non-trivial change:

- **[DESIGN-0001](docs/design/0001-portal-architecture-and-ds-candidates-promotion-model.md)** — portal architecture: the `ds-candidates/` promotion model, component authoring rules, where the API client lives, hard rules. The architectural *why/what* for the view layer.
- **[DESIGN-0002](docs/design/0002-markdown-rendering-pipeline.md)** — Markdown rendering pipeline: parser, plugin chain, sanitization, mermaid hydration, where it lives in `portal/`. The renderer for `Document.body`.
- **[ADR-0001](docs/adr/0001-consume-rfc-api-via-its-published-openapi-contract.md)** — `rfc-site` consumes `rfc-api` exclusively through its OpenAPI contract. Vendor the spec, generate a typed TS client, drift = CI failure.
- **[ADR-0002](docs/adr/0002-adopt-portal-frontend-stack.md)** — frontend stack: React 19 + React Router v7 + TanStack Query + orval + Vite + Bun. The single source of truth for "what does the portal use?".
- **[Integration reference](docs/integration/rfc-api-reference.md)** — the *how* companion to ADR-0001: endpoint payloads, error-sentinel→UI mapping, the Markdown contract (GFM + mermaid + sanitize, no MDX), local-stack runbook.

Also referenced often:

- **[`api/openapi.yaml`](api/openapi.yaml)** — vendored OpenAPI 3.1 spec for `rfc-api`. See `api/README.md`. Sync mechanism is TBD per ADR-0001 Phase 1.
- **[Archived build guide](docs/archive/0001-rfc-site-build-guide.md)** — the original "primary spec" that DESIGN-0001 and ADR-0001 superseded. Frozen snapshot, **not authoritative** — when it disagrees with the canonical specs, the canonical specs win. Useful only for provenance.

## Tooling

- **Runtime + package manager:** Bun (`mise.toml` pins `latest`; currently 1.3.11).
- **Bundler:** Vite 8 (`@react-router/dev/vite` plugin owns dev/build/SSR entry generation in framework mode).
- **Framework + router:** React 19.2.5 + React Router v7.14 (framework mode, `appDirectory: "src"`, `ssr: true`). Routes discovered via `@react-router/fs-routes` from `src/routes.ts` — `ignoredRouteFiles` excludes `**/*.module.css`, `**/*.test.{ts,tsx}`, `**/README.md`. Production server: `@react-router/serve`. Ratified in [ADR-0002](docs/adr/0002-adopt-portal-frontend-stack.md), following Oxide's [`rfd-site`](https://github.com/oxidecomputer/rfd-site) precedent.
- **Data fetching:** TanStack Query 5.100 + orval 8.9 (with MSW 2 for handler generation + `@faker-js/faker` 10 for response fixtures). orval is wired in `tags-split` mode at `src/portal/api/__generated__/` with a custom `fetch` mutator (`src/portal/api/fetcher.ts`) that prepends `RFC_API_URL` and forces `accept: application/json, application/problem+json` for the RFC 7807 error envelope. The QueryClient (`src/portal/api/queryClient.ts`) sets `staleTime: 5 * 60 * 1000`, `refetchOnWindowFocus: false`, `retry: 1` per IMPL-0001 §Phase 3. Generated dir is gitignored; run `just gen-api` after spec changes; CI runs `just gen-api-check` for the drift signal.
- **Markdown rendering:** `react-markdown@10` + `remark-gfm@4` + `rehype-slug@6` + `rehype-autolink-headings@7` + `@shikijs/rehype@4` + `rehype-sanitize@6` + `mermaid@11` (client-side hydration). Two custom plugins (`strip-docz-boilerplate`, `mermaid-marker`) plus the `normalize-hast-properties` bridge between Shiki and sanitize. Lives at `src/portal/markdown/`. See [DESIGN-0002](docs/design/0002-markdown-rendering-pipeline.md) for the full plugin chain rationale and [IMPL-0003](docs/impl/0003-wire-up-the-markdown-rendering-pipeline-per-design-0002.md) for the wiring.
- **Language:** TypeScript ^5.7.2 strict, `target: ES2022`, `moduleResolution: bundler`. `tsconfig.json` mirrors the design-system repo verbatim with all extra strictness (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `isolatedModules`, etc.).
- **Lint/format:** ESLint v9 flat config + Prettier — mirror the design-system repo verbatim so promoted candidates pass lint in both repos with no churn. Versions: eslint ^9.17, typescript-eslint ^8.18, eslint-plugin-react ^7.37, react-hooks ^5.1, jsx-a11y ^6.10.
- **Tests:** vitest ^2.1.8 + jsdom ^25.0.1 + `@testing-library/react` ^16.3.2 + `@testing-library/jest-dom` ^6.9.1 + `@testing-library/user-event` ^14.6.1. `tests/setup.ts` extends expect with jest-dom matchers and registers an `afterEach(cleanup)` so screen queries don't leak between tests. Vitest discovers both `tests/**/*.test.{ts,tsx}` and `src/**/*.test.{ts,tsx}` (the latter for colocated `portal/` and `ds-candidate` tests per DESIGN-0001 §Resolved). `vitest.config.ts` sets `resolve.dedupe: ["react", "react-dom"]` so the design-system always consumes rfc-site's React, whether resolved from the registry or via `bun link` during parallel iteration (otherwise jsdom hits the classic two-React `useState` is null crash). Also sets `testTimeout: 15000` for Shiki cold-start headroom on the GitHub Actions runner.

`mise.toml` reconciled: `bun = "latest"` added, `pnpm = "10.33.2"` removed, `node = "22"` kept for tool compat headroom (drop later when every tool is confirmed Bun-native).

GitHub Packages auth is required to install the design system. Commit `bunfig.toml` (resolved — `.npmrc` is not committed); `NPM_TOKEN` must have `read:packages`. CI uses `secrets.GITHUB_TOKEN` which already has that scope under the same `donaldgifford` owner. The dep is declared with a normal semver range (`^0.3.0`) and resolves through `bunfig.toml`'s `@donaldgifford` scope mapping; `bun install` pulls the published artefact. If `NPM_TOKEN` is missing locally, fix the auth — don't fall back to `bun link` as a workaround. `bun link` is the parallel-iteration escape hatch documented in §When iterating in parallel, not a fallback for missing credentials.

## Task runner (`justfile`)

A `justfile` mirrors `package.json` scripts as recipes. Prefer `just <recipe>` over `bun run x` for the loop. Composite: `just check` runs typecheck → lint → format-check → test (CI parity). Design-system local workflow: `just ds-build`, `just ds-link`, `just ds-unlink`. **MSW dev mode (no rfc-api / Postgres / webhook required):** `just dev-msw` — sets `API_MODE=msw` + `VITE_API_MODE=msw`, boots the dev server with the fixture-backed handlers (see IMPL-0002 + README §Local development without rfc-api). `just --list` for the full recipe list.

## Architecture: portal-first, primitives follow

Per RFC-0002 §Rollout (in the design-system repo): build the portal with components inline, then **promote** stabilized components into `@donaldgifford/design-system`. Components are not designed in the design system by anticipation.

The load-bearing convention is the `src/components/ds-candidates/` folder. Components there must be **shaped exactly like they would be in the design system** so promotion is `cp -r` (plus a single `git mv` for the colocated test file — see the promotion workflow below). That means:

- One folder per component, with `Component.tsx`, `Component.module.css`, `index.ts`.
- `forwardRef`, named exports, native DOM prop pass-through.
- Imports only design-system tokens (`var(--...)`) and design-system primitives — never sibling `portal/` code, `pages/`, `routes/`, app state, the API client, or TanStack Query.

Portal-only code (routing, page layouts, Markdown rendering, auth, data fetching, RFC-specific features) lives in `src/components/portal/`, `src/pages/`, `src/routes/` — and is **never promoted**.

The OpenAPI-generated client + TanStack Query hooks live under `src/portal/api/` (or similar — under `portal/`, never under `ds-candidates/`). If a candidate needs data, the consuming `portal/` page passes it as props.

The "ready to promote" checklist lives in DESIGN-0001 (§The `ds-candidates/` contract): used 2+ places, API stable ~2 weeks, no portal-only deps.

## Hard rules (anti-patterns to refuse)

From DESIGN-0001 §Anti-patterns and the design-system ADRs. Treat as guardrails, not suggestions:

- **Never fork tokens.** `tokens.css` is consumed via `import "@donaldgifford/design-system/tokens.css"` exactly once at the app entry. Never copy its contents into portal CSS, never override design-system CSS variables in portal CSS.
- **Never add a blanket component library** (Radix Themes, shadcn/ui, MUI, Chakra, etc.). The single sanctioned Radix dependency is `@radix-ui/react-slot` (design-system DESIGN-0002, for `asChild` composition). Adding others re-creates the inconsistency RFC-0002 was solving. Note: Oxide's `rfd-site` uses Tailwind alongside their design system — that is a divergence we deliberately do not follow.
- **Never roll a theme switcher.** Use `useTheme` from `@donaldgifford/design-system/theme`. It handles `data-theme`, localStorage (`design-system:theme`), `prefers-color-scheme`, and SSR safety.
- **Never theme-branch inside components.** `if (theme === "light") …` in component code is a bug — tokens already remap when `data-theme` flips. If branching feels necessary, the missing piece is a semantic token in the design system.
- **No CSS-in-JS runtime, no Tailwind, no `style={}` for non-dynamic values.** CSS Modules, co-located.
- **API shape:** `variant` / `size` / `status` as string unions, never `isPrimary`-style booleans.
- **`className` merges, never replaces** — use `clsx` or a `cn()` helper.
- **Resolve cross-document Markdown links from the doc payload's `links[]` array, not by parsing relative paths in the body.** `rfc-api` does that resolution; doing it again on the client is duplicate work that drifts.
- **Never hand-write request/response types** for anything `rfc-api` owns. Extend the contract upstream in `rfc-api`, then regenerate.
- **Use the URL form for `Document.id` when building portal links and API calls.** The OpenAPI parameter `DocID` is `^[0-9]+$` (bare numeric, e.g. `"0001"`), and `rfc-api` reconstructs the canonical id (`"RFC-0001"`) server-side via `docid.Canonical(type, urlID)`. Sending the canonical form double-prefixes server-side (`"RFC-RFC-0001"`) and 404s — exactly the pitfall ADR-0001's "Document id in URLs" row called out. Use `urlIdFromCanonical(doc.id)` from `src/portal/api/docId.ts` when building Links from a `Document.id`; display surfaces (breadcrumbs, datelines, card chrome) keep using the canonical form verbatim. Commit `f8883c7` fixed an instance of this bug; the helper module documents the why.

## When iterating on the design system in parallel

**This is an explicit opt-in workflow, not the default.** The default is to consume the published `@donaldgifford/design-system` from GitHub Packages. Only reach for `bun link` when iterating on a token/hook/primitive in the design-system repo and you need the portal to see the change before publishing.

The flow: `just ds-build` (the portal imports from `dist/`, not source) → `just ds-link` (symlinks `node_modules/@donaldgifford/design-system` to the local checkout) → iterate. **Critical:** after edits, **run the design-system build again** (the link is filesystem-level, not watch-based), **add a changeset** in the design-system repo (otherwise the change won't ship), publish, then `rm node_modules/@donaldgifford/design-system && bun install` to flip back to the registry version and confirm the change works against the published artefact before opening a portal-side PR. (`bun unlink {pkg}` is not implemented in Bun 1.3 — remove the symlink directly and reinstall.)

## Promotion workflow

When a `ds-candidate` meets the readiness checklist (DESIGN-0001 §The `ds-candidates/` contract):

1. In the design-system repo: `cp -r` the candidate folder to `src/primitives/<Component>/` (excluding the colocated `.test.tsx`), `git mv` the test to `tests/primitives/<Component>.test.tsx` (the design-system repo uses a top-level `tests/` directory mirroring `src/`), update `src/index.ts`, run lint/typecheck/test/build, add a changeset, ship via the release workflow.
2. In this repo: `bun update @donaldgifford/design-system`, swap candidate imports for package imports, delete `ds-candidates/<Component>/`, verify pages render identically.

## Repo layout (current)

```
api/
  openapi.yaml                       ← vendored from rfc-api; sync mechanism TBD
  README.md
docs/
  adr/                               ← docz-managed; ADR-0001 (API contract) and ADR-0002 (stack) are load-bearing
  design/                            ← docz-managed; DESIGN-0001 (portal architecture) and DESIGN-0002 (Markdown pipeline) are load-bearing
  impl/                              ← IMPL-0001 (bootstrap scaffold) + IMPL-0002 (`API_MODE=msw`) + IMPL-0003 (Markdown pipeline + `/search`) — all closed
  integration/                       ← non-docz reference docs (rfc-api cookbook)
  archive/                           ← frozen historical source material
src/
  root.tsx                           ← RR7 framework-mode root (Layout + App + QueryClientProvider)
  routes.ts                          ← flatRoutes() with ignoredRouteFiles
  routes/
    _index.tsx                       ← directory: listDocs card grid + Link-header pagination
    _index.module.css
    $type.$id.tsx                    ← doc page: getDoc loader, title/Badge/dateline + <DocumentView>
    $type.$id.module.css
    search.tsx                       ← IMPL-0003 Phase 7: searchDocs loader + <Snippet>-rendered hits
    search.module.css
    README.md                        ← documents the flat-routes convention
  components/
    portal/
      ThemeToggle/                   ← IMPL-0001 Phase 2 (test colocated)
      DocCard/                       ← IMPL-0001 Phase 4 directory card (consumes <Badge>)
      RouteErrorBoundary/            ← IMPL-0001 Phase 4 7807 → portal error UI (test colocated)
      Skeleton/                      ← IMPL-0001 Phase 4 polish: shimmer placeholder for HydrateFallback
      Topbar/                        ← IMPL-0004 Phase 3 sticky topbar (brand + search trigger + ⌘K + ThemeToggle)
      DirectoryTable/                ← IMPL-0004 Phase 7a semantic 5-col table for / (5 tests)
      DocSidebar/                    ← IMPL-0004 Phase 8a metadata sidebar for /$type/$id (7 tests)
      RFCPreviewCard/                ← IMPL-0004 Phase 8b hover popover wrapping resolved internal <Anchor> links (5 tests)
      SearchModal/                   ← IMPL-0004 Phase 9a fixed-overlay search modal (⌘K opens, Escape closes, 7 tests)
      README.md                      ← what belongs in portal/
    ds-candidates/
      README.md                      ← authoring checklist + promotion contract (IMPL-0004 Phase 1)
      Button/                        ← IMPL-0004 Phase 1: primitive shipped (variants + asChild + 9 tests)
      # Input/ + Kbd/ promoted to @donaldgifford/design-system@0.4.0-pre (IMPL-0004 Phase 6)
      Card/                          ← IMPL-0004 Phase 4: flat/elevated × sm/md/lg padding + Header/Body/Footer (7 tests)
      Tabs/                          ← IMPL-0004 Phase 4: WAI-ARIA tabs + urlParam opt-in + List/Trigger/Content (6 tests)
      CodeBlock/                     ← IMPL-0004 Phase 4: lazy-Shiki standalone primitive + copy button (5 tests)
      Breadcrumb/                    ← IMPL-0004 Phase 5: nav landmark + ordered list + Item w/ param + asChild (6 tests)
  pages/                             ← (empty; reserve for page-specific composites)
  styles/                            ← (empty; portal-local CSS only — never tokens)
  portal/api/
    config.ts                        ← RFC_API_URL reader (import.meta.env + process.env)
    fetcher.ts                       ← orval custom mutator over fetch
    queryClient.ts                   ← TanStack QueryClient factory (Phase 3 defaults)
    errors.ts                        ← throwIfProblem + classifyProblem (RFC 7807)
    pagination.ts                    ← RFC 5988 Link header parser
    docId.ts                         ← urlIdFromCanonical / canonicalFromUrl / apiHrefToPortalRoute
    msw/                             ← IMPL-0002 dev-mode + shared test handlers (handlers / browser / server / setup / fixtures)
    __generated__/                   ← orval output (gitignored — never commit)
  portal/markdown/                   ← IMPL-0003: unified pipeline + components for Document.body
    pipeline.ts                      ← remarkPlugins / rehypePlugins arrays + sanitize schema
    DocumentView.tsx                 ← MarkdownHooks + Suspense + LinksContext (useDocumentLinks)
    Snippet.tsx                      ← search-result HTML renderer (rehype-parse + sanitize + jsx-runtime)
    styles.css                       ← prose styling (tokens only)
    plugins/                         ← strip-docz-boilerplate / mermaid-marker / normalize-hast-properties
    components/                      ← Anchor / Code (exported as Pre) / MermaidBlock
tests/
  setup.ts                           ← jest-dom matchers + RTL afterEach(cleanup)
  api/server.ts                      ← shared MSW server + mockProblem helper
  api/getDoc.test.tsx                ← IMPL-0001 Phase 3: hook+MSW smoke test
  api/docPage.test.ts                ← IMPL-0001 Phase 4: $type.$id loader (200/404/500)
  api/docPageRender.test.tsx         ← IMPL-0001 Phase 4: $type.$id full render via createRoutesStub
  api/indexRoute.test.ts             ← IMPL-0001 Phase 4: _index loader (cursors / Link header / query forwarding)
  api/indexRouteRender.test.tsx     ← IMPL-0001 Phase 4: _index full render via createRoutesStub
  api/searchRoute.test.ts            ← IMPL-0003 Phase 7: /search loader (4 tests)
  api/searchRouteRender.test.tsx     ← IMPL-0003 Phase 7: /search full render via createRoutesStub (4 tests)
  api/msw/fixtures.test.ts           ← IMPL-0002 Phase 2: loader unit tests (10 tests)
  api/msw/handlers.test.ts           ← IMPL-0002 Phase 3: MSW handlers incl. pagination round-trip + search-envelope contract (9 tests)
  portal/markdown/                   ← IMPL-0003: pipeline + sanitize + Snippet + plugin + component tests
  utils/msw.ts                       ← setupMswLifecycle() — shared MSW beforeAll/afterEach/afterAll
  utils/renderRoute.tsx              ← renderRoute() — createRoutesStub + RTL render in one call
  examples/docs/                     ← IMPL-0002 Phase 1: hand-curated fixture tree for `API_MODE=msw`
    rfc/  adr/  design/  impl/  plan/  inv/  ← one subdir per DocumentType
    README.md                        ← pointer to PLAN-0001 / IMPL-0002
scripts/
  gen-api-check.sh                   ← orval drift check (CI + local)
.github/workflows/ci.yml             ← CI: install + drift check + static checks + build
api/openapi.yaml                     ← vendored
bunfig.toml                          ← @donaldgifford → npm.pkg.github.com
orval.config.ts                      ← react-query + fetch + MSW
react-router.config.ts               ← appDirectory: "src", ssr: true
vite.config.ts                       ← @react-router/dev plugin
vitest.config.ts                     ← jsdom + dedupe react / react-dom
justfile                             ← task runner (mirrors package.json scripts)
mise.toml                            ← bun = latest, node = 22, just = latest
.env.example
.docz.yaml
CLAUDE.md
```

Next impl-level work: TBD. IMPL-0001 (bootstrap), IMPL-0002 (`API_MODE=msw`), and IMPL-0003 (Markdown pipeline + `/search`) all closed. The portal now SSR-renders rendered Markdown end-to-end; the natural next slice is whatever DESIGN-doc the team prioritises after `feat/design-0002` lands.
