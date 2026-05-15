---
id: IMPL-0005
title: "Execute the rfc-site rebuild per DESIGN-0003"
status: Draft
author: Donald Gifford
created: 2026-05-15
---
<!-- markdownlint-disable-file MD025 MD041 -->

# IMPL 0005: Execute the rfc-site rebuild per DESIGN-0003

**Status:** Draft
**Author:** Donald Gifford
**Date:** 2026-05-15

<!--toc:start-->
- [Objective](#objective)
- [Scope](#scope)
  - [In Scope](#in-scope)
  - [Out of Scope](#out-of-scope)
- [Open Questions](#open-questions)
- [Implementation Phases](#implementation-phases)
  - [Phase 0: The wipe](#phase-0-the-wipe)
    - [Tasks](#tasks)
    - [Success Criteria](#success-criteria)
  - [Phase 1: Mockup tokens + Topbar + Directory](#phase-1-mockup-tokens--topbar--directory)
    - [Tasks](#tasks-1)
    - [Success Criteria](#success-criteria-1)
  - [Phase 2: RFC page](#phase-2-rfc-page)
    - [Tasks](#tasks-2)
    - [Success Criteria](#success-criteria-2)
  - [Phase 3: SearchModal + /search](#phase-3-searchmodal--search)
    - [Tasks](#tasks-3)
    - [Success Criteria](#success-criteria-3)
  - [Phase 4a: /mcp shell](#phase-4a-mcp-shell)
    - [Tasks](#tasks-4)
    - [Success Criteria](#success-criteria-4)
  - [Phase 4b: /api shell](#phase-4b-api-shell)
    - [Tasks](#tasks-5)
    - [Success Criteria](#success-criteria-5)
- [File Changes](#file-changes)
- [Testing Plan](#testing-plan)
- [Dependencies](#dependencies)
- [References](#references)
<!--toc:end-->

## Objective

Execute the hard cut + 5-phase rebuild plan from [DESIGN-0003](../design/0003-rebuild-rfc-site-against-the-mockup.md). One PR per phase. Each phase is shippable on its own; Phase 0 lands first (build stays green with stubs), then Phases 1-4 land in order against the mockup.

**Implements:** [RFC-0001](../rfc/0001-defer-the-design-system-promotion-model-and-iterate-rfc-site.md) + [DESIGN-0003](../design/0003-rebuild-rfc-site-against-the-mockup.md)

## Scope

### In Scope

- Phase 0 — the wipe (delete all design-system-coupled UI surface, stub routes, keep build green).
- Phase 1 — mockup tokens, `<Topbar>`, Directory rebuild.
- Phase 2 — RFC page rebuild (3-col layout, serif h1, TOC sidebar, references footer, admonitions).
- Phase 3 — SearchModal + `/search` rebuild (content-scope filter pills, grouped results, preview pane).
- Phase 4a — `/mcp` view shell.
- Phase 4b — `/api` view shell (OpenAPI renderer over vendored `api/openapi.yaml`).
- Per-view CSS extracted from the mockup HTML into per-component CSS modules.
- Component tests + route-render tests written alongside each rebuild PR.
- CLAUDE.md rewrite to reflect the new model (Phase 0).
- `inv-0003-followups.local.md` annotation (Phase 0).

### Out of Scope

- Any new `@donaldgifford/design-system` primitives. Frozen at 0.4.0 per RFC-0001.
- Promoting anything out of rfc-site. The promotion model is what RFC-0001 defers.
- Re-litigating ADR-0001 (OpenAPI contract) or ADR-0002 (frontend stack).
- `/frameworks` view — data plane unresolved; deferred until a separate decision.
- Light-theme support — mockup is dark-only; future addition if needed.
- Yanking the published `@donaldgifford/design-system` package from GitHub Packages.
- Live-execution for `/api`'s "Try it" affordance — visual chrome only.

## Open Questions

> **All 8 resolved 2026-05-15.** Decisions below are binding for Phase 0. Reopen any of them by editing in place; don't add a parallel "actually" thread.

1. **`useTheme` replacement strategy in `<MermaidBlock>`.** Today `src/portal/markdown/components/MermaidBlock.tsx:2` imports `useTheme` from `@donaldgifford/design-system/theme` and passes the result to mermaid's `theme` option.
   - **Resolved (2026-05-15): hard-code `theme: "dark"`** in MermaidBlock. The portal is dark-only post-cut; no light-theme path to support. The `useTheme` import is deleted in Phase 0.

2. **CLAUDE.md rewrite scope.** Current file is ~500 lines, heavy with design-system / promotion / ds-candidate language.
   - **Resolved (2026-05-15): full rewrite.** ~200 lines target reflecting the mockup-first model. Existing content moves to `CLAUDE.md.pre-rfc-0001.bak` (gitignored) for reference if needed.

3. **CI workflow cleanup.** `.github/workflows/ci.yml` has `NPM_TOKEN: ${{ secrets.GITHUB_TOKEN }}` env + `packages: read` permission, both for GitHub Packages auth. Both become unused after Phase 0.
   - **Resolved (2026-05-15): strip both** in Phase 0. Clean signal that the design-system dep is truly gone.

4. **`Skeleton` + `RouteErrorBoundary` — delete or keep?** Neither imports the design-system directly (only styled against design-system tokens).
   - **Resolved (2026-05-15): delete in Phase 0** for clean-slate strictness. Rebuild fresh in Phase 1 (Skeleton for hydrate-fallbacks; RouteErrorBoundary wraps all routes).

5. **`inv-0003-followups.local.md` — keep gitignored or track?** File is gitignored (per `.gitignore` line 32). Annotations to a gitignored file don't propagate.
   - **Resolved (2026-05-15): leave gitignored.** Tracker was always meant to be Donald's personal notes. Sync state by hand in the local copy.

6. **Phase 1 PR split — Topbar + Directory together or separate?** DESIGN-0003 bundles them. Topbar alone has no rendering target; Directory always renders below Topbar.
   - **Resolved (2026-05-15): keep together** as DESIGN-0003 specifies. Visually-coupled; single PR is the sane scope.

7. **`<DocCard>` is currently dead code** (no live route consumes it per CLAUDE.md). It still lives in `src/components/portal/`.
   - **Resolved (2026-05-15): delete in Phase 0** with the rest. Phase 0 is the wipe; consistency over precision.

8. **Mermaid theme handling under SSR.** Even if we hard-code `theme: "dark"`, mermaid's dynamic-import + `useEffect` hydration pattern needs to keep working.
   - **Resolved (2026-05-15): verify post-rewrite** that the SSR fallback `<pre>` is still emitted and that hydration still swaps to the rendered SVG. Added as an explicit Phase 0 success-criteria item.

## Implementation Phases

Each phase builds on the previous one. A phase is complete when all its tasks are checked off and its success criteria are met. Each phase = one PR.

---

### Phase 0: The wipe

> Goal: delete every design-system-coupled UI surface; stub routes so the build still passes; rewrite CLAUDE.md. Nothing renders meaningfully after Phase 0 except the topbar-less "view under construction" surfaces.

#### Tasks

**Delete component directories:**

- [ ] `rm -rf src/components/ds-candidates/` (Breadcrumb, CodeBlock, Tabs, README)
- [ ] `rm -rf src/components/portal/` (DirectoryTable, DirectoryToolbar, DocCard, DocSidebar, RFCPreviewCard, RouteErrorBoundary, SearchModal, Skeleton, ThemeToggle, Topbar, README)

**Delete component tests** (caught alongside the components but listed explicitly):

- [ ] Delete `src/components/portal/{SearchModal,ThemeToggle,RFCPreviewCard,DirectoryTable,DocSidebar,Topbar,RouteErrorBoundary,DirectoryToolbar}/*.test.tsx`
- [ ] Delete `src/components/ds-candidates/{Tabs,CodeBlock,Breadcrumb}/*.test.tsx`
- [ ] Delete `tests/api/docPageRender.test.tsx`, `tests/api/indexRouteRender.test.tsx`, `tests/api/searchRouteRender.test.tsx`

**Strip dependency surface:**

- [ ] Remove `"@donaldgifford/design-system": "^0.4.0"` from `package.json` (line 60)
- [ ] Delete `bunfig.toml` (only design-system scope config)
- [ ] `bun install` to update `bun.lock`

**Strip imports from src/root.tsx:**

- [ ] Delete `import "@donaldgifford/design-system/tokens.css"` (line 9)
- [ ] Delete `import "@donaldgifford/design-system/styles.css"` (line 10)
- [ ] Delete `import { Topbar } from "./components/portal/Topbar"` (line 12)
- [ ] Delete `<Topbar />` from `App()` (line 39)
- [ ] Add `import "./styles/tokens.css"` (placeholder empty file for Phase 0; populated in Phase 1)
- [ ] Confirm `<html lang="en" data-theme="dark">` already in Layout (line 16 — already correct, no change needed)

**Replace useTheme in MermaidBlock** (per Open Question 1):

- [ ] Strip `import { useTheme } from "@donaldgifford/design-system/theme"` from `src/portal/markdown/components/MermaidBlock.tsx`
- [ ] Hard-code mermaid's `theme: "dark"` (or implement local useTheme — pending Q1 resolution)
- [ ] Verify SSR fallback + client hydration still work end-to-end with the markdown pipeline tests

**Stub route JSX (keep loaders + error boundaries + types):**

- [ ] `src/routes/_index.tsx` — stub JSX to `<main><h1>Directory — under construction</h1></main>`; keep loader / HydrateFallback / ErrorBoundary export
- [ ] `src/routes/$type.$id.tsx` — stub JSX similarly; keep loader / meta / HydrateFallback / ErrorBoundary
- [ ] `src/routes/search.tsx` — stub JSX similarly; keep loader / HydrateFallback / ErrorBoundary
- [ ] **Issue**: each route currently uses the deleted `<RouteErrorBoundary>` as its `ErrorBoundary` export. For Phase 0 stub: define a minimal inline `ErrorBoundary` in each route (5-10 lines, dumps the error to the page) OR temporarily disable the `ErrorBoundary` export. Per Open Question 4 (delete `RouteErrorBoundary` or keep), one option is to keep RouteErrorBoundary and only delete its CSS coupling.

**Strip justfile ds-* recipes:**

- [ ] Delete `ds-build` recipe (`justfile:77`)
- [ ] Delete `ds-link` recipe (`justfile:80`)
- [ ] Delete `ds-unlink` recipe (`justfile:84`)
- [ ] Run `just --list` to confirm no `ds-*` recipes remain

**CI workflow cleanup** (pending Open Question 3):

- [ ] If chosen: strip `NPM_TOKEN: ${{ secrets.GITHUB_TOKEN }}` env from `.github/workflows/ci.yml` Install step
- [ ] If chosen: strip `packages: read` from the workflow's `permissions:` block
- [ ] Confirm `bun install --frozen-lockfile` still succeeds in CI without the GitHub Packages auth

**Comment + reference cleanup:**

- [ ] Update `src/routes/search.module.css:67` comment that references `@donaldgifford/design-system`
- [ ] Search for any other dangling design-system references in code comments

**CLAUDE.md rewrite** (per Open Question 2):

- [ ] If full rewrite chosen: back up current to `.gitignore`d location, write new ~200-line CLAUDE.md reflecting the new model (RR7 + orval + Bun + justfile + vitest; flat `src/components/<View>/`; mockup as visual spec; no design-system)
- [ ] If surgical edits chosen: strip the design-system / promotion-model / ds-candidates sections; rewrite §What's wired to reflect Phase 0 state

**Followups tracker annotation:**

- [ ] Edit `inv-0003-followups.local.md` (gitignored): mark F-3 / F-4 / F-5 / F-6 / F-7 / F-8 as `Status: Superseded by RFC-0001 + IMPL-0005`. Leave F-1 (cleanup — subsumed by Phase 0+1), F-2 (rfc-api RFC — still relevant), F-9 (/frameworks data plane — still deferred) as live items.

**Verification:**

- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes
- [ ] `bun run format:check` passes
- [ ] `bun test` passes (smaller suite — estimated ~95 tests across ~14 files, down from 177/27)
- [ ] `bun run build` succeeds
- [ ] `bun run gen-api:check` passes (orval drift check unchanged)
- [ ] `just check` runs all of the above clean
- [ ] Local `bun run dev` boots the dev server; `/`, `/$type/$id`, `/search` each render the stub message without errors
- [ ] Local `bun run dev:msw` boots with MSW; same routes render with the same stubs

#### Success Criteria

- `bun run build` + `bun test` + `just check` all pass.
- `src/components/ds-candidates/` and `src/components/portal/` directories do not exist.
- `@donaldgifford/design-system` does not appear anywhere in `package.json`, `bun.lock`, or `src/**/*`.
- `bunfig.toml` does not exist.
- `src/root.tsx` has zero `@donaldgifford` imports; `<html data-theme="dark">` is hard-coded.
- All three routes (`/`, `/$type/$id`, `/search`) render their stub markup in `bun run dev`.
- Loader tests still pass against the stubbed routes (loaders are untouched).
- `<MermaidBlock>` renders an SSR `<pre>` fallback and hydrates to an SVG on the client (manual smoke against a fixture with a mermaid block; per Q8 resolution).
- CLAUDE.md reflects the new model.

---

### Phase 1: Mockup tokens + Topbar + Directory

> Goal: `/` renders against the mockup. Topbar appears on every route. Pin `?filter=type:rfc` per the RFC-only scope.

#### Tasks

**Tokens:**

- [ ] Read `rfc-portal-mockup_15.html` `:root { --... }` block (mockup §1-140 approximately)
- [ ] Populate `src/styles/tokens.css` with the extracted tokens
- [ ] Verify `src/root.tsx` imports the new tokens.css

**`<Topbar>` (mockup §142-257):**

- [ ] Create `src/components/Topbar/Topbar.tsx` — 3-element brand composite (`[R-square-with-accent-border] rfcs / portal`), search trigger, nav (mono 12px, `Directory / Frameworks / API / MCP / About`), `<Avatar>` chip slot (empty for Phase 1)
- [ ] Create `src/components/Topbar/Topbar.module.css` from mockup §142-257: sticky, 56px height, grid `260px 1fr auto`, `bg: rgba(11,14,13,0.85) + backdrop-filter: blur(12px)`, hairline border-bottom
- [ ] Create `src/components/Topbar/Kbd.tsx` (or co-locate as a sub-component) — keycap-style `<span>` with 2px bottom border
- [ ] Re-mount `<Topbar />` in `src/root.tsx` `App()`
- [ ] Wire `⌘K` / `Ctrl+K` document-level keydown to open SearchModal (stub the handler for Phase 1; opens nothing until Phase 3)
- [ ] Wire nav links: `/` (Directory, current), `/frameworks` + `/api` + `/mcp` (placeholders; inert `<span aria-disabled>` until those routes ship)
- [ ] Tests: `src/components/Topbar/Topbar.test.tsx` (renders / nav-link state / ⌘K binding wired)

**Directory (mockup §268-639):**

- [ ] Create `src/components/Directory/DirectoryHero.tsx` — eyebrow `/ docs / rfcs` + serif "Request for Comments" h1
- [ ] Create `src/components/Directory/LiveFilter.tsx` — `/`-keystroke-focus input
- [ ] Create `src/components/Directory/DirectoryToolbar.tsx` — icon-only filter trigger + cascading filter menu (Authors + Labels, not Type — RFC-only scope means Type filter is dead) + segmented sort toggle
- [ ] Create `src/components/Directory/DirectoryTable.tsx` — 5-col grid (`80px 1fr 100px 220px 100px` per mockup `.rfc-row`)
- [ ] Create `src/components/Directory/RfcRow.tsx` — mono-numeric id (`0011`) + serif-italic title + status-badge + authors cell + updated cell
- [ ] Per-component `.module.css` extracted from mockup §268-639
- [ ] Wire to existing `_index.tsx` loader; pin `?filter=type:rfc` in loader (or pass through if already filtered upstream)
- [ ] Tests: `src/components/Directory/{DirectoryHero,LiveFilter,DirectoryToolbar,DirectoryTable,RfcRow}.test.tsx`

**Status pill:**

- [ ] Create `src/components/Directory/StatusBadge.tsx` — colored pill for Draft / Proposed / Accepted / Rejected / Superseded statuses. Co-locate; promote later if a second view needs it (Phase 2 RFC page will).
- [ ] CSS from mockup `.status-badge.*` rules

**Route-render test:**

- [ ] `tests/api/indexRouteRender.test.tsx` — recreate against the new components; cover empty state + happy path + filter narrowing

#### Success Criteria

- `/` renders the directory hero + toolbar + table populated from `listDocs({ filter: ["type:rfc"] })`.
- Topbar renders on every route.
- `⌘K` is bound (opens nothing yet — Phase 3 wires it).
- Visual side-by-side against mockup §3088+ (View 1: RFC Directory) confirms parity within token tolerance.
- All component tests + route-render test pass.
- `just check` passes.
- Manual smoke: `bun run dev` shows the directory; `bun run dev:msw` shows the directory backed by MSW fixtures (narrowed to RFC fixtures or unchanged corpus — per Phase 0 open question on fixture-corpus narrowing).

---

### Phase 2: RFC page

> Goal: `/$type/$id` renders against the mockup with the 3-col layout, serif h1, TOC sidebar, references footer, and admonition wiring. Markdown pipeline integration verified.

#### Tasks

**Layout shell (mockup §641-760):**

- [ ] Create `src/components/DocPage/DocPage.tsx` — 3-col grid (`240px minmax(0,1fr) 240px`, max-width 1400px, gap 56px). Collapses to single-col under 800px per mockup §1525.
- [ ] CSS from mockup §641-700 `.rfc-view` + responsive rules

**Left sidebar — metadata (mockup §649-697):**

- [ ] Create `src/components/DocPage/DocSidebar.tsx` — sticky `top: 88px`, mono 12px
- [ ] Chrome-less `.sidebar-section` blocks for Metadata (Status / Author / Created / Updated / Revision / PR) + Labels
- [ ] Derive `revision` from `Document.source.commit` (first 7 chars)
- [ ] Derive PR link from `Document.discussion.url` — display as `#412` using the trailing path segment
- [ ] CSS from mockup §649-697

**Article center (mockup §699-744):**

- [ ] Create `src/components/DocPage/NumberLine.tsx` — `RFC / 0011` mono-accent eyebrow with fading-gradient `::after` divider
- [ ] Update prose h1 to serif 42px / weight 400 / letter-spacing -0.02em (via `src/components/DocPage/DocPage.module.css`)
- [ ] Create `<HeaderMeta>` — single mono-12 tertiary row with `·` dividers (status-badge · authored by name · revision N · relative-updated)

**Right sidebar — TOC (mockup §1181-1188):**

- [ ] Create `src/components/DocPage/TableOfContents.tsx` — sticky `top: 88px`, walks the rendered hast (or harvests from rehype-slug output) to emit `<nav>` + `<ol>`
- [ ] IntersectionObserver-driven `.current` highlight + `.nested` h3-under-h2 indent
- [ ] CSS from mockup §1181-1188

**References footer (mockup §1191-1247):**

- [ ] Create `src/components/DocPage/ReferencesFooter.tsx` — two-column "References / Referenced by" grid
- [ ] Consume `Document.links[]` for outgoing refs (References)
- [ ] "Referenced by" empty-state placeholder for now (depends on rfc-api back-references endpoint — F-2 in followups tracker)
- [ ] CSS from mockup §1191-1247

**Admonitions / GFM alerts (mockup §1052-1154):**

- [ ] Create `src/portal/markdown/plugins/github-alerts.ts` — remark plugin lifting `> [!NOTE]` / `[!WARNING]` / `[!TIP]` / `[!CAUTION]` syntax into a `<Callout>` AST node
- [ ] Create `src/components/DocPage/Callout.tsx` — variants note / warning / tip / caution; saturated-tint surface + circular icon chip
- [ ] Wire `<Callout>` into `<DocumentView>`'s `components` prop
- [ ] CSS from mockup §1052-1154

**Prose visual deltas (`src/portal/markdown/styles.css`):**

- [ ] h2: serif 26px / 500 with mono `#` hash hover prefix (mockup §745-764)
- [ ] `p` color: `--fg-secondary` (mockup §773)
- [ ] Code-block language-badge chip on `pre[data-lang]` (mockup §812-823) — requires a rehype plugin or extension of `mermaid-marker` to carry meta.lang through
- [ ] Blockquote: raised-bg + serif quote glyph (mockup §837-859)
- [ ] Table th: mono-uppercase 10px / tracked 0.1em on `--bg-raised` (mockup §1034-1044)
- [ ] Mermaid caption sub-element (mockup §1170-1179)

**`<Anchor>` integration with `<RFCPreviewCard>`:**

- [ ] Build cross-RFC preview-card per mockup §861-923 (`.rfc-link` + `.preview-card` markup). Wraps resolved internal `<Anchor>` links with a hover/focus popover (320px wide, mockup chrome).
- [ ] Co-locate as `src/components/DocPage/RfcLink.tsx` for now (single consumer — `<Anchor>` from the markdown pipeline)

**Route-render test:**

- [ ] `tests/api/docPageRender.test.tsx` — recreate against the new components; cover happy path + 404 + revision-from-commit + PR-from-discussion derivation

**Component tests:**

- [ ] One `.test.tsx` per new component in `src/components/DocPage/`

#### Success Criteria

- `/$type/$id` renders the 3-col layout: metadata-left + prose-center + TOC-right.
- Serif h1 (42px) + `.number-line` eyebrow render correctly.
- Cross-RFC link hover shows the preview card.
- GFM alert syntax (`> [!NOTE]`) renders as `<Callout>` with the correct status tint.
- TOC scroll-spy highlights the active section.
- References footer shows outgoing refs from `Document.links[]`; "Referenced by" shows the empty-state.
- Visual side-by-side against mockup §3093-3559 (View 2) confirms parity.
- All component tests + route-render test pass.
- `just check` passes.

---

### Phase 3: SearchModal + /search

> Goal: `⌘K` opens the search modal matching the mockup. `/search` works as the no-JS fallback (degraded surface). Content-scope filter pills (not type pills).

#### Tasks

**Modal shell (mockup §1253-1276):**

- [ ] Create `src/components/SearchModal/SearchModal.tsx` — 780px width, top-anchored (`padding-top: 96px`), `bg: var(--bg-raised)`, sharp `--r-sm` corners, `max-height: calc(100vh - 192px)`
- [ ] Translucent backdrop via `.search-overlay` (`bg: rgba(0,0,0,0.6); backdrop-filter: blur(8px)`)
- [ ] No header chrome — input row IS the header
- [ ] CSS from mockup §1253-1276

**Input row (mockup §1278-1304):**

- [ ] `.search-input-row` — icon + `<input>` + `[esc to close]` kbd cluster inline-right
- [ ] Hairline border-bottom
- [ ] Focus input on open via `queueMicrotask`
- [ ] CSS from mockup §1278-1304

**Filter pills (mockup §1306-1327) — content-scope, not type:**

- [ ] `.search-filters-row` — mono 11px, `[all results 12] [titles] [body] [authors] [labels]`
- [ ] Active pill: `color: var(--accent); bg: var(--accent-bg)` + inline result-count chip on `all results`
- [ ] **Caveat**: real content-scope filtering depends on rfc-api search-contract extensions (F-2 in followups tracker). For Phase 3 ship: render pills as visual chrome only; "all results" is active; per-facet pills are inert until rfc-api adds the `field` param. Document this in CLAUDE.md.
- [ ] CSS from mockup §1306-1327

**Two-pane results grid (mockup §1329-1456):**

- [ ] `.search-results` — `grid-template-columns: 320px 1fr`; left scrolls independently of right
- [ ] Left list: result groups (`RFCs — N matches`, `Labels — N matches`, etc.) with sticky `position: sticky; top: 0` mono 10px uppercase group headers
- [ ] Result item: 3-row layout (`.ri-top` mono 10px id + sm status badge, `.ri-title` 13.5px primary, `.ri-snippet` 11.5px tertiary with `<mark>` highlights)
- [ ] Active result: `bg: color-mix(in srgb, var(--accent) 8%, var(--bg-elevated))`
- [ ] Mixed-shape results (Labels group has `.ri-num` "LABEL" tertiary, `.ri-status` shows N RFCs count) — Phase 3 stub: render only docs (no labels group) until rfc-api emits non-doc results

**Preview pane (mockup §1401-1456):**

- [ ] Right column: borderless `bg: var(--bg-base)`, padding `24px 28px`
- [ ] `.rp-header`: number-line eyebrow + serif 22px / 400 title + meta row
- [ ] `.rp-body`: mono-uppercase `<h3>` section headers (`Summary` / `Motivation` / ...)
- [ ] Consume `useGetDoc` lazily (only fetch when a hit is active)

**Footer (mockup §1458-1479):**

- [ ] Hint cluster: `↑↓ navigate`, `↵ open`, `tab preview`
- [ ] Right-aligned `meilisearch ● 12ms` latency widget (computed client-side from the `searchDocs` Promise round-trip)

**Behaviour:**

- [ ] Escape closes; backdrop click closes; `<Esc>` in input also closes
- [ ] Focus trap via document-level keydown listener (Tab + Shift+Tab cycle inside dialog only)
- [ ] Previously-focused element captured on open + restored on close
- [ ] Keyboard nav over result list (↑↓ moves active, ↵ opens, Tab swaps focus to preview pane)
- [ ] `?modal=1` URL state mirror (open/close pushes/replaces history)
- [ ] AbortController per-keystroke search request

**`/search` route fallback:**

- [ ] Rebuild `src/routes/search.tsx` JSX as degraded surface — no preview pane, no keyboard nav, no filter pills (or pills as visual-only). Just `<Form method="get">` input + result list with `<Snippet>`-rendered hits.
- [ ] CSS module from a subset of the modal styles

**Topbar search trigger wiring:**

- [ ] Wire `<Topbar>`'s search trigger to open `<SearchModal>` (Phase 1 stubbed this)
- [ ] Meta-click / middle-click on the trigger navigates to `/search` for the no-JS fallback

**Tests:**

- [ ] `src/components/SearchModal/SearchModal.test.tsx` — open/close / focus-trap / filter pills (visual only) / keyboard nav / preview pane / URL state
- [ ] `tests/api/searchRouteRender.test.tsx` — recreate the `/search` fallback render

#### Success Criteria

- `⌘K` opens the search modal from any route.
- Typing in the input triggers search after debounce; results render in the left pane.
- Hovering or arrow-keying a result populates the preview pane.
- Escape / backdrop / inline kbd hint all dismiss the modal.
- Focus trap holds; previously-focused element restored on close.
- `?modal=1` persists state across page refresh.
- `/search` route renders the no-JS fallback.
- Visual side-by-side against mockup §3564-3725 (View 3) confirms parity.
- All component tests + route-render test pass.
- `just check` passes.

---

### Phase 4a: /mcp shell

> Goal: `/mcp` route renders the MCP discovery + setup page. Content is portal-local — no upstream dependency.

#### Tasks

**New route:**

- [ ] Create `src/routes/mcp.tsx` — no loader; static-ish content
- [ ] Wire into route discovery (RR7 `flatRoutes` picks it up automatically)

**Layout (mockup §1904-1925):**

- [ ] Create `src/components/McpPage/McpLayout.tsx` — single column, `max-width: 880px; padding: 56px 32px 80px 32px`. No sidebar.

**Hero (mockup §3922-3926):**

- [ ] Create `src/components/McpPage/McpHero.tsx` — eyebrow `Model Context Protocol` + serif h1 + paragraph

**MCP cards (mockup §3929-3955):**

- [ ] Create `src/components/McpPage/McpCard.tsx` — 2-col grid host; each card has `.c-head` (title + tag), `.c-desc`, `.c-meta` with `▸`-glyph items + `view source →` accent link
- [ ] Render two cards: `rfcs-mcp` (this server) + `docs-mcp` (related)

**Setup sections (mockup §3958-4057):**

- [ ] Create `src/components/McpPage/McpSection.tsx` — wraps a numbered step with `.step` chip in the h2
- [ ] **Step 1 — Install:** `<DownloadGrid>` (4 `<DownloadItem>` per-platform rows) + build-from-source `<pre>` snippet
- [ ] **Step 2 — Configure:** `<ExampleTabs>` (build fresh — no inheritance from deleted `<Tabs>` ds-candidate) with Claude Code / Cursor / Claude Desktop snippets
- [ ] **Step 3 — Available tools:** plain `<ul>` listing each tool with `<code>` name + one-line description
- [ ] **Step 4 — Verify:** prose + sample prompt `<pre>`

**Components built fresh (no design-system inheritance):**

- [ ] `src/components/McpPage/DownloadGrid.tsx` + `.module.css`
- [ ] `src/components/McpPage/DownloadItem.tsx`
- [ ] `src/components/McpPage/ExampleTabs.tsx` — basic tab state via `useState`; CSS from mockup §1735-1772 approximately

**Content (portal-local):**

- [ ] Define a constant module `src/components/McpPage/content.ts` with version (`0.4.2`), download URLs (placeholder until `rfcs-mcp` repo exists), config snippets per client, tool list
- [ ] Wire McpPage to consume from `content.ts`

**Tests:**

- [ ] `src/components/McpPage/McpPage.test.tsx` (renders) + per-section tests as appropriate
- [ ] `tests/api/mcpRouteRender.test.tsx` — full-render test

#### Success Criteria

- `/mcp` renders the hero + cards + 4 setup steps.
- ExampleTabs switches between Claude Code / Cursor / Claude Desktop snippets.
- DownloadGrid shows 4 per-platform items.
- Visual side-by-side against mockup §3897-4060 (View 5) confirms parity.
- Topbar nav highlights `MCP` as the active route (placeholder turns into a real `<NavLink>`).
- All tests pass; `just check` passes.

---

### Phase 4b: /api shell

> Goal: `/api` route renders the OpenAPI reference, parsed from the vendored `api/openapi.yaml`. Visual chrome only — no live-execution.

#### Tasks

**Spec loader:**

- [ ] Create `src/portal/openapi/loader.ts` — reads `api/openapi.yaml` at build time (Vite `?raw` import + YAML parse) and exposes a typed `OpenApiSpec`
- [ ] Choose a YAML parser: `yaml` package (recommend) or `js-yaml` — add as runtime dep

**New route:**

- [ ] Create `src/routes/api.tsx` — loader reads the spec via the loader module
- [ ] Optional: `src/routes/api.$group.$endpoint.tsx` for deep-linking (e.g. `/api/rfcs/getDoc`) — Phase 4b can ship without this initially

**Layout (mockup §1537-1553):**

- [ ] Create `src/components/ApiPage/ApiLayout.tsx` — 3-col grid `260px minmax(0,1fr)`, max-width 1400px
- [ ] Sidebar sticky `top: 56px; max-height: calc(100vh - 56px); overflow-y: auto`

**Sidebar (mockup §1546-1622):**

- [ ] Create `src/components/ApiPage/ApiSidebar.tsx` — brand block (`Portal API` + version tag) + grouped endpoints
- [ ] Group by OpenAPI `tag` if present; otherwise fall back to capability buckets
- [ ] Each `.api-endpoint`: `<MethodChip>` + truncated path mono 12px

**Method chip (mockup §1624-1645):**

- [ ] Create `src/components/ApiPage/MethodChip.tsx` — `padding: 2px 6px; min-width: 44px; font-mono 9.5px / 600`; color-mix-tinted bg + colored border
- [ ] Variants: GET (`--code-function`), POST (`--status-accepted`), PUT (`--status-draft`), PATCH (`--code-type`), DELETE (`--status-rejected`)

**Endpoint header (mockup §1652-1695):**

- [ ] Create `src/components/ApiPage/EndpointHeader.tsx` — eyebrow (group tag) + serif h1 (summary) + `<PathLine>` (method chip + full path + copy button) + description paragraph
- [ ] `<PathLine>` highlights `{paramName}` segments in `--code-number`

**Try-it band (mockup §1700+):**

- [ ] Create `src/components/ApiPage/TryItBand.tsx` — horizontal callout with `▶` icon + auth-note text + inert `send request →` CTA (visual only; defer live-execution)

**Sections (Path params / Query params / Responses):**

- [ ] Create `src/components/ApiPage/ApiSection.tsx` — title with `.count` chip
- [ ] Create `src/components/ApiPage/ParamRow.tsx` — `.p-name` / `.p-type` / `.p-desc` grid; `.required` red badge
- [ ] Create `src/components/ApiPage/ResponseRow.tsx` — `.r-code` chip (ok / err4 / err5) + description

**Example tabs / code:**

- [ ] Reuse `<ExampleTabs>` + `<ExampleCode>` from Phase 4a if shared; otherwise port
- [ ] Show curl / go / typescript variants (curl active by default)
- [ ] Use the Shiki path from the markdown pipeline for code highlighting if convenient; or inline tokenisation for simplicity

**Source-of-truth:**

- [ ] Use `api/openapi.yaml` paths (e.g. `/api/v1/rfc/{id}`, NOT the mockup's `/api/v1/rfcs/{id}`)
- [ ] Document the path drift in CLAUDE.md so future readers know why the rendered paths differ from the mockup

**Tests:**

- [ ] `src/components/ApiPage/ApiPage.test.tsx` (renders against a fixture spec)
- [ ] `tests/api/apiRouteRender.test.tsx` — full-render test
- [ ] `tests/portal/openapi/loader.test.ts` — spec parsing

#### Success Criteria

- `/api` renders the sidebar + endpoint header + sections for at least one endpoint.
- Sidebar lists every endpoint from `api/openapi.yaml`, grouped by tag.
- Selecting a sidebar endpoint navigates to that endpoint's detail (URL update + content swap).
- Code-example tabs switch correctly.
- Visual side-by-side against mockup §3731-3892 (View 4) confirms parity.
- Topbar nav highlights `API` as the active route.
- All tests pass; `just check` passes.
- `bun run gen-api:check` still passes (the spec import is read-only).

---

## File Changes

> High-level file-change summary. See per-phase Tasks above for the granular checklist.

| File / Directory | Phase | Action | Description |
|------------------|-------|--------|-------------|
| `src/components/ds-candidates/` | 0 | Delete | Entire dir (3 components + tests + README) |
| `src/components/portal/` | 0 | Delete | Entire dir (10 components + tests + README) |
| `bunfig.toml` | 0 | Delete | GitHub Packages auth — no longer needed |
| `package.json` | 0 | Modify | Remove `"@donaldgifford/design-system": "^0.4.0"` |
| `src/root.tsx` | 0 | Modify | Strip 3 design-system imports + `<Topbar>` import + JSX |
| `src/portal/markdown/components/MermaidBlock.tsx` | 0 | Modify | Replace `useTheme` import per Open Question 1 |
| `src/routes/_index.tsx` | 0 | Modify | Stub JSX, keep loader / boundaries / types |
| `src/routes/$type.$id.tsx` | 0 | Modify | Stub JSX, keep loader / boundaries / types |
| `src/routes/search.tsx` | 0 | Modify | Stub JSX, keep loader / boundaries / types |
| `tests/api/{docPageRender,indexRouteRender,searchRouteRender}.test.tsx` | 0 | Delete | Route-render tests against deleted components |
| `justfile` | 0 | Modify | Strip `ds-build` / `ds-link` / `ds-unlink` recipes |
| `.github/workflows/ci.yml` | 0 | Modify | Optional cleanup per Open Question 3 |
| `CLAUDE.md` | 0 | Modify | Rewrite per Open Question 2 |
| `inv-0003-followups.local.md` | 0 | Modify | Annotate F-3-F-8 as superseded (file is gitignored) |
| `src/styles/tokens.css` | 0 / 1 | Create | Empty in Phase 0; populated from mockup `:root` in Phase 1 |
| `src/components/Topbar/` | 1 | Create | New top-bar component + Kbd helper |
| `src/components/Directory/` | 1 | Create | DirectoryHero / LiveFilter / DirectoryToolbar / DirectoryTable / RfcRow / StatusBadge |
| `src/components/DocPage/` | 2 | Create | DocPage / DocSidebar / NumberLine / TableOfContents / ReferencesFooter / Callout / RfcLink |
| `src/portal/markdown/plugins/github-alerts.ts` | 2 | Create | GFM `[!NOTE]` → `<Callout>` plugin |
| `src/portal/markdown/styles.css` | 2 | Modify | Prose visual deltas (serif h2, language-badge chip, blockquote, etc.) |
| `src/components/SearchModal/` | 3 | Create | SearchModal + sub-components |
| `src/routes/search.tsx` | 3 | Modify | Rebuild as no-JS fallback (replaces Phase 0 stub) |
| `src/components/McpPage/` + `src/routes/mcp.tsx` | 4a | Create | MCP discovery + setup page |
| `src/portal/openapi/loader.ts` + `src/components/ApiPage/` + `src/routes/api.tsx` | 4b | Create | OpenAPI reference renderer |

## Testing Plan

**Phase 0** drops the test count substantially (estimated 177 → ~95 tests across ~14 files). Surviving tests cover the data plane + markdown pipeline; deleted tests covered the UI surface that no longer exists.

**Per rebuild phase**, the IMPL adds:

- Component tests co-located with each new component (`<Component>.test.tsx` next to `<Component>.tsx`).
- Route-render tests in `tests/api/<route>RouteRender.test.tsx` covering happy path + error path + empty state where applicable.
- For markdown-pipeline additions (Phase 2's `<Callout>` + GFM-alerts plugin), tests under `tests/portal/markdown/`.

**CI gates unchanged** (per DESIGN-0003 §Testing Strategy):

- `bun run typecheck` (TS strict)
- `bun run lint` (ESLint flat config)
- `bun run format:check` (Prettier)
- `bun test` (vitest suite)
- `bun run build` (Vite production build)
- `bun run gen-api:check` (orval drift check)

Composite `just check` runs all six.

## Dependencies

- [RFC-0001](../rfc/0001-defer-the-design-system-promotion-model-and-iterate-rfc-site.md) accepted (the decision).
- [DESIGN-0003](../design/0003-rebuild-rfc-site-against-the-mockup.md) approved (the plan).
- Open Questions (above) resolved with Donald.
- rfc-api stays at v0.3.0 — this IMPL does not require upstream changes. Content-scope facet pills (Phase 3) ship as visual-only until rfc-api extends `searchDocs`'s contract (tracked separately as F-2 in `inv-0003-followups.local.md`).
- The mockup at `donaldgifford/design-system/rfc-portal-mockup_15.html` is treated as a stable visual spec for the duration of this IMPL. If the mockup is iterated mid-rebuild, the IMPL pauses for a re-audit.

## References

- [RFC-0001 — Defer the design-system promotion model and iterate rfc-site against the mockup](../rfc/0001-defer-the-design-system-promotion-model-and-iterate-rfc-site.md)
- [DESIGN-0003 — Rebuild rfc-site against the mockup](../design/0003-rebuild-rfc-site-against-the-mockup.md)
- [INV-0003 — Inventory remaining portal-mockup work by view](../investigation/0003-inventory-remaining-portal-mockup-work-by-view.md) — the source of all the per-view findings driving Phases 1-4
- [DESIGN-0001 — Portal architecture and ds-candidates promotion model](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md) — superseded
- [DESIGN-0002 — Markdown rendering pipeline](../design/0002-markdown-rendering-pipeline.md) — still load-bearing
- [ADR-0001 — Consume rfc-api via its OpenAPI contract](../adr/0001-consume-rfc-api-via-its-published-openapi-contract.md) — still load-bearing
- [ADR-0002 — Adopt portal frontend stack](../adr/0002-adopt-portal-frontend-stack.md) — still load-bearing
- Mockup: `donaldgifford/design-system/rfc-portal-mockup_15.html` — the visual contract
- `inv-0003-followups.local.md` — personal tracker; F-3/4/5/6/7/8 superseded by this IMPL; F-1 subsumed by Phase 0+1; F-2 (rfc-api RFC) + F-9 (/frameworks data plane) still relevant
