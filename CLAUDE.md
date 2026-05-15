# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo state

[RFC-0001](docs/rfc/0001-defer-the-design-system-promotion-model-and-iterate-rfc-site.md) defers `@donaldgifford/design-system` and rebuilds the portal directly against `donaldgifford/design-system/rfc-portal-mockup_15.html` as the visual spec. [DESIGN-0003](docs/design/0003-rebuild-rfc-site-against-the-mockup.md) is the plan; [IMPL-0005](docs/impl/0005-execute-the-rfc-site-rebuild-per-design-0003.md) is the 6-phase tracker.

**Phase 0 (the wipe) shipped.** The design-system surface is gone: `src/components/portal/` and `src/components/ds-candidates/` deleted, `@donaldgifford/design-system` + `@radix-ui/react-slot` removed from `package.json`, `bunfig.toml` deleted, `bun.lock` refreshed. The CI workflow no longer reads from GitHub Packages. `src/root.tsx` imports `./styles/tokens.css` (empty placeholder for Phase 1) and renders `<Outlet />` with no Topbar. The three routes (`/`, `/$type/$id`, `/search`) keep their loaders + types + meta + HydrateFallback and ship "under construction" stub JSX. Loaders are untouched — the API contract integration is intact. `<MermaidBlock>` hard-codes `theme: "dark"` (the portal is dark-only per RFC-0001).

What's wired post-Phase 0:

- **React 19 + React Router v7** (framework mode, `appDirectory: "src"`, `ssr: true`). Production: `@react-router/serve`.
- **API client at `src/portal/api/`** — orval-generated client from `api/openapi.yaml`, custom `fetch` mutator, RFC 7807 problem envelope (`errors.ts`), RFC 5988 `Link` parser (`pagination.ts`), `docId.ts` helpers (URL form vs canonical form), `msw/` for `API_MODE=msw` dev mode + shared test handlers.
- **Markdown pipeline at `src/portal/markdown/`** — `DocumentView` (`MarkdownHooks` + `<Suspense>` for async Shiki), `Snippet` (search-result HTML), unified plugin chain: remark-gfm → strip-docz-boilerplate → rehype-slug → rehype-autolink-headings → mermaid-marker → @shikijs/rehype → normalize-hast-properties → rehype-sanitize. Custom plugins survive intact.
- **TanStack Query** in `src/root.tsx` (`QueryClientProvider` + `useState(createQueryClient)` for SSR isolation). Kept as an orval byproduct, not an independent choice.
- **Routes**: `_index.tsx` (Directory loader: `listDocs` + filter/sort + cursor + count headers, stub JSX), `$type.$id.tsx` (DocPage loader: `getDoc` + `<DocumentView>`, stub chrome), `search.tsx` (Search loader: `searchDocs` short-circuits on empty `q`, stub form + result list).
- **Tests**: loader-level (`indexRoute`, `docPage`, `searchRoute`), MSW handler integration (`api/getDoc`, `api/msw/handlers`, `api/msw/fixtures`), markdown pipeline (`portal/markdown/**`). The 3 full-render route tests (`docPageRender`, `indexRouteRender`, `searchRouteRender`) and all 13 component test files are gone — they exercised the deleted JSX trees.

What's next (per IMPL-0005):

- **Phase 1** — populate `src/styles/tokens.css` from the mockup's `:root {--…}` block; build `src/components/Topbar/`; build `src/components/Directory/` (DirectoryHero, DirectoryToolbar, DirectoryTable, StatusBadge, LiveFilter). `/` renders against the mockup with `?filter=type:rfc` pinned for the RFC-only scope.
- **Phase 2** — RFC page 3-col layout, `<DocSidebar>`, `<TableOfContents>`, serif h1 (42px/400), `<ReferencesFooter>`, `<Callout>` admonitions, prose visual deltas.
- **Phase 3** — SearchModal (780px top-anchored, content-scope filter pills, two-pane scrolling, focus trap). `/search` route as no-JS fallback.
- **Phase 4a / 4b** — `/mcp` shell + `/api` shell. `/api` parses the vendored `api/openapi.yaml` client-side.

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

## Repo layout (current — post-Phase 0)

```
api/
  openapi.yaml                       ← vendored from rfc-api; sync mechanism TBD
  README.md
docs/
  adr/                               ← ADR-0001 (API contract) + ADR-0002 (stack) — both load-bearing
  design/                            ← DESIGN-0002 (Markdown pipeline) + DESIGN-0003 (rebuild plan)
  impl/                              ← IMPL-0001..0004 closed; IMPL-0005 in flight (Phase 0 done)
  rfc/                               ← RFC-0001 (the decision)
  investigation/                     ← INV-0001 / 0002 / 0003 — historical context
  integration/                       ← rfc-api cookbook
  archive/                           ← frozen historical source material
src/
  root.tsx                           ← Layout + App + QueryClientProvider; data-theme="dark"; no Topbar yet
  routes.ts                          ← flatRoutes() with ignoredRouteFiles
  entry.client.tsx                   ← MSW worker boot when VITE_API_MODE=msw
  env.d.ts
  styles/
    tokens.css                       ← Phase 0 empty placeholder; Phase 1 populates from mockup :root
  components/                        ← created in Phase 1; flat <View>/ layout
  routes/
    _index.tsx                       ← Directory loader + stub JSX
    $type.$id.tsx                    ← DocPage loader + <DocumentView> stub
    search.tsx                       ← Search loader + stub form
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
    pipeline.ts                      ← remarkPlugins / rehypePlugins arrays + sanitize schema
    DocumentView.tsx                 ← MarkdownHooks + Suspense + LinksContext
    Snippet.tsx                      ← search-result HTML renderer
    styles.css                       ← prose styling (tokens only)
    plugins/                         ← strip-docz-boilerplate / mermaid-marker / normalize-hast-properties
    components/                      ← Anchor / Pre / MermaidBlock (theme hard-coded dark)
  pages/                             ← (empty; reserve for page-specific composites)
tests/
  setup.ts                           ← jest-dom matchers + RTL afterEach(cleanup)
  api/                               ← loader tests + MSW handlers + fixtures
  portal/markdown/                   ← pipeline + sanitize + Snippet + plugins + components
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

Phase 0 is closed. Phase 1 (mockup tokens + Topbar + Directory) is the next IMPL-0005 slice — see [IMPL-0005 §Phase 1](docs/impl/0005-execute-the-rfc-site-rebuild-per-design-0003.md).
