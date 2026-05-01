# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo state

All 6 phases of [IMPL-0001](docs/impl/0001-bootstrap-portal-scaffold-per-design-0001.md) shipped. The portal SSR-renders a card-grid directory at `/` and a doc detail page at `/$type/$id`, both backed by the orval-generated rfc-api client through RR7 route loaders. Problem+JSON errors propagate through a shared `<RouteErrorBoundary>` that renders a not-found surface for `ErrNotFound` and a generic surface (with `request_id`) for everything else. `<Badge>` was promoted to `@donaldgifford/design-system@0.2.0` in Phase 6 and is now consumed as a published primitive. Phases 1-7 of [IMPL-0002](docs/impl/0002-wire-up-apimodemsw-local-dev-mode.md) shipped: `just dev-msw` boots the portal against a hand-curated fixture corpus with no `rfc-api` / Postgres / GitHub-webhook dependency. `curl` smoke verified (`/` returns 200 with all 8 fixtures + `ds-badge` markup, `/rfc/0001` returns 200 with fixture title/body/authors, `/rfc/9999` returns 404 with the portal not-found surface and a 7807 `request_id`). Production build is MSW-clean except the static worker file. Live-rfc-api smoke verified end-to-end with a seeded `documents` row (commit `f8883c7` fixed a doc-page URL contract bug — see Hard rules).

What's wired:

- React 19 + React Router v7 (framework mode) + Vite, served by `react-router-serve`.
- `src/root.tsx`: Layout (sets `<html data-theme="dark">`) + App (wraps `<Outlet />` in `<QueryClientProvider>` with `useState(createQueryClient)` for SSR isolation).
- Routes: `src/routes/_index.tsx` (directory card grid + Link-header pagination via `?cursor=`); `src/routes/$type.$id.tsx` (doc page with title h1, `<StatusPill>`, dateline, authors, `<pre>` body). Both wire `RouteErrorBoundary` as their `ErrorBoundary` export.
- Design-system consumed via `bun link` against the local `../design-system` checkout (CLAUDE.md §When iterating in parallel) — `package.json` declares it as `link:@donaldgifford/design-system`. Flip back to `0.1.0` once `NPM_TOKEN` (read:packages) is available.
- Portal components: `<ThemeToggle>` (Phase 2), `<DocCard>` (Phase 4), `<RouteErrorBoundary>` (Phase 4), `<Skeleton>` (Phase 4 polish — shimmer placeholder backing the route-level `HydrateFallback` exports; honours `prefers-reduced-motion`). `<StatusPill>` was inline in Phase 4 and superseded by the Phase 5 `<Badge>` candidate (deleted from portal/).
- `<Badge>` is now consumed from `@donaldgifford/design-system` (promoted in Phase 6, published as `0.2.0`). Import sites: `src/components/portal/DocCard/DocCard.tsx`, `src/routes/$type.$id.tsx`. The primitive's CSS is loaded via the `@donaldgifford/design-system/styles.css` sub-path import in `src/root.tsx` — one import covers all current and future primitives. Prefixed-global-class shape is documented in [INV-0001](docs/investigation/0001-ship-css-modules-from-design-system-tsup-build.md).
- API client at `src/portal/api/`: `config.ts` (RFC_API_URL reader), `fetcher.ts` (custom orval mutator over `fetch`), `queryClient.ts` (TanStack defaults: 5min staleTime, no refetchOnWindowFocus, retry 1), `errors.ts` (`throwIfProblem` + `classifyProblem` for the 7807 envelope), `pagination.ts` (RFC 5988 `Link` header parser), `__generated__/` (orval output, gitignored).
- vitest configured with `resolve.dedupe: ["react", "react-dom"]` and an RTL `cleanup` afterEach hook in `tests/setup.ts`. MSW (`msw/node`) wires the **shared fixture-backed handlers** from `src/portal/api/msw/handlers.ts` (IMPL-0002 Phase 3-4) — the same handlers that serve `API_MODE=msw` dev mode also back the integration tests. Per-test overrides go through `server.use(...)` directly, or `mockProblem(urlPattern, status, body)` for explicit error-path injection.
- Tests: `getDoc` hook+MSW (Phase 3); `$type.$id` loader (200, 404, 500 paths) + full-render via `createRoutesStub` (renders title/Badge/body/authors, 404 + 500 surfaces); `_index` loader (cursors, Link header, query forwarding) + full-render (cards, pagination links, empty state); `<RouteErrorBoundary>` (404 + 500 rendering); `<ThemeToggle>` (Phase 2); fixture-loader cache + parsing (10 tests, IMPL-0002 Phase 2); MSW handlers (getDoc, listDocsByType, paginated /docs round-trip, search — 9 tests, IMPL-0002 Phase 3). **36 tests across 9 files.** (The 9-test `<Badge>` suite migrated to design-system at `tests/primitives/Badge.test.tsx` in Phase 6.)
- CI: `.github/workflows/ci.yml` runs `bun install --frozen-lockfile` (using `secrets.GITHUB_TOKEN` for GitHub Packages), the orval drift check (`scripts/gen-api-check.sh`), and the full static-check + build pipeline.

What's pending manual verification:

- The "live rfc-api" Phase 4 success criteria — running `rfc-api` locally and confirming `bun run dev` shows real data, the 404 path renders for `/rfc/9999`, etc. The loop's environment doesn't have rfc-api running; MSW-backed tests cover the contract against a fixture surface.

What's not wired yet:

- _(none — IMPL-0001 + IMPL-0002 are complete. `feat/api-mode-msw` merged into `feat/design-0001` (`0cb9c60`); `feat/design-0001` pushed to origin and PR #2's body refreshed to cover both IMPLs and check off the now-runnable MSW smoke items. Awaiting CI + review.)_

What IMPL-0002 added (`just dev-msw`):

- Hand-curated fixture corpus at `tests/examples/docs/<type>/*.md` — 8 fixtures across `rfc/adr/design/impl/plan/inv` types, frontmatter validated against the `Document` schema (`^[A-Z]+-[0-9]+$` ID pattern enforced).
- Async fixture loader at `src/portal/api/msw/fixtures.ts` — branches on `typeof window` so the SSR side reads via `await import("node:fs")` and the client side via `import.meta.glob<string>(...)?raw`. Cache is lazy + idempotent.
- MSW handlers at `src/portal/api/msw/{handlers,browser,server}.ts` — real RFC 5988 cursor pagination (opaque base64-int offsets), RFC 7807 problem responses with seeded `faker` request IDs, and listing-vs-fetch route ordering that respects MSW's last-match-wins.
- SSR boot at `src/portal/api/msw/setup.ts` — gated on `import.meta.env.SSR && import.meta.env.DEV && process.env.API_MODE === "msw"`. The two build-time-replaced flags let Vite DCE the entire branch from production artefacts; the runtime check decides per-process whether to start.
- Client boot at `src/entry.client.tsx` — overrides RR7's auto-generated entry to start the MSW worker before `hydrateRoot` when `VITE_API_MODE=msw`. Production / non-MSW dev gets the dynamic import tree-shaken.
- Operator surface: `bun run dev:msw`, `just dev-msw`, `.env.example` with the split-flags rationale, README §Local development without rfc-api, and a `CLAUDE.md §Task runner` pointer.
- Test infra: `tests/api/server.ts` now mounts the same handlers as the dev-mode SSR boot, so the integration suite (36 tests across 9 files) exercises the exact paths the dev server runs. `mockProblem(urlPattern, status, body)` is the only remaining bespoke override helper, kept narrow for explicit error-path tests.

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
- **Markdown rendering:** `react-markdown` + `remark-gfm` + `@shikijs/rehype` + `rehype-sanitize` + `mermaid` (client-side hydration). See [DESIGN-0002](docs/design/0002-markdown-rendering-pipeline.md) for the full plugin chain. Comes after Phase 4 (separate IMPL doc TBD).
- **Language:** TypeScript ^5.7.2 strict, `target: ES2022`, `moduleResolution: bundler`. `tsconfig.json` mirrors the design-system repo verbatim with all extra strictness (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `isolatedModules`, etc.).
- **Lint/format:** ESLint v9 flat config + Prettier — mirror the design-system repo verbatim so promoted candidates pass lint in both repos with no churn. Versions: eslint ^9.17, typescript-eslint ^8.18, eslint-plugin-react ^7.37, react-hooks ^5.1, jsx-a11y ^6.10.
- **Tests:** vitest ^2.1.8 + jsdom ^25.0.1 + `@testing-library/react` ^16.3.2 + `@testing-library/jest-dom` ^6.9.1 + `@testing-library/user-event` ^14.6.1. `tests/setup.ts` extends expect with jest-dom matchers and registers an `afterEach(cleanup)` so screen queries don't leak between tests. Vitest discovers both `tests/**/*.test.{ts,tsx}` and `src/**/*.test.{ts,tsx}` (the latter for colocated `portal/` and `ds-candidate` tests per DESIGN-0001 §Resolved). `vitest.config.ts` sets `resolve.dedupe: ["react", "react-dom"]` so a `bun link`'d design-system consumes rfc-site's React (otherwise jsdom hits the classic two-React `useState` is null crash).

`mise.toml` reconciled: `bun = "latest"` added, `pnpm = "10.33.2"` removed, `node = "22"` kept for tool compat headroom (drop later when every tool is confirmed Bun-native).

GitHub Packages auth is required to install the design system. Commit `bunfig.toml` (resolved — `.npmrc` is not committed); `NPM_TOKEN` must have `read:packages`. When `NPM_TOKEN` isn't set locally, the design-system can be consumed via `bun link` against `../design-system` (`just ds-build` then `just ds-link`); `package.json` declares the dep as `link:@donaldgifford/design-system` so `bun install` resolves it through the local checkout.

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

If a token, hook, or primitive in `@donaldgifford/design-system` needs a change, `bun link` against the local checkout. Critical: after edits in the design-system repo, **run its build** (the portal imports from `dist/`, not source), **add a changeset** (otherwise the change won't ship), and **unlink before final testing** to confirm against a published version.

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
  impl/                              ← IMPL-0001 (bootstrap scaffold) — Phases 1-2 done, 3-6 pending
  integration/                       ← non-docz reference docs (rfc-api cookbook)
  archive/                           ← frozen historical source material
src/
  root.tsx                           ← RR7 framework-mode root (Layout + App + QueryClientProvider)
  routes.ts                          ← flatRoutes() with ignoredRouteFiles
  routes/
    _index.tsx                       ← directory: listDocs card grid + Link-header pagination
    _index.module.css
    $type.$id.tsx                    ← doc page: getDoc loader, title/status/body/dateline
    $type.$id.module.css
    README.md                        ← documents the flat-routes convention
  components/
    portal/
      ThemeToggle/                   ← Phase 2 (test colocated)
      DocCard/                       ← Phase 4 directory card (consumes <Badge>)
      RouteErrorBoundary/            ← Phase 4 7807 → portal error UI (test colocated)
      Skeleton/                      ← Phase 4 polish: shimmer placeholder for HydrateFallback
      README.md                      ← what belongs in portal/
    ds-candidates/
      (empty — `<Badge>` was promoted out in Phase 6)
      README.md                      ← promotion contract reminder
  pages/                             ← (empty; reserve for page-specific composites)
  styles/                            ← (empty; portal-local CSS only — never tokens)
  portal/api/
    config.ts                        ← RFC_API_URL reader (import.meta.env + process.env)
    fetcher.ts                       ← orval custom mutator over fetch
    queryClient.ts                   ← TanStack QueryClient factory (Phase 3 defaults)
    errors.ts                        ← throwIfProblem + classifyProblem (RFC 7807)
    pagination.ts                    ← RFC 5988 Link header parser
    __generated__/                   ← orval output (gitignored — never commit)
tests/
  setup.ts                           ← jest-dom matchers + RTL afterEach(cleanup)
  api/server.ts                      ← shared MSW server + helpers (mockGetDoc, mockListDocs, mockProblem)
  api/getDoc.test.tsx                ← Phase 3 hook+MSW smoke test
  api/docPage.test.ts                ← Phase 4 $type.$id loader (200/404/500)
  api/docPageRender.test.tsx         ← Phase 4 $type.$id full render via createRoutesStub
  api/indexRoute.test.ts             ← Phase 4 _index loader (cursors / Link header / query forwarding)
  api/indexRouteRender.test.tsx      ← Phase 4 _index full render via createRoutesStub
  utils/msw.ts                       ← setupMswLifecycle() — shared MSW beforeAll/afterEach/afterAll
  utils/renderRoute.tsx              ← renderRoute() — createRoutesStub + RTL render in one call
  examples/docs/                     ← IMPL-0002 Phase 1: hand-curated fixture tree for `API_MODE=msw`
    rfc/  adr/  design/  impl/  plan/  inv/  ← one subdir per DocumentType
    README.md                        ← pointer to PLAN-0001 / IMPL-0002
  api/msw/fixtures.test.ts           ← IMPL-0002 Phase 2: loader unit tests (10 tests)
  api/msw/handlers.test.ts           ← IMPL-0002 Phase 3: MSW handler tests incl. pagination round-trip (9 tests)
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

Next impl-level work: TBD. IMPL-0001 closed at Phase 6. The Markdown rendering pipeline (DESIGN-0002) is the natural next IMPL.
