# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo state

[RFC-0001](docs/rfc/0001-defer-the-design-system-promotion-model-and-iterate-rfc-site.md) defers `@donaldgifford/design-system` and rebuilds the portal directly against `donaldgifford/design-system/rfc-portal-mockup_15.html` as the visual spec. [DESIGN-0003](docs/design/0003-rebuild-rfc-site-against-the-mockup.md) is the plan; [IMPL-0005](docs/impl/0005-execute-the-rfc-site-rebuild-per-design-0003.md) is the 6-phase tracker.

**Phases 0, 1, 2, 3, and 4a shipped.**

- **Phase 0 (the wipe)** — `src/components/portal/` + `src/components/ds-candidates/` deleted; `@donaldgifford/design-system` + `@radix-ui/react-slot` removed; `bunfig.toml` deleted; CI no longer reads GitHub Packages. `<MermaidBlock>` hard-codes `theme: "dark"` (RFC-0001: dark-only). Loaders + API contract integration left intact.
- **Phase 1 (tokens + Topbar + Directory)** — `src/styles/tokens.css` populated from mockup §14-70 (50+ design tokens). `src/styles/base.css` reset + Google Fonts import (IBM Plex Sans/Mono + Source Serif 4). `src/components/Topbar/` (3-element brand wordmark + `<Input>`-style search trigger + `⌘K` global binding + NavLink-active state + 4 placeholder nav links + avatar; glass surface via `backdrop-filter: blur(12px)` over `rgba(11,14,13,0.85)`). `src/components/Directory/` — `DirectoryHero` (3120px max-width serif h1 + uppercase mono kicker), `LiveFilter` (per-keystroke input), `DirectoryToolbar` (filter + sort URL state, default sort `updated_desc`), `DirectoryTable` + `RfcRow` (semantic 5-col table, hairline rows), `StatusBadge` (mockup §580-608: 11px mono uppercase, `--status-*` colour via `currentColor`, `color-mix` 10% bg). `/` loader auto-pins `?filter=type:rfc` when URL omits filter; explicit `filter[]` honoured for future scope expansion.
- **Phase 2 (RFC page)** — `src/components/DocPage/` — `DocPage` (3-col grid `240px minmax(0,1fr) 240px`, gap 56px, collapses single-col under 800px); `DocSidebar` (sticky `top: 88px`, chrome-less `.sidebar-section` blocks: Status / Authors / Created / Updated / Revision / PR / Labels; `revision` from `doc.source.commit?.slice(0,7)`; PR tag from `doc.discussion?.url` trailing segment); `NumberLine` (mono accent eyebrow with linear-gradient `::after` divider); `HeaderMeta` (single mono-12 row, `·` aria-hidden dividers, status-badge + authored-by + revision + relative-updated; `relativeFromNow` exported for reuse); `DocHeader` (NumberLine + serif 42px h1 + HeaderMeta); `TableOfContents` (walks article ref via MutationObserver, IntersectionObserver scroll-spy with `.current` highlight, `.nested` h3 indent); `ReferencesFooter` (2-col grid, outgoing refs from `doc.links[]` rendered as RR7 `<Link>` via `apiHrefToPortalRoute`, "Referenced by" empty state until rfc-api back-references endpoint ships). Markdown pipeline gained `remark-github-alerts` after `strip-docz-boilerplate`: `> [!NOTE|WARNING|TIP|CAUTION|IMPORTANT]` syntax lifted to `<div class="admonition <kind>">` + `<span class="adm-label">…</span>` via mdast `data.hName` / `data.hProperties`. `[!IMPORTANT]` normalised to `note` (mockup has no Important variant). Sanitize schema extended to permit the div / span / className shapes. Prose styles rewritten in `src/portal/markdown/styles.css` against mockup tokens — admonition variants use `color-mix(in srgb, var(--status-*) 16%, var(--bg-base))` for saturated tint; serif h2 (26px / 500) with mono `#` heading-anchor; blockquote raised-bg + serif quote glyph; table th mono-uppercase 10px on `--bg-raised`.
- **Phase 3 (SearchModal + /search)** — `src/components/SearchModal/` — `SearchModal` (controlled by `<Topbar>` via `?modal=1` URL state; renders through `createPortal(..., document.body)` so the backdrop sits above the topbar at z-index 200; 780px top-anchored 96px padding-top, `max-height: calc(100vh - 192px)`, blur-8px backdrop). `SearchResultsList` (left pane, 320px wide, sticky mono-10 uppercase group headers by `document.type`, 3-row `.item` layout with `<mark>`-highlighted snippet via `dangerouslySetInnerHTML` against the rfc-api-sanitized snippet HTML, active row tint via `color-mix(--accent 8%, --bg-elevated)`). `SearchPreviewPane` (right pane, borderless `--bg-base`, NumberLine eyebrow + serif 22px title + meta row + section-heading h3 + snippet HTML). 5 content-scope filter pills (`all results / titles / body / authors / labels`) — `all results` shows live result count via `.pillCount`, per-facet pills are visual-only with `title="Coming soon"` until rfc-api ships a `field` param (F-2 followups). Behaviour: queueMicrotask input focus on open; captured/restored `previouslyFocusedRef` around open/close; 120ms debounce + `AbortController` per keystroke; `performance.now()` round-trip latency surfaced as `meilisearch ● Nms` footer chip; Escape / backdrop click both close (via `role="presentation"` overlay onClick + dialog `onKeyDown`); ↑/↓ moves `activeIndex`, ↵ navigates via RR7; Tab/Shift+Tab cycle inside the dialog via `querySelectorAll` focusable list. `<Topbar>` wires `⌘K`/`Ctrl+K` document keydown to `setSearchParams({ modal: "1" })` with `replace: true` + `preventScrollReset: true`; trigger click opens modal; meta/ctrl-click on trigger navigates to `/search` for the no-JS fallback path. `src/routes/search.tsx` rebuilt as the no-JS fallback — degraded surface (no preview pane, no kb-nav, no filter pills): `<Form method="get">` input + result list with snippet HTML; CSS module subset of the modal styles.
- **Phase 4a (`/mcp` shell)** — `src/components/McpPage/` — `McpPage` (single-column 1000px max-width, 48px/40px/96px padding) composes hero + 2-card related-servers grid + 4 numbered setup sections (Install / Configure / Tools / Verify). `content.ts` is the portal-local single source of truth — `MCP_VERSION` (`0.4.2`), `MCP_SERVERS` (rfcs-mcp + docs-mcp with tagVariant), `MCP_DOWNLOADS` (4 per-platform entries), `MCP_BUILD_FROM_SOURCE`, `MCP_CONFIG_SNIPPETS` (3 client snippets), `MCP_TOOLS` (5 tools), `MCP_VERIFY_PROMPT`. `ExampleTabs` is a fresh tab component (no design-system inheritance) — `useState`-driven, `role="tablist"`/`role="tab"`/`aria-selected`, mockup §1825-1865 styling with `--code-bg` body + `--code-type` active-tab text. The MCP h1 + paragraph descriptions use a small `inlineCode(str)` helper that promotes backticks to `<code>`-with-keyword-colour via `dangerouslySetInnerHTML` (trusted because the strings are portal-authored constants in `content.ts`). `src/routes/mcp.tsx` is loader-less; meta sets the title. `<Topbar>` swaps the MCP placeholder `<span>` for a real `<NavLink to="/mcp">` with the same `linkActive` styling as Directory.

**Test totals**: Phase 3 added 12 (7 SearchModal + 3 searchRouteRender + 2 reworked Topbar) for **188 tests across 30 files**; Phase 4a added 10 (7 McpPage + 2 mcpRouteRender + 1 reworked Topbar placeholder + 1 new MCP NavLink) for **198 tests across 32 files**.

What's wired:

- **React 19 + React Router v7** (framework mode, `appDirectory: "src"`, `ssr: true`). Production: `@react-router/serve`.
- **API client at `src/portal/api/`** — orval-generated client from `api/openapi.yaml`, custom `fetch` mutator, RFC 7807 problem envelope (`errors.ts`), RFC 5988 `Link` parser (`pagination.ts`), `docId.ts` helpers (URL form vs canonical form + `apiHrefToPortalRoute`), `msw/` for `API_MODE=msw` dev mode + shared test handlers.
- **Markdown pipeline at `src/portal/markdown/`** — `DocumentView` (`MarkdownHooks` + `<Suspense>` for async Shiki), `Snippet` (search-result HTML), unified plugin chain: remark-gfm → strip-docz-boilerplate → **remark-github-alerts** → rehype-slug → rehype-autolink-headings → mermaid-marker → @shikijs/rehype → normalize-hast-properties → rehype-sanitize.
- **TanStack Query** in `src/root.tsx` (`QueryClientProvider` + `useState(createQueryClient)` for SSR isolation).
- **Routes**: `_index.tsx` (Directory: `<DirectoryHero>` + `<LiveFilter>` + `<DirectoryToolbar>` + `<DirectoryTable>`, auto-pinned `filter=type:rfc`, default `sort=updated_desc`), `$type.$id.tsx` (RFC page: `<DocPage>` shell + `<DocHeader>` + `<DocumentView>` (article ref) + `<ReferencesFooter>` + `<DocSidebar>` + `<TableOfContents>`), `search.tsx` (Search no-JS fallback: `<Form method="get">` + result list with snippet HTML; `?q=` loader short-circuits on empty `q`), `mcp.tsx` (MCP discovery + setup page: hero / 2-server cards / 4 numbered setup steps; loader-less, content from `src/components/McpPage/content.ts`).
- **Search**: `<SearchModal>` mounted from `<Topbar>` and controlled via `?modal=1` URL state. `⌘K`/`Ctrl+K` opens; trigger click opens; meta-click on trigger uses `/search` fallback. Renders through `createPortal(..., document.body)`. Filter pills are visual-only (per-facet content-scope filtering depends on rfc-api `field` param — F-2 followup).

What's next (per IMPL-0005):

- **Phase 4b** — `/api` shell. `/api` parses the vendored `api/openapi.yaml` client-side.

Deferred from Phase 2 (tracked in IMPL-0005 §Phase 2 — not blocking phase close):

- **`<RfcLink>` / `<RFCPreviewCard>` cross-RFC hover preview** (mockup §861-923). Substantial chunk requiring `useGetDoc` + popover orchestration + `classifyProblem` for 404s; folded into a future slice alongside SearchModal's preview pane and a likely `<Popover>` extraction. Today's `<Anchor>` still resolves cross-doc links and falls through to external / broken-link sentinels correctly — only the hover preview chrome is missing.
- **Code-block language-badge chip** on `pre[data-lang]` (mockup §812-823) — requires a rehype plugin extension to carry meta.lang through; not a Phase 2 success criterion.
- **Mermaid caption sub-element** (mockup §1170-1179) — decorative; depends on rfc-api emitting caption metadata.

Deferred from Phase 3 (tracked in IMPL-0005 §Phase 3 — not blocking phase close):

- **Content-scope filter facets** (titles / body / authors / labels). Pills are visual-only — clicking `titles` etc. flips the active pill state but the search request still sends `q` alone. Depends on rfc-api `searchDocs` accepting a `field` param (F-2 followup). When that lands the `activeScope` state should drive the request payload.
- **Cross-doc preview section content** — the preview pane renders `result.snippet` HTML; if rfc-api later exposes section-by-section content (e.g. `getDocSection`), the preview can fetch the full `Summary` / `Motivation` for a richer view. Today we render only the matched snippet plus the section heading.

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

## Repo layout (current — through Phase 4a)

```
api/
  openapi.yaml                       ← vendored from rfc-api; sync mechanism TBD
  README.md
docs/
  adr/                               ← ADR-0001 (API contract) + ADR-0002 (stack) — both load-bearing
  design/                            ← DESIGN-0002 (Markdown pipeline) + DESIGN-0003 (rebuild plan)
  impl/                              ← IMPL-0001..0004 closed; IMPL-0005 Phase 0/1/2/3/4a done
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
    Topbar/                          ← Brand + search trigger + ⌘K + nav placeholders + MCP NavLink + SearchModal mount (8 tests)
    Directory/                       ← DirectoryHero / LiveFilter / DirectoryToolbar / DirectoryTable / RfcRow / StatusBadge (33 tests)
    DocPage/                         ← DocPage shell + DocSidebar + DocHeader/NumberLine/HeaderMeta + TableOfContents + ReferencesFooter (24 tests)
    SearchModal/                     ← SearchModal (portal-rendered dialog) + SearchResultsList + SearchPreviewPane (7 tests)
    McpPage/                         ← McpPage (hero + cards + 4 sections) + ExampleTabs + content.ts (7 tests)
  routes/
    _index.tsx                       ← Directory loader (auto-pinned filter=type:rfc, default sort updated_desc) + view
    $type.$id.tsx                    ← DocPage loader + DocPage shell wiring DocumentView + sidebar + TOC
    search.tsx                       ← Search no-JS fallback (Form GET + result list with snippet HTML)
    search.module.css                ← subset of SearchModal styles
    mcp.tsx                          ← /mcp route (loader-less) — composes <McpPage>
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

Phase 0 / 1 / 2 / 3 / 4a are closed. Phase 4b (`/api` shell, parsing `api/openapi.yaml`) is the final IMPL-0005 slice — see [IMPL-0005 §Phase 4b](docs/impl/0005-execute-the-rfc-site-rebuild-per-design-0003.md).
