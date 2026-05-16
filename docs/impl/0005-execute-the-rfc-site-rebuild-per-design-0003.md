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

- [x] Create `src/components/DocPage/DocPage.tsx` — 3-col grid (`240px minmax(0,1fr) 240px`, max-width 1400px, gap 56px). Collapses to single-col under 800px per mockup §1525.
- [x] CSS from mockup §641-700 `.rfc-view` + responsive rules

**Left sidebar — metadata (mockup §649-697):**

- [x] Create `src/components/DocPage/DocSidebar.tsx` — sticky `top: 88px`, mono 12px
- [x] Chrome-less `.sidebar-section` blocks for Metadata (Status / Author / Created / Updated / Revision / PR) + Labels
- [x] Derive `revision` from `Document.source.commit` (first 7 chars)
- [x] Derive PR link from `Document.discussion.url` — display as `#412` using the trailing path segment
- [x] CSS from mockup §649-697

**Article center (mockup §699-744):**

- [x] Create `src/components/DocPage/NumberLine.tsx` — `RFC / 0011` mono-accent eyebrow with fading-gradient `::after` divider
- [x] Update prose h1 to serif 42px / weight 400 / letter-spacing -0.02em (via `src/components/DocPage/DocHeader.module.css`)
- [x] Create `<HeaderMeta>` — single mono-12 tertiary row with `·` dividers (status-badge · authored by name · revision N · relative-updated)

**Right sidebar — TOC (mockup §1181-1188):**

- [x] Create `src/components/DocPage/TableOfContents.tsx` — sticky `top: 88px`, walks the rendered hast (or harvests from rehype-slug output) to emit `<nav>` + `<ol>`
- [x] IntersectionObserver-driven `.current` highlight + `.nested` h3-under-h2 indent
- [x] CSS from mockup §1181-1188

**References footer (mockup §1191-1247):**

- [x] Create `src/components/DocPage/ReferencesFooter.tsx` — two-column "References / Referenced by" grid
- [x] Consume `Document.links[]` for outgoing refs (References)
- [x] "Referenced by" empty-state placeholder for now (depends on rfc-api back-references endpoint — F-2 in followups tracker)
- [x] CSS from mockup §1191-1247

**Admonitions / GFM alerts (mockup §1052-1154):**

- [x] Create `src/portal/markdown/plugins/github-alerts.ts` — remark plugin lifting `> [!NOTE]` / `[!WARNING]` / `[!TIP]` / `[!CAUTION]` syntax into a `<Callout>` AST node
- [x] ~~Create `src/components/DocPage/Callout.tsx`~~ — the plugin emits hast `<div class="admonition note">` + `<span class="adm-label">` directly via `data.hName` / `data.hProperties`; no React component is needed. Variants note / warning / tip / caution (and `[!IMPORTANT]` normalised to note) styled directly in `src/portal/markdown/styles.css`.
- [x] ~~Wire `<Callout>` into `<DocumentView>`'s `components` prop~~ — N/A per above. Sanitize schema in `pipeline.ts` extended to permit `<div class="admonition …">` + `<span class="adm-label">`.
- [x] CSS from mockup §1052-1154 (in `src/portal/markdown/styles.css`)

**Prose visual deltas (`src/portal/markdown/styles.css`):**

- [x] h2: serif 26px / 500 with mono `#` hash hover prefix (mockup §745-764)
- [x] `p` color: `--fg-secondary` (mockup §773)
- [ ] Code-block language-badge chip on `pre[data-lang]` (mockup §812-823) — requires a rehype plugin or extension of `mermaid-marker` to carry meta.lang through. **Deferred to a follow-up** — not a Phase 2 success criterion; no consumer yet.
- [x] Blockquote: raised-bg + serif quote glyph (mockup §837-859)
- [x] Table th: mono-uppercase 10px / tracked 0.1em on `--bg-raised` (mockup §1034-1044)
- [ ] Mermaid caption sub-element (mockup §1170-1179) — **deferred to a follow-up**; the mermaid block itself styled (`.mermaid-block__diagram` / `__source` / `__error`), but the caption is decorative and depends on rfc-api emitting a caption alt or `data-caption`.

**`<Anchor>` integration with `<RFCPreviewCard>`:**

- [ ] Build cross-RFC preview-card per mockup §861-923 (`.rfc-link` + `.preview-card` markup). Wraps resolved internal `<Anchor>` links with a hover/focus popover (320px wide, mockup chrome). **Deferred to a follow-up.** Reasoning: the preview-card requires `useGetDoc` + popover orchestration + `classifyProblem` error handling — a substantial slice that bumps against the Phase 3 SearchModal preview-pane work. Folding both into a single ds-candidate `<Popover>` promotion is the cleaner path; tracking via the "Visual fidelity vs the mockup" deferral pattern already established in IMPL-0004.
- [ ] Co-locate as `src/components/DocPage/RfcLink.tsx` for now (single consumer — `<Anchor>` from the markdown pipeline) — see above.

**Route-render test:**

- [x] `tests/api/docPageRender.test.tsx` — recreate against the new components; cover happy path (4 tests: NumberLine + status sidebar + References footer + Markdown body via `getByRole heading level=2 /Motivation/i`)

**Component tests:**

- [x] One `.test.tsx` per new component in `src/components/DocPage/` (DocSidebar 8, NumberLine 2, HeaderMeta 5, ReferencesFooter 5, TableOfContents 4; plus github-alerts plugin 7).

#### Success Criteria

- [x] `/$type/$id` renders the 3-col layout: metadata-left + prose-center + TOC-right.
- [x] Serif h1 (42px) + `.number-line` eyebrow render correctly.
- [ ] ~~Cross-RFC link hover shows the preview card.~~ **Deferred** — the `<RFCPreviewCard>` rebuild is folded into a follow-up alongside SearchModal's preview pane (likely paired with a future `<Popover>` ds-candidate). The Anchor still resolves cross-doc links + falls through to external / broken-link sentinels correctly; only the hover preview chrome is missing.
- [x] GFM alert syntax (`> [!NOTE]`) renders as `<div class="admonition note">` + `<span class="adm-label">Note</span>` with the correct status tint. (Plugin emits hast directly; no `<Callout>` React component needed.)
- [x] TOC scroll-spy highlights the active section. (IntersectionObserver-driven; jsdom mocked for tests, real browser uses native API.)
- [x] References footer shows outgoing refs from `Document.links[]`; "Referenced by" shows the empty-state.
- [x] Visual side-by-side against mockup §3093-3559 (View 2) confirms parity — sidebar / NumberLine / h1 / HeaderMeta / References footer / admonitions all render. (Preview card + code-block language badge + mermaid caption deferred — see tracker above.)
- [x] All component tests + route-render test pass (31 new tests: 8 DocSidebar + 2 NumberLine + 5 HeaderMeta + 5 ReferencesFooter + 4 TableOfContents + 7 github-alerts plugin + 4 docPageRender; 176 tests total across 28 files).
- [x] `just check` passes.

---

### Phase 3: SearchModal + /search

> Goal: `⌘K` opens the search modal matching the mockup. `/search` works as the no-JS fallback (degraded surface). Content-scope filter pills (not type pills).

#### Tasks

**Modal shell (mockup §1253-1276):**

- [x] Create `src/components/SearchModal/SearchModal.tsx` — 780px width, top-anchored (`padding-top: 96px`), `bg: var(--bg-raised)`, sharp `--r-sm` corners, `max-height: calc(100vh - 192px)`
- [x] Translucent backdrop via `.overlay` (`bg: rgba(0,0,0,0.6); backdrop-filter: blur(8px)`)
- [x] No header chrome — input row IS the header
- [x] CSS from mockup §1253-1276 (in `SearchModal.module.css`)

**Input row (mockup §1278-1304):**

- [x] `.inputRow` — icon + `<input>` + `[esc to close]` kbd cluster inline-right
- [x] Hairline border-bottom
- [x] Focus input on open via `queueMicrotask`
- [x] CSS from mockup §1278-1304

**Filter pills (mockup §1306-1327) — content-scope, not type:**

- [x] `.filtersRow` — mono 11px, `[all results N] [titles] [body] [authors] [labels]`
- [x] Active pill: `color: var(--accent); bg: var(--accent-bg)` + inline result-count chip on `all results`
- [x] **Caveat**: content-scope facets ship as visual chrome only; "all results" is the only wired pill. Per-facet pills carry a "Coming soon" `title` until rfc-api adds the `field` param (F-2 in followups tracker). Documented in CLAUDE.md.
- [x] CSS from mockup §1306-1327

**Two-pane results grid (mockup §1329-1456):**

- [x] `.body` — `grid-template-columns: 320px 1fr`; left scrolls independently of right
- [x] Left list: result groups (`RFCS — N matches`, `ADRS — N matches`, etc. by `document.type`) with sticky `position: sticky; top: 0` mono 10px uppercase group headers
- [x] Result item: 3-row layout (`.itemTop` mono 10px id + sm status badge, `.itemTitle` 13.5px primary, `.itemSnippet` 11.5px tertiary with `<mark>` highlights from `result.snippet` HTML)
- [x] Active result: `bg: color-mix(in srgb, var(--accent) 8%, var(--bg-elevated))`
- [x] Mixed-shape results — Phase 3 ships docs-only; labels / other non-doc result kinds wait for rfc-api to emit them in `searchDocs`.

**Preview pane (mockup §1401-1456):**

- [x] Right column: borderless `bg: var(--bg-base)`, padding `24px 28px`
- [x] `.previewHeader`: number-line eyebrow + serif 22px / 400 title + meta row
- [x] `.previewBody`: section-heading h3 (from `result.section_heading`) + snippet HTML
- [ ] ~~Consume `useGetDoc` lazily~~ — **simplified**: Phase 3 renders the `result.snippet` directly; a separate `useGetDoc` fetch would only matter for rendering full sections, which depends on rfc-api exposing a per-section content endpoint. Tracked as a follow-up alongside `<RfcLink>` hover preview (both need cross-doc fetch).

**Footer (mockup §1458-1479):**

- [x] Hint cluster: `↑↓ navigate`, `↵ open`, `tab preview`
- [x] Right-aligned `meilisearch ● Nms` latency widget (computed client-side from `performance.now()` round-trip around `searchDocs`)

**Behaviour:**

- [x] Escape closes; backdrop click closes; `<Esc>` in input also closes (dialog-level keydown handler)
- [x] Focus trap via dialog `onKeyDown` (Tab + Shift+Tab cycle inside dialog only — querySelector-based focusable list)
- [x] Previously-focused element captured on open + restored on close (via ref + useEffect cleanup)
- [x] Keyboard nav over result list (↑/↓ moves active, ↵ navigates via RR7, Tab cycles within the dialog)
- [x] `?modal=1` URL state mirror — `<Topbar>` owns the param, `setSearchParams({ replace: true, preventScrollReset: true })` so the modal toggle never pushes history.
- [x] AbortController per-keystroke search request

**`/search` route fallback:**

- [x] Rebuild `src/routes/search.tsx` JSX as degraded surface — no preview pane, no kb-nav, no filter pills. `<Form method="get">` input + result list rendering snippet HTML.
- [x] CSS module (`src/routes/search.module.css`) — subset of modal styles

**Topbar search trigger wiring:**

- [x] Wire `<Topbar>`'s search trigger to open `<SearchModal>` via `?modal=1`
- [x] Meta/Ctrl-click on the trigger navigates to `/search` for the no-JS fallback (mirrors open-in-new-tab convention)

**Tests:**

- [x] `src/components/SearchModal/SearchModal.test.tsx` — 7 tests covering: closed-state null, open + focus, filter pills order + active, Escape close, backdrop click close, debounced search + latency widget, ↑/↓ arrow navigation
- [x] `tests/api/searchRouteRender.test.tsx` — 3 tests covering: empty-state form render, results render against MSW fixture corpus, no-match empty state

#### Success Criteria

- [x] `⌘K` opens the search modal from any route.
- [x] Typing in the input triggers search after debounce; results render in the left pane.
- [x] Hovering or arrow-keying a result populates the preview pane (`onMouseEnter` + ↑/↓).
- [x] Escape / backdrop / inline kbd hint all dismiss the modal.
- [x] Focus trap holds; previously-focused element restored on close.
- [x] `?modal=1` persists state across page refresh (read at hydration via `useSearchParams`).
- [x] `/search` route renders the no-JS fallback (Form GET + result list with snippet HTML).
- [x] Visual side-by-side against mockup §3564-3725 (View 3) confirms parity — overlay backdrop, 780px top-anchored modal, input row, filter pills, two-pane results, sticky group headers, active row tint, footer hints + latency.
- [x] All component tests + route-render test pass (10 new tests: 7 SearchModal + 3 searchRouteRender — and 2 reworked Topbar tests for the new modal-opening behaviour).
- [x] `just check` passes (188 tests across 30 files).

---

### Phase 4a: /mcp shell

> Goal: `/mcp` route renders the MCP discovery + setup page. Content is portal-local — no upstream dependency.

#### Tasks

**New route:**

- [ ] Create `src/routes/mcp.tsx` — no loader; static-ish content
- [ ] Wire into route discovery (RR7 `flatRoutes` picks it up automatically)

**Layout (mockup §1904-1949):**

- [x] `src/components/McpPage/McpPage.tsx` hosts the full layout — single column, `max-width: 1000px; padding: 48px 40px 96px 40px`. No sidebar. (Mockup uses 1000px not 880px; matched the mockup.)

**Hero (mockup §1912-1949):**

- [x] Hero block inside `McpPage.tsx` — eyebrow `Model Context Protocol` with `::before` 24px accent rule + serif 44px h1 + paragraph. Bottom border + 40px margin separates from the cards grid.

**MCP cards (mockup §1953-2028):**

- [x] Two-card `<section>` grid (`repeat(2, minmax(0, 1fr))`, `gap: 14px`). Each card is an `<a target="_blank">` to its source repo: `.cardHead` (title + tag), `.cardDesc` (with inline `<code>` from backtick promotion), `.cardMeta` (▸-glyph bullets + accent `view source →`).
- [x] `rfcs-mcp` ("this server", accent tag) + `docs-mcp` ("related", draft-status tag via `.cardTagRelated` color-mix).

**Setup sections (mockup §2030-2083):**

- [x] Four numbered `<section>` blocks with `<h2>` + `.stepChip` (30px circle, accent border + accent bg, mono 12px). Headings carry `id="mcp-step-N"` + `aria-labelledby` on the section.
- [x] **Step 1 — Install:** download grid + build-from-source `<pre>` with mono comment line.
- [x] **Step 2 — Configure:** `<ExampleTabs>` with Claude Code / Cursor / Claude Desktop snippets.
- [x] **Step 3 — Available tools:** `<ul>` listing 5 tools with `<code>` name + description.
- [x] **Step 4 — Verify:** prose + sample prompt `<pre>` (string-coloured).

**Components built fresh (no design-system inheritance):**

- [x] ~~Separate `DownloadGrid.tsx` + `DownloadItem.tsx`~~ — inlined into `McpPage.tsx` since they're a one-place concern (no other consumers). `.downloads` / `.downloadItem` / `.downloadIcon` / `.downloadInfo` / `.downloadName` / `.downloadPlatform` / `.downloadButton` live in `McpPage.module.css`.
- [x] `src/components/McpPage/ExampleTabs.tsx` (+ `.module.css`) — tab state via `useState`, `role="tablist"` + `role="tab"` + `aria-selected`. Comment line gets the muted italic Tokyo Night colour; rest is default `--code-fg`. No Shiki — the snippets are short JSON, not worth routing through Shiki's WASM cold-start.

**Content (portal-local):**

- [x] `src/components/McpPage/content.ts` — `MCP_VERSION` = `0.4.2`; `MCP_SERVERS` (2 entries); `MCP_DOWNLOADS` (4 entries); `MCP_BUILD_FROM_SOURCE` snippet; `MCP_CONFIG_SNIPPETS` (3 clients); `MCP_TOOLS` (5 tools); `MCP_VERIFY_PROMPT`. Download `href`s and source URLs are placeholders until `rfcs-mcp` exists publicly.
- [x] McpPage consumes from `content.ts` exclusively.

**Tests:**

- [x] `src/components/McpPage/McpPage.test.tsx` (7 tests): hero / cards / 4 setup steps + step chips / 4 download items / 5 tools as `<code>` / ExampleTabs default + switch.
- [x] `tests/api/mcpRouteRender.test.tsx` (2 tests): full route render + 4 setup-step headings.

#### Success Criteria

- [x] `/mcp` renders the hero + cards + 4 setup steps.
- [x] ExampleTabs switches between Claude Code / Cursor / Claude Desktop snippets.
- [x] DownloadGrid shows 4 per-platform items.
- [x] Visual side-by-side against mockup §3897-4060 (View 5) confirms parity — hero with accent eyebrow rule, two-card grid with `this server` / `related` tag colour variants, 4 numbered step chips, downloads grid, ExampleTabs tab bar over connected `<pre>`, tool `<code>` list, accent-coloured verify prompt.
- [x] Topbar nav highlights `MCP` as the active route — placeholder `<span>` replaced by `<NavLink to="/mcp">` (Topbar test asserts `href="/mcp"`).
- [x] All tests pass (9 new: 7 McpPage + 2 mcpRouteRender + 1 reworked Topbar placeholder test + 1 new Topbar MCP-NavLink test = 198 across 32 files); `just check` passes.

---

### Phase 4b: /api shell

> Goal: `/api` route renders the OpenAPI reference, parsed from the vendored `api/openapi.yaml`. Visual chrome only — no live-execution.

#### Tasks

**Spec loader:**

- [x] `src/portal/openapi/loader.ts` — reads `api/openapi.yaml` via Vite `?raw` import (string at build time) + `yaml.parse()`. Exposes a typed `OpenApiSpec` subset (info / paths / components / parameters / responses). `loadSpec()` caches the parse; `listEndpoints()` flattens paths × methods, resolves `$ref` parameters through `components.parameters`, hoists path-level params into operation params, and resolves `$ref` responses through `components.responses`. `groupEndpointsByTag()` preserves first-appearance order.
- [x] `yaml` added as a runtime dep (`yaml@2.9.0`). YAML module declaration in `src/env.d.ts`.

**New route:**

- [x] `src/routes/api.tsx` — loader-less; calls `loadSpec()` + `listEndpoints()` synchronously (Vite inlines the raw spec at build time).
- [ ] ~~Deep-link route `api.$group.$endpoint.tsx`~~ — **simplified**: `?endpoint=<method>:<path>` query string preserves the active endpoint across refresh + sharing, without adding another route tree.

**Layout (mockup §1537-1553):**

- [x] `src/components/ApiPage/ApiPage.tsx` (+ `ApiPage.module.css`) — 2-col grid `260px minmax(0,1fr)`, max-width 1400px. Collapses to single column under 900px.
- [x] Sidebar sticky `top: 56px; max-height: calc(100vh - 56px); overflow-y: auto`.

**Sidebar (mockup §1546-1622):**

- [x] `src/components/ApiPage/ApiSidebar.tsx` — `<h2>` brand title + accent version tag + OpenAPI version. One `<h3>` per OpenAPI tag with a list of endpoint `<button>`s.
- [x] Each row: `<MethodChip>` + truncated `.endpointPath`, active row gets `--accent-bg` + `aria-current="page"`.

**Method chip (mockup §1624-1645):**

- [x] `src/components/ApiPage/MethodChip.tsx` — variant classes for GET / POST / PUT / PATCH / DELETE, all `currentColor`-driven so the chip border + tinted bg track the variant colour.

**Endpoint header (mockup §1652-1695):**

- [x] `src/components/ApiPage/EndpointDetail.tsx` includes the header (eyebrow tag + serif h1 + `<PathLine>` + description) inline. Kept in one file to avoid over-decomposition for a 2-section page.
- [x] `src/components/ApiPage/PathLine.tsx` — `{paramName}` segments split out as `<span class="segmentVar">` (rendered in `--code-number`). Copy button uses `navigator.clipboard` with a "copied" success flip (1500ms).

**Try-it band (mockup §1865-1895):**

- [x] Inline in `EndpointDetail.tsx` (one component for one band). `▶` chevron icon + auth-note text + inert `send request →` CTA with `title` explaining the deferral. `cursor: not-allowed` on the CTA.

**Sections (Path params / Query params / Responses):**

- [x] All section primitives inlined in `EndpointDetail.tsx`: `ParamSection` (title + `.sectionCount` chip), `ParamRow` (`.paramName` / `.paramType` / `.paramDesc` grid, `.requiredBadge` for required), `ResponseRow` (`.responseCode` with `ok` / `redir` / `err4` / `err5` variants derived from the HTTP status code).

**Example tabs / code:**

- [ ] ~~`<ExampleTabs>` for curl / go / typescript per endpoint~~ — **deferred**. The OpenAPI spec doesn't include example snippets per language, and generating them from the spec is a larger undertaking than the rest of Phase 4b. The `<ExampleTabs>` from Phase 4a can be re-used wholesale when those snippets land. Tracked as a follow-up.

**Source-of-truth:**

- [x] Renders paths exactly as `api/openapi.yaml` declares them (e.g. `/api/v1/{type}/{id}` — the mockup uses `/api/v1/rfcs/{id}` which is wrong; the actual rfc-api is per-type).
- [x] Documented the path drift in CLAUDE.md (Phase 4b notes).

**Tests:**

- [x] `src/components/ApiPage/ApiPage.test.tsx` — 8 tests against a fixture spec (sidebar brand, group rendering, default selection, click-to-swap detail, path + query param sections with required badges, responses chip render, inert try-it band, path-segment var highlighting).
- [x] `tests/api/apiRouteRender.test.tsx` — 4 tests against the real vendored spec (meta title, sidebar brand, default endpoint detail, multiple tag groups).
- [x] `tests/portal/openapi/loader.test.ts` — 8 tests covering the loader (loads + caches the spec, flattens paths × methods, groups by tag, `findEndpoint` resolution, `$ref` resolution for path-level parameters, empty list handling, custom-spec injection).

#### Success Criteria

- [x] `/api` renders the sidebar + endpoint header + sections for at least one endpoint.
- [x] Sidebar lists every endpoint from `api/openapi.yaml`, grouped by tag.
- [x] Selecting a sidebar endpoint navigates to that endpoint's detail (URL update via `?endpoint=` + content swap, no scroll reset).
- [ ] ~~Code-example tabs switch correctly.~~ Deferred (no example snippets in the spec — see Tasks).
- [x] Visual side-by-side against mockup §3731-3892 (View 4) confirms parity — sidebar brand block, accent-bg active row, method chips, path-line with `{var}` highlighting + copy button, try-it band, parameter rows with required badge, response code chips. The mockup's `/api/v1/rfcs/{id}` paths are replaced with the actual `/api/v1/{type}/{id}` from the spec (mockup is wrong; the spec is the contract).
- [x] Topbar nav highlights `API` as the active route — placeholder `<span>` replaced by `<NavLink to="/api">`.
- [x] All tests pass (20 new: 8 ApiPage + 4 apiRouteRender + 8 loader + 1 reworked Topbar test for the API NavLink, total **219 across 36 files**); `just check` passes.
- [x] `just gen-api-check` still passes (the spec import is read-only — no codegen drift).

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
