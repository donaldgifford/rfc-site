---
id: DESIGN-0003
title: "Rebuild rfc-site against the mockup"
status: Draft
author: Donald Gifford
created: 2026-05-15
---
<!-- markdownlint-disable-file MD025 MD041 -->

# DESIGN 0003: Rebuild rfc-site against the mockup

**Status:** Draft
**Author:** Donald Gifford
**Date:** 2026-05-15

<!--toc:start-->
- [Overview](#overview)
- [Goals and Non-Goals](#goals-and-non-goals)
  - [Goals](#goals)
  - [Non-Goals](#non-goals)
- [Background](#background)
- [Detailed Design](#detailed-design)
  - [Stack constraints](#stack-constraints)
  - [What gets deleted (Phase 0 "the wipe")](#what-gets-deleted-phase-0-the-wipe)
  - [What stays](#what-stays)
  - [Tokens & CSS strategy](#tokens--css-strategy)
  - [Theme strategy](#theme-strategy)
  - [Component organisation](#component-organisation)
- [API / Interface Changes](#api--interface-changes)
  - [Route surface (unchanged shape, JSX rebuilt)](#route-surface-unchanged-shape-jsx-rebuilt)
  - [Query-param surface (unchanged)](#query-param-surface-unchanged)
  - [Data contracts (unchanged)](#data-contracts-unchanged)
- [Data Model](#data-model)
- [Testing Strategy](#testing-strategy)
  - [Survives Phase 0](#survives-phase-0)
  - [Deleted in Phase 0](#deleted-in-phase-0)
  - [Written per rebuild phase](#written-per-rebuild-phase)
  - [CI gates (unchanged)](#ci-gates-unchanged)
- [Migration / Rollout Plan](#migration--rollout-plan)
  - [Phase 0 — the wipe (1 PR)](#phase-0--the-wipe-1-pr)
  - [Phase 1 — mockup tokens + Topbar + Directory (1 PR)](#phase-1--mockup-tokens--topbar--directory-1-pr)
  - [Phase 2 — RFC page (1 PR)](#phase-2--rfc-page-1-pr)
  - [Phase 3 — SearchModal + /search (1 PR)](#phase-3--searchmodal--search-1-pr)
  - [Phase 4 — /mcp + /api view shells (2 PRs, sequenced)](#phase-4--mcp--api-view-shells-2-prs-sequenced)
    - [Phase 4a — /mcp (1 PR)](#phase-4a--mcp-1-pr)
    - [Phase 4b — /api (1 PR)](#phase-4b--api-1-pr)
    - [/frameworks — deferred](#frameworks--deferred)
- [Open Questions](#open-questions)
- [References](#references)
<!--toc:end-->

## Overview

Implements [RFC-0001](../rfc/0001-defer-the-design-system-promotion-model-and-iterate-rfc-site.md). One-time hard cut: delete every UI-layer artefact in `rfc-site` that depends on `@donaldgifford/design-system`, then rebuild views in 5 phases directly against `donaldgifford/design-system/rfc-portal-mockup_15.html` as the visual spec. The data plane (rfc-api + orval client + markdown pipeline + RR7 loaders) survives the cut.

## Goals and Non-Goals

### Goals

- **Minimum tooling stack.** React Router v7 (framework mode), orval OpenAPI sync + generator, Bun, justfile, Vitest. Nothing else is mandatory.
- **Fastest path to a working frontend.** Phases sized for incremental shipping; each phase produces at least one rendered view that matches the mockup.
- **No code reuse from the deferred design-system.** No vendoring, no copying. Mockup HTML/CSS is the only visual source.
- **Test infrastructure preserved.** API + markdown tests survive Phase 0; new component tests get written per rebuild phase.

### Non-Goals

- Vendoring design-system primitives (rejected by RFC-0001 §Alternatives B).
- Adopting a third-party design system (banned by CLAUDE.md Hard rules; rejected by RFC-0001 §Alternatives C).
- Re-litigating ADR-0001 (OpenAPI contract) or ADR-0002 (frontend stack) — both unchanged.
- Resurrecting the `@donaldgifford/design-system` package or shipping a 0.5.0. Frozen at 0.4.0.
- Resolving the `/frameworks` data-plane question — deferred until a separate decision.

## Background

- [RFC-0001](../rfc/0001-defer-the-design-system-promotion-model-and-iterate-rfc-site.md) is the decision; this DESIGN is the implementation detail.
- [INV-0003](../investigation/0003-inventory-remaining-portal-mockup-work-by-view.md) is the audit that motivated the pivot. Its tagged §Findings drive each rebuild phase's scope.
- [DESIGN-0001](0001-portal-architecture-and-ds-candidates-promotion-model.md) (ds-candidates promotion model) is superseded.
- The published `@donaldgifford/design-system` is frozen at 0.4.0 (0.4.0-pre is unreleased and ignored).

## Detailed Design

### Stack constraints

Per RFC-0001 §Proposed Solution + the explicit minimum-stack requirement:

- **React Router v7** in framework mode (per ADR-0002). Routes discovered via `@react-router/fs-routes` from `src/routes.ts`. SSR enabled. Served by `react-router-serve`.
- **orval** generating from `api/openapi.yaml` in `tags-split` mode at `src/portal/api/__generated__/`. `scripts/gen-api-check.sh` as the CI drift signal (per ADR-0001).
- **Bun** for runtime + package management.
- **justfile** for the task runner.
- **Vitest** + jsdom + Testing Library for tests.

Allowed-as-orval-byproducts (not independent choices):

- **TanStack Query** — orval emits TanStack-Query-flavoured hooks. Consume them; don't reach for a different client.
- **MSW** — orval emits handlers; reuse for `just dev-msw` + the integration-test layer.

Off-limits without a future RFC:

- Any new external component library (Radix Themes, shadcn/ui, MUI, Chakra, etc.).
- The `@donaldgifford/design-system` package.
- A custom design-system in any new repo.

### What gets deleted (Phase 0 "the wipe")

**Component layer:**

- `src/components/ds-candidates/` — entire directory (Card / Tabs / CodeBlock / Breadcrumb).
- `src/components/portal/` — entire directory (Topbar / DirectoryTable / DirectoryToolbar / DocSidebar / RFCPreviewCard / SearchModal / RouteErrorBoundary / Skeleton / ThemeToggle / DocCard).

Even portal components that don't directly import the design-system are deleted: they're styled against design-system tokens, the styles would be load-bearing-wrong post-cut, and the user wants a clean reset.

**Dependency surface:**

- `@donaldgifford/design-system` from `package.json`.
- `bunfig.toml` (entire file — GitHub Packages auth was its only role).
- `NPM_TOKEN` requirement for `bun install` falls out.

**Style / theme imports:**

- `import "@donaldgifford/design-system/tokens.css"` from `src/root.tsx`.
- `import "@donaldgifford/design-system/styles.css"` from `src/root.tsx`.
- `useTheme` from `@donaldgifford/design-system/theme`.

Mockup is dark-only. Drop the light theme entirely; hard-code `<html data-theme="dark">` on the root layout.

**Tests:**

- All component-level test files (those that import the deleted components). Routes' loader tests stay; route-render tests get rewritten alongside the new view JSX.

**Tooling:**

- `just ds-build` / `just ds-link` / `just ds-unlink` recipes from `justfile`.
- CLAUDE.md sections describing the design-system promotion model — rewritten for the new model.
- `inv-0003-followups.local.md` items F-3 / F-4 / F-5 / F-6 — scrapped; F-1 subsumed by Phase 0 + 1; F-2 (rfc-api RFC) and F-9 (/frameworks data plane) survive.

**Routes — stub, don't delete:**

- `src/routes/_index.tsx`, `src/routes/$type.$id.tsx`, `src/routes/search.tsx` — keep loaders + error boundaries + types + meta + HydrateFallback exports intact. Stub JSX bodies to minimal "view under construction" markup so the build passes and the loader logic still runs.

### What stays

- `src/portal/api/` — config / fetcher / queryClient / errors / pagination / docId helpers / MSW dev mode + handlers / orval-generated client config. Verify nothing imports design-system; expected clean.
- `src/portal/markdown/` — DocumentView / Snippet / pipeline / plugins / components (Anchor / Pre / MermaidBlock). Verify `<Pre>` doesn't reference the deleted `<CodeBlock>` ds-candidate; redirect or stub if it does.
- `src/routes/` — loaders + error boundary wiring + types + meta. JSX bodies stubbed in Phase 0; rebuilt per-view in Phases 1-4.
- `src/root.tsx` — Layout (sans the design-system style imports) + App (QueryClientProvider) + HydrateFallback.
- `tests/setup.ts`, `tests/utils/*`, MSW server + fixtures, API tests + markdown tests.
- `api/openapi.yaml`, `orval.config.ts`, `scripts/gen-api-check.sh`.
- All RR7 / Vite / Bun / TypeScript / vitest config (`react-router.config.ts`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `package.json` minus the design-system dep).
- `mise.toml`, `justfile` (minus the `ds-*` recipes), `.docz.yaml`, the docz docs directory tree.

### Tokens & CSS strategy

The mockup is the visual spec. Phase 1 extracts the mockup's `:root { --... }` token block from `rfc-portal-mockup_15.html` into `src/styles/tokens.css`. The mockup is **external** (a separate artefact in `donaldgifford/design-system`), not prior rfc-site work, so consuming its tokens is consuming the spec, not "copying what we did".

Per-view CSS gets extracted into per-component CSS modules as components are built in Phases 1-N. The mockup's CSS organisation already maps cleanly to component boundaries — see the per-view CSS-section pointers in §Migration / Rollout Plan.

### Theme strategy

Mockup is dark-only. Decisions:

- `src/root.tsx` hard-codes `<html data-theme="dark">` in the Layout component.
- No `useTheme` hook. No `<ThemeToggle>` component.
- The CLAUDE.md Hard rule against rolling our own theme switcher was design-system policy; with the design-system gone, the rule's context goes too. If a light-theme toggle is wanted later, build a small one against the local tokens.

### Component organisation

Flat `src/components/<View>/`. No `portal/` subfolder. No `ds-candidates/` subfolder. One folder per view; co-located CSS modules + tests. Examples:

- `src/components/Topbar/Topbar.tsx` + `Topbar.module.css` + `Topbar.test.tsx`
- `src/components/Directory/DirectoryHero.tsx` + `.module.css` + `.test.tsx`
- `src/components/Directory/DirectoryToolbar.tsx` + …
- `src/components/DocPage/DocSidebar.tsx` + …
- `src/components/DocPage/TableOfContents.tsx` + …
- `src/components/SearchModal/SearchModal.tsx` + …

If a primitive ends up shared between views during rebuild (e.g. a `<Kbd>` chip used in both Topbar and SearchModal), co-locate it with its first consumer and import. No "shared primitives" folder until a third consumer appears, then promote into `src/components/_shared/` or similar. Per CLAUDE.md: "Three similar lines is better than a premature abstraction."

## API / Interface Changes

### Route surface (unchanged shape, JSX rebuilt)

| Route | Loader | Loader status after Phase 0 | JSX status |
|-------|--------|----------------------------|------------|
| `/` | `listDocs({ filter: ["type:rfc"], sort, cursor })` | Unchanged | Stubbed Phase 0; rebuilt Phase 1 |
| `/$type/$id` | `getDoc(params.type, params.id)` | Unchanged | Stubbed Phase 0; rebuilt Phase 2 |
| `/search` | `searchDocs({ q, limit })` | Unchanged | Stubbed Phase 0; rebuilt Phase 3 |
| `/mcp` | _(no loader)_ | n/a | New in Phase 4a |
| `/api` | _(loads `api/openapi.yaml`)_ | n/a | New in Phase 4b |
| `/frameworks` | _(deferred)_ | n/a | Deferred |

### Query-param surface (unchanged)

- `?cursor=<opaque>` — pagination cursor.
- `?filter=type:<id>` — narrowed to `type:rfc` only post-rebuild.
- `?sort=<enum>` — RR7 query param.
- `?q=<string>` — `/search` query.
- `?modal=1` — `<SearchModal>` URL-state mirror.

### Data contracts (unchanged)

All Document / SearchResult / problem+json shapes per `api/openapi.yaml`. Orval-generated. Drift = CI failure.

## Data Model

No schema changes. The rfc-api contract is unchanged. The portal consumes `Document` + `SearchResult` + `Problem` envelopes via the orval-generated client.

## Testing Strategy

### Survives Phase 0

- `tests/api/getDoc.test.tsx` — hook + MSW smoke test.
- `tests/api/docPage.test.ts` — loader-only test (200 / 404 / 500).
- `tests/api/indexRoute.test.ts` — loader-only test (cursors / Link header / filter / sort).
- `tests/api/searchRoute.test.ts` — loader-only test.
- `tests/api/msw/fixtures.test.ts` + `tests/api/msw/handlers.test.ts` — MSW infra.
- `tests/portal/markdown/*` — pipeline + sanitize + Snippet + plugin tests.

### Deleted in Phase 0

- `tests/api/docPageRender.test.tsx`, `tests/api/indexRouteRender.test.tsx`, `tests/api/searchRouteRender.test.tsx` — full-render tests against deleted components.
- All `src/components/portal/**/*.test.tsx` files.
- All `src/components/ds-candidates/**/*.test.tsx` files.

### Written per rebuild phase

- Each rebuild PR adds component tests for the new components it ships + route-render tests for the rebuilt view.
- Convention: co-locate `<Component>.test.tsx` next to `<Component>.tsx`.

### CI gates (unchanged)

- `bun run typecheck` — TS strict checks.
- `bun run lint` — ESLint flat config.
- `bun run format-check` — Prettier.
- `bun test` — vitest suite.
- `bun run build` — Vite production build.
- `just gen-api-check` — orval drift check against `api/openapi.yaml`.

Composite recipe `just check` runs all of the above (per CLAUDE.md §Task runner).

## Migration / Rollout Plan

### Phase 0 — the wipe (1 PR)

**Goal:** build passes, tests pass (smaller suite), nothing renders meaningfully yet.

Tasks:

- Delete `src/components/ds-candidates/`, `src/components/portal/` (entire directories).
- Delete component-level test files.
- Remove `@donaldgifford/design-system` from `package.json`. Run `bun install` to update lockfile.
- Delete `bunfig.toml`.
- Delete `just ds-build` / `just ds-link` / `just ds-unlink` recipes from `justfile`.
- Strip design-system imports from `src/root.tsx`. Hard-code `<html data-theme="dark">`. Add empty `src/styles/tokens.css` import.
- Stub `src/routes/_index.tsx`, `$type.$id.tsx`, `search.tsx` JSX bodies. Keep loaders / error boundaries / types / meta / HydrateFallback intact.
- Rewrite CLAUDE.md sections describing the deleted scaffold.
- Verify `bun run build` + `bun test` + `just check` pass.
- One PR. Lands before any rebuild starts.

### Phase 1 — mockup tokens + Topbar + Directory (1 PR)

**Goal:** `/` renders against the mockup. Topbar renders on every route.

Tasks:

- Extract mockup `:root { --... }` block (mockup §1-140 approximately) into `src/styles/tokens.css`. Wire into `src/root.tsx`.
- Build `src/components/Topbar/`: extract Topbar CSS (mockup §142-257). 3-element brand composite (`[R-square] rfcs / portal`), glass surface (`backdrop-filter: blur(12px)` + `rgba(11,14,13,0.85)`), fixed 56px height, grid `260px 1fr auto`, mono-12 nav, avatar chip slot (empty until auth).
- Build `src/components/Directory/`: extract Directory CSS (mockup §268-639). Components: `<DirectoryHero>` (eyebrow `/ docs / rfcs` + serif "Request for Comments"), `<LiveFilter>` (`/`-keystroke focus), `<DirectoryToolbar>` (icon-only filter trigger + cascading filter menu + segmented sort toggle), `<DirectoryTable>` (5-col grid: `80px 1fr 100px 220px 100px`), `<RfcRow>`.
- Wire to existing `_index.tsx` loader; pin `?filter=type:rfc` per RFC-0001 §Proposed Solution (RFC-only scope).
- Component tests for each new component; route-render test for `/`.

### Phase 2 — RFC page (1 PR)

**Goal:** `/$type/$id` renders against the mockup. Markdown pipeline integration verified.

Tasks:

- Extract RFC-page CSS (mockup §641-1248) into per-component modules.
- Build `src/components/DocPage/`:
  - `<DocPage>` (3-col layout: 240px metadata-left + minmax(0,1fr) prose + 240px TOC-right, max-width 1400px, gap 56px).
  - `<DocSidebar>` (metadata, LEFT column): chrome-less `.sidebar-section` blocks for Metadata (Status / Author / Created / Updated / Revision / PR) + Labels.
  - `<TableOfContents>` (right column): sticky `top: 88px`, scroll-spy `.current`, `.nested` h3-under-h2 indent.
  - `<NumberLine>` eyebrow + serif `h1` (42px / 400) + `<HeaderMeta>` (mono 12px tertiary, `·` dividers).
  - `<ReferencesFooter>` consuming `Document.links[]`; "Referenced by" empty-state for now.
- Build `<Callout>` + companion `remark-github-alerts` plugin in `src/portal/markdown/plugins/` — lifts GFM `> [!NOTE]` syntax into `<Callout>` markup.
- Apply prose visual deltas in `src/portal/markdown/styles.css`: h2 serif 26px / 500 + mono `#` hash hover prefix, `p` color `--fg-secondary`, language-badge chip on `pre[data-lang]`, blockquote raised-bg + serif quote glyph, table th mono-uppercase, mermaid caption sub-element.
- Wire `$type.$id.tsx` loader: derive `revision` from `source.commit` (first 7 chars); reformat `Discussion` as `PR: #412` using `discussion.url`'s trailing path segment.
- Component tests + route-render test.

### Phase 3 — SearchModal + /search (1 PR)

**Goal:** `⌘K` opens the search modal matching the mockup. `/search` works as a no-JS fallback.

Tasks:

- Extract Search CSS (mockup §1250-1490) into `src/components/SearchModal/`.
- Build `<SearchModal>` fresh: 780px width, top-anchored (`padding-top: 96px`), no header chrome (the input row IS the header), content-scope filter pills (`all / titles / body / authors / labels`), grouped results by content kind, 320px / 1fr two-pane scrolling, serif-titled preview pane, keyboard-nav hints (`↑↓ ↵ tab`), `meilisearch ● 12ms` latency footer (computed client-side).
- Rebuild `/search` route as the no-JS fallback (degraded surface — no preview pane, no keyboard nav).
- Wire to `searchDocs`; ship with `?type=rfc` pinned narrowing as the v1 (content-scope facets depend on rfc-api extensions; not blocking).
- Component tests + route-render test.

### Phase 4 — `/mcp` + `/api` view shells (2 PRs, sequenced)

#### Phase 4a — `/mcp` (1 PR)

**Goal:** `/mcp` route renders. Content is portal-local.

Tasks:

- Extract MCP CSS (mockup §1904-2165) into `src/components/McpPage/`.
- Build `<McpHero>` + `<McpCards>` (2-col `<McpCard>` blocks) + four numbered `<McpSection>` steps + `<DownloadGrid>` (4 `<DownloadItem>` per-platform rows) + `<ExampleTabs>` (build fresh; do not adopt the deleted `<Tabs>` ds-candidate).
- Content is portal-local (server name `rfcs-mcp`, version, config snippets per client) — no upstream dependency. Placeholder download URLs until the `rfcs-mcp` repo exists.
- Component tests + route-render test.

#### Phase 4b — `/api` (1 PR)

**Goal:** `/api` route renders. Reads from `api/openapi.yaml`.

Tasks:

- Extract API CSS (mockup §1535-1900) into `src/components/ApiPage/`.
- Build `<ApiLayout>` (3-col: sidebar + content). Parse vendored `api/openapi.yaml` client-side; emit portal-native renderer matching the mockup chrome 1:1 (avoid Redoc — CSS-override pain not worth it).
- Components: `<ApiSidebar>` grouped by OpenAPI `tag` if present; `<MethodChip>` for GET/POST/PUT/PATCH/DELETE; `<EndpointHeader>` with eyebrow + serif h1 + `<PathLine>` + copy button; `<TryItBand>` (visual chrome only, defer live-execution); `<ParamSection>` / `<ResponseSection>` tables; `<ExampleTabs>` + `<ExampleCode>` (reuse from `/mcp` if shared).
- Source of truth: `api/openapi.yaml` paths, NOT the mockup paths (which predate the rfc-api type-split per DESIGN-0002 in `rfc-api`).
- Component tests + route-render test.

#### `/frameworks` — deferred

Data plane is unresolved (no `framework` source in `rfc-api`). Don't ship until the data-plane decision lands.

## Open Questions

- **MSW fixture corpus narrowing.** INV-0003 raised this; not blocking. The current 8-fixture set across 6 types still works for loader + API tests. RFC-only narrowing can land in any rebuild PR.
- **`<Pre>` references `<CodeBlock>`?** Verify during Phase 0 whether `src/portal/markdown/components/` imports the deleted ds-candidate `<CodeBlock>`. If yes, redirect to a portal-local inline alternative (e.g. plain `<pre>` over Shiki-rendered children).
- **Avatar chip in Topbar.** Mockup uses a 28×28 `linear-gradient(accent → accent-dim)` chip with initials. No auth surface in portal yet. Recommend ship Phase 1 with the chip slot present but empty (or a static placeholder) so the layout doesn't shift when auth lands.
- **Yank the published `@donaldgifford/design-system` package?** Recommend no — frozen at 0.4.0, not consumed, leaves resurrection path open.
- **`useTheme` decision (dark-only hard-code) blocking later?** No. A toggle can be added later without API surface changes.

## References

- [RFC-0001 — Defer the design-system promotion model and iterate rfc-site against the mockup](../rfc/0001-defer-the-design-system-promotion-model-and-iterate-rfc-site.md) — the decision this DESIGN implements
- [INV-0003 — Inventory remaining portal-mockup work by view](../investigation/0003-inventory-remaining-portal-mockup-work-by-view.md) — the audit that motivated RFC-0001
- [DESIGN-0001 — Portal architecture and ds-candidates promotion model](0001-portal-architecture-and-ds-candidates-promotion-model.md) — superseded by RFC-0001 + this DESIGN
- [DESIGN-0002 — Markdown rendering pipeline](0002-markdown-rendering-pipeline.md) — still load-bearing; the pipeline survives Phase 0
- [ADR-0001 — Consume rfc-api via its OpenAPI contract](../adr/0001-consume-rfc-api-via-its-published-openapi-contract.md) — still load-bearing; unchanged
- [ADR-0002 — Adopt portal frontend stack](../adr/0002-adopt-portal-frontend-stack.md) — still load-bearing; this DESIGN keeps the stack
- Mockup: `donaldgifford/design-system/rfc-portal-mockup_15.html` — the visual contract
- [IMPL-0001](../impl/0001-bootstrap-portal-scaffold-per-design-0001.md), [IMPL-0002](../impl/0002-wire-up-apimodemsw-local-dev-mode.md), [IMPL-0003](../impl/0003-wire-up-the-markdown-rendering-pipeline-per-design-0002.md), [IMPL-0004](../impl/0004-build-rfc-portal-components-per-inv-0002-inventory.md) — implementation history; preserved in git, not actively maintained
