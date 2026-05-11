---
id: IMPL-0004
title: "Build rfc-portal components per INV-0002 inventory"
status: Draft
author: Donald Gifford
created: 2026-05-11
---
<!-- markdownlint-disable-file MD025 MD041 -->

# IMPL 0004: Build rfc-portal components per INV-0002 inventory

**Status:** Draft
**Author:** Donald Gifford
**Date:** 2026-05-11

<!--toc:start-->
- [Objective](#objective)
- [Scope](#scope)
  - [In Scope](#in-scope)
  - [Out of Scope](#out-of-scope)
- [Approach](#approach)
- [Implementation Phases](#implementation-phases)
  - [Phase 1: ds-candidates authoring conventions + <Button>](#phase-1-ds-candidates-authoring-conventions--button)
    - [Tasks](#tasks)
    - [Success Criteria](#success-criteria)
  - [Phase 2: <Input> + <Kbd>](#phase-2-input--kbd)
    - [Tasks](#tasks-1)
    - [Success Criteria](#success-criteria-1)
  - [Phase 3: <Topbar> portal composite + src/root.tsx Layout wiring](#phase-3-topbar-portal-composite--srcroottsx-layout-wiring)
    - [Tasks](#tasks-2)
    - [Success Criteria](#success-criteria-2)
  - [Phase 4: <Card> + <Tabs> + <CodeBlock>](#phase-4-card--tabs--codeblock)
    - [Tasks — <Card>](#tasks--card)
    - [Tasks — <Tabs>](#tasks--tabs)
    - [Tasks — <CodeBlock>](#tasks--codeblock)
    - [Success Criteria](#success-criteria-3)
  - [Phase 5: <Breadcrumb> + <Badge> extension (filter / severity variants)](#phase-5-breadcrumb--badge-extension-filter--severity-variants)
    - [Tasks — <Breadcrumb>](#tasks--breadcrumb)
    - [Tasks — <Badge> extension (in ../design-system)](#tasks--badge-extension-in-design-system)
    - [Success Criteria](#success-criteria-4)
  - [Phase 6: Promote stabilized primitives to @donaldgifford/design-system](#phase-6-promote-stabilized-primitives-to-donaldgifforddesign-system)
    - [Tasks](#tasks-3)
    - [Success Criteria](#success-criteria-5)
  - [Phase 7: Directory table + toolbar upgrade (_index.tsx)](#phase-7-directory-table--toolbar-upgrade-indextsx)
    - [Tasks](#tasks-4)
    - [Success Criteria](#success-criteria-6)
  - [Phase 8: RFC sidebar + cross-RFC preview card ($type.$id.tsx)](#phase-8-rfc-sidebar--cross-rfc-preview-card-typeidtsx)
    - [Tasks](#tasks-5)
    - [Success Criteria](#success-criteria-7)
  - [Phase 9: Search modal upgrade (search.tsx)](#phase-9-search-modal-upgrade-searchtsx)
    - [Tasks](#tasks-6)
    - [Success Criteria](#success-criteria-8)
- [File Changes](#file-changes)
- [Testing Plan](#testing-plan)
- [Dependencies](#dependencies)
- [Resolved Questions](#resolved-questions)
- [References](#references)
<!--toc:end-->

## Objective

Build out the UI components catalogued in [INV-0002](../investigation/0002-inventory-components-needed-from-the-rfc-portal-mockup.md) — eight reusable primitives authored inline as `ds-candidates/` and four portal-only composites that wire them into the three routes that already exist (`_index`, `$type.$id`, `search`). Promotion to `@donaldgifford/design-system` happens in a dedicated phase once the candidates have hit the readiness checklist (DESIGN-0001 §The `ds-candidates/` contract).

**Implements:** [INV-0002](../investigation/0002-inventory-components-needed-from-the-rfc-portal-mockup.md).

## Scope

### In Scope

- **Primitives (`src/components/ds-candidates/<Component>/`):** `<Button>`, `<Input>`, `<Kbd>`, `<Card>`, `<Tabs>`, `<CodeBlock>`, `<Breadcrumb>`. The mockup's "pill" use cases (filter, severity) are met by extending `<Badge>` with new variants in the design-system repo (Resolved §1) — no separate `<Pill>` primitive in this IMPL.
- **Portal composites (`src/components/portal/<Component>/`):** `<Topbar>` (lives in `src/root.tsx`'s Layout — shared by every route), Directory table + toolbar (`_index.tsx`), RFC sidebar + cross-RFC preview card (`$type.$id.tsx`), Search modal overlay (`search.tsx`).
- **Promotion:** batch-promote whichever primitives have hit the readiness checklist (used 2+ places, API stable, no portal-only deps) at the end of the primitive waves. Primitives used only once at promotion time stay in `ds-candidates/` until a second usage site materialises.
- **Tests:** per-primitive unit tests colocated with the candidate; per-composite render tests through `createRoutesStub` + the shared MSW handlers.

### Out of Scope

- **New routes** (`/api`, `/mcp`, `/frameworks`) and their sidebar/content composites. Each needs a data-source decision (parsed OpenAPI for `/api`; static content for `/mcp`; out-of-contract data for `/frameworks`) that should land as its own DESIGN or INV first. **Tracked separately** — likely a future IMPL-0005.
- **Icon set / icon library.** The mockup uses inline SVGs throughout. Primitives that need icons accept SVG children verbatim via `prefix` / `suffix` / `icon` slots (Resolved §3 — BYO for v1). Adopting a curated icon set or icon library is deferred.
- **Authoring UX** — read-only consumers only.
- **Performance optimisations** beyond the IMPL-0002 MSW-clean / IMPL-0003 Markdown-bundle-shape baselines. Bundle-size headroom for the new primitives is tracked but not actively budgeted in this IMPL.
- **Mockup-pixel-perfect parity.** Match structure + tokens; tiny spacing / radius / shadow tweaks are follow-ups not blockers.

## Approach

The phasing follows the build order recommended in [INV-0002 §Recommendation](../investigation/0002-inventory-components-needed-from-the-rfc-portal-mockup.md#build-order): primitives that unblock the most other components first, the always-on `<Topbar>` composite second so the rest of the views inherit it, then the remaining primitives, then promotion, then route-by-route composite upgrades.

Each phase is independent enough to ship as its own PR. Phases 4 (three primitives) and 6 (batch promotion) can run in parallel with neighbouring work once their prerequisites land. Phases 7-9 (composite upgrades to existing routes) gate on the relevant primitives but are independent of each other.

Authoring convention for every primitive is set in [DESIGN-0001 §The `ds-candidates/` contract](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md): one folder per component, `Component.tsx` + `Component.module.css` + `index.ts` + colocated `Component.test.tsx`, `forwardRef`, named exports, native DOM prop pass-through, `clsx` className merge, tokens-only CSS, no portal-only imports.

## Implementation Phases

Each phase is complete when all its tasks are checked off and its success criteria pass.

---

### Phase 1: ds-candidates authoring conventions + `<Button>`

Foundation phase. Lands the first candidate (`<Button>`) and the authoring conventions every later primitive follows. `<Button>` is the most-reused element in the mockup (~15+ instances across all 6 views) and is a dependency for Tabs, IconButton-style usages, and several composites.

#### Tasks

- [x] Add a `src/components/ds-candidates/README.md` refresher (or update the existing one) with the **authoring checklist**: folder shape, exports, ref-forwarding, prop pass-through, tokens-only CSS, no `portal/` imports, colocated test. Reference DESIGN-0001 §The `ds-candidates/` contract for the why.
- [ ] Create `src/components/ds-candidates/Button/`:
  - `Button.tsx` — `forwardRef`, native `<button>` prop pass-through, `clsx` className merge.
  - `Button.module.css` — tokens only.
  - `index.ts` — named export.
  - `Button.test.tsx` — colocated.
- [ ] **Props shape:**
  - `variant: "primary" | "secondary" | "ghost" | "icon"` (string union per DESIGN-0001 §API shape; default `"secondary"`).
  - `size: "sm" | "md" | "lg"` (default `"md"`).
  - `asChild?: boolean` for Radix Slot composition with RR7 `<Link>` (Resolved §2). Imports `@radix-ui/react-slot` — the single sanctioned Radix dep per CLAUDE.md Hard rules.
  - All standard `<button>` props (`type`, `disabled`, `aria-*`, `onClick`, …).
- [ ] **Visual treatment:** match the mockup's button styles (primary = filled accent; secondary = outlined; ghost = no chrome until hover; icon = square, padding-only). Use `--shadow-sm` from v0.3.0 on the primary variant's focus ring.
- [ ] **Disabled state** styled per the mockup's disabled-button treatment.
- [ ] **Focus-visible ring** using the design-system's `--color-accent` token; passes WCAG 2.1 AA contrast against `--color-bg`.
- [ ] **Tests** (colocated `Button.test.tsx`):
  - Renders each variant + size combo with the right `data-variant` / `data-size` attrs.
  - Forwards refs (`forwardRef` smoke test).
  - Forwards arbitrary props (`data-testid`, `aria-label`).
  - `className` merges, doesn't replace.
  - Click handler fires on `userEvent.click`.
  - Disabled state blocks click + applies `aria-disabled`.
  - `asChild` composes with `<Link>` and the rendered element is an `<a>` with the button's classes (Resolved §2).
- [ ] Wire `<Button>` into **one existing usage site** to validate the API in flight — e.g., replace the inline `<button>` in `src/routes/search.tsx`'s submit form, or add it to `<ThemeToggle>`'s trigger. Minimum two usages required before Phase 6 promotion.
- [ ] `just check` 100% green; no eslint or typecheck regressions.

#### Success Criteria

- `<Button>` renders all variants + sizes with mockup-matching visuals against both `data-theme="light"` and `data-theme="dark"`.
- Refs forward; props pass through; `className` merges.
- One existing portal call-site converted to `<Button>` for in-flight validation.
- 7+ tests in `Button.test.tsx`, all green.
- `just check` 100% green; `just build` clean.

---

### Phase 2: `<Input>` + `<Kbd>`

Two small companion primitives. Both gate Phase 3's `<Topbar>` (which uses `<Input>` as the search trigger and `<Kbd>` for the `⌘K` hint).

#### Tasks

- [ ] Create `src/components/ds-candidates/Input/`:
  - `Input.tsx` — `forwardRef<HTMLInputElement>`, native `<input>` prop pass-through.
  - `Input.module.css` — tokens only.
  - `index.ts`, `Input.test.tsx`.
- [ ] **`<Input>` props:**
  - All standard `<input>` props (`type`, `value`, `defaultValue`, `placeholder`, `disabled`, `aria-*`, …).
  - `size: "sm" | "md"` (default `"md"`).
  - `prefix?: React.ReactNode` — slot for a leading icon (rendered before the input).
  - `suffix?: React.ReactNode` — slot for a trailing `<Kbd>` hint (rendered after the input).
- [ ] **Visual treatment:** match the mockup's search input — slim border, subtle background, focus-visible ring matching `<Button>`'s.
- [ ] Create `src/components/ds-candidates/Kbd/`:
  - `Kbd.tsx` — renders a `<kbd>` with `forwardRef<HTMLElement>`.
  - `Kbd.module.css` — tokens only; use `--tracking-wider` (v0.3.0) for the uppercase mono feel.
  - `index.ts`, `Kbd.test.tsx`.
- [ ] **`<Kbd>` props:**
  - All standard HTML element props.
  - `size: "sm" | "md"` (default `"sm"`; the topbar hint is small).
- [ ] **Tests** for both: forwarding, className merge, variant/size attrs, prefix/suffix slot rendering for `<Input>`.
- [ ] Wire `<Kbd>` into Phase 3's `<Topbar>` (deferred to Phase 3) and into the **existing `/search` route's submit-button kbd hint** if appropriate.
- [ ] `just check` 100% green.

#### Success Criteria

- Both primitives render correctly against both themes.
- `<Input>` accepts prefix + suffix slots and they layout correctly with the native `<input>` element.
- Refs forward; native props pass through; className merges.
- 5+ tests per primitive (10+ total), all green.
- `just check` 100% green; `just build` clean.

---

### Phase 3: `<Topbar>` portal composite + `src/root.tsx` Layout wiring

User-visible swap. Lands the always-on topbar in the root Layout so every route inherits it; the `<ThemeToggle>` button migrates from per-route placement (currently in `_index.tsx`, `$type.$id.tsx`, `search.tsx`) into the topbar. Portal-only — never promoted.

#### Tasks

- [ ] Create `src/components/portal/Topbar/`:
  - `Topbar.tsx`, `Topbar.module.css`, `index.ts`, `Topbar.test.tsx`.
- [ ] **Layout:** 3-col CSS grid — left brand, centered search trigger (`<Input>` rendered read-only with the `<Kbd>` `⌘K` suffix, opens the search modal on click — see Phase 9), right `<ThemeToggle>` + nav links. Sticky via `position: sticky; top: 0; z-index: var(--z-sticky)` (v0.3.0 token).
- [ ] **Brand area:** "rfc-site" wordmark linking to `/`; uses `--tracking-tighter` (v0.3.0) for the display feel.
- [ ] **Search trigger:** clicking the topbar `<Input>` opens the Phase 9 search modal. For now (Phase 3), wire it as a `<Link to="/search">` so the trigger is functional even before the modal lands.
- [ ] **Nav slot:** placeholder links for the three future routes (`API`, `MCP`, `Frameworks`) marked `aria-disabled` / `<span>` so they're visible but inert until those routes exist. Easier to dial in spacing now than retrofit later.
- [ ] **Wire into `src/root.tsx`'s Layout:**
  - `<Topbar />` rendered above `<Outlet />`.
  - `<ThemeToggle>` removed from `_index.tsx`, `$type.$id.tsx`, `search.tsx` headers.
- [ ] **Existing route headers** trimmed of duplicate breadcrumb/title chrome where the topbar now covers it.
- [ ] **Tests** for `<Topbar>` (`Topbar.test.tsx`): brand link target, search trigger link target, `<ThemeToggle>` present, nav placeholder rendering, sticky `data-*` attr.
- [ ] **Existing route render tests** updated: remove `<ThemeToggle>` assertions from per-route tests, add a single Layout-level assertion in a new `tests/api/rootLayout.test.tsx` (or extend `tests/api/indexRouteRender.test.tsx` since it'll catch the layout via `createRoutesStub`).
- [ ] **Keyboard shortcut wiring** for `⌘K`: bind globally so pressing it focuses the search trigger / opens the modal. Stubbed for Phase 3 (just navigate to `/search`); fully wired in Phase 9.
- [ ] `just check` 100% green; `just build` clean.

#### Success Criteria

- Topbar visible on every route with brand + search trigger + theme toggle.
- `<ThemeToggle>` is no longer duplicated across three routes.
- `⌘K` keyboard shortcut navigates to `/search` (Phase 9 will upgrade to a modal).
- Topbar is sticky; respects the `--z-sticky` token.
- All existing route render tests still green; new Topbar tests added.

---

### Phase 4: `<Card>` + `<Tabs>` + `<CodeBlock>`

Three primitives that author independently. Each is small enough to be a single-file folder + test. Together they unblock the bulk of the deferred API and MCP route content; in the meantime, `<Card>` is reused by the Phase 8 RFC sidebar metadata blocks.

#### Tasks — `<Card>`

- [ ] Create `src/components/ds-candidates/Card/`:
  - `Card.tsx`, `Card.module.css`, `index.ts`, `Card.test.tsx`.
- [ ] **Props:**
  - `variant: "flat" | "elevated"` (default `"flat"`; `"elevated"` uses `--shadow-sm`).
  - `padding: "sm" | "md" | "lg"` (default `"md"`).
  - Native `<div>` prop pass-through.
  - `asChild` slot for composing with `<section>` / `<article>` / `<Link>` (Resolved §2 — uses `@radix-ui/react-slot`, same as `<Button>`).
- [ ] **Composable sub-components** `<Card.Header>` / `<Card.Body>` / `<Card.Footer>` (Resolved §4 — sub-components over loose CSS classes for the explicit DX).
- [ ] Tests: variant + padding combos, sub-component composition, refs + className merge.

#### Tasks — `<Tabs>`

- [ ] Create `src/components/ds-candidates/Tabs/`:
  - `Tabs.tsx`, `Tabs.module.css`, `index.ts`, `Tabs.test.tsx`.
- [ ] **API shape:** uncontrolled root with `defaultValue`, controlled via `value` + `onValueChange`. Sub-components `<Tabs.List>`, `<Tabs.Trigger value="…">`, `<Tabs.Content value="…">` — Radix-style composition without pulling Radix Tabs in (we have one sanctioned Radix dep, `@radix-ui/react-slot`, per CLAUDE.md Hard rules).
- [ ] **Keyboard:** arrow-key navigation between triggers per WAI-ARIA Tabs pattern.
- [ ] **URL state:** opt-in via a `urlParam?: string` prop (Resolved §5). When set, tab state syncs to `?<urlParam>=<value>` via RR7's `useSearchParams`; when omitted, state is local. Callers like the API examples page opt in for shareable links.
- [ ] Tests: switching tabs via click + keyboard, active state attr, content visibility, refs forward.

#### Tasks — `<CodeBlock>`

- [ ] Create `src/components/ds-candidates/CodeBlock/`:
  - `CodeBlock.tsx`, `CodeBlock.module.css`, `index.ts`, `CodeBlock.test.tsx`.
- [ ] **Props:**
  - `code: string` (required).
  - `language?: string` (defaults to `"text"`).
  - `showCopy?: boolean` (default `true`).
  - `label?: string` (display label, e.g., `"curl"`).
- [ ] **Highlighting:** uses `@shikijs/rehype`'s peer `shiki` directly (already a transitive dep via `@shikijs/rehype`) — synchronous `codeToHtml` since this is standalone usage, no async-Shiki / `<MarkdownHooks>` wrapper needed. Match the dual-theme config from `src/portal/markdown/pipeline.ts` (`github-light` / `github-dark` with the design-system `--color-code-*` chrome).
- [ ] **Distinct from `src/portal/markdown/components/Code.tsx`** — that one is page-bound to `<DocumentView>` and consumes hast from the unified pipeline. This one is the standalone primitive for non-Markdown contexts (API examples, MCP setup snippets).
- [ ] **Copy button:** uses Phase 1's `<Button variant="ghost" size="sm">`. Calls `navigator.clipboard.writeText(code)`; flashes a "Copied" state for ~1.5s.
- [ ] Tests: renders highlighted output, copy button triggers `navigator.clipboard.writeText`, language label rendering, hides copy button when `showCopy={false}`.

#### Success Criteria

- All three primitives render correctly against both themes.
- `<Card variant="elevated">` shows the `--shadow-sm` drop shadow.
- `<Tabs>` keyboard nav passes WAI-ARIA Tabs spec.
- `<CodeBlock>` highlights code synchronously without throwing; copy button works in jsdom (mock `navigator.clipboard`).
- 6+ tests per primitive (18+ total), all green.
- `just check` 100% green; `just build` clean. Note any bundle-size delta from Shiki being reused vs newly loaded for standalone CodeBlock.

---

### Phase 5: `<Breadcrumb>` + `<Badge>` extension (filter / severity variants)

Last primitive wave. `<Breadcrumb>` is straightforward; the filter-pill + severity-pill needs are met by **extending `<Badge>` with new variants** in the design-system repo rather than shipping a sibling `<Pill>` primitive (Resolved §1).

#### Tasks — `<Breadcrumb>`

- [ ] Create `src/components/ds-candidates/Breadcrumb/`:
  - `Breadcrumb.tsx`, `Breadcrumb.module.css`, `index.ts`, `Breadcrumb.test.tsx`.
- [ ] **API shape:** root `<Breadcrumb>` + sub-component `<Breadcrumb.Item href?="…" param?: boolean>`. Renders an ordered list with `aria-label="Breadcrumb"`.
- [ ] **Path-param styling:** `<Breadcrumb.Item param>` sets `data-param="true"`; CSS targets the data attribute for the mockup's monospace + accent treatment on `{type}` / `{id}` segments (Resolved §6 — attribute prop over a separate sub-component, simpler API).
- [ ] Tests: link items render as `<a>`; last item is plain text (no link); `param` items render with the `data-param` attribute + styling.

#### Tasks — `<Badge>` extension (in `../design-system`)

- [ ] In the design-system repo: add `variant: "status" | "filter" | "severity"` to `<Badge>` (default stays `"status"` for backward compatibility — existing rfc-site call-sites unaffected). Each variant maps to a distinct palette.
  - `status` — current behaviour (Draft / Proposed / Accepted / …) backed by `--color-status-*`.
  - `filter` — selected/unselected states for the Phase 9 search-modal filter pills. Adds an `aria-pressed`-friendly `selected?: boolean` prop or accepts a click handler — finalise the API in the design-system PR.
  - `severity` — critical / high / medium / low for the Frameworks rules view, also backed by `--color-status-*`.
- [ ] Add tests for each variant in the design-system's `tests/primitives/Badge.test.tsx`.
- [ ] Add a changeset (minor bump). The Phase 6 batch promotion will ride this same minor release (or it lands as a patch ahead of Phase 6 if convenient).
- [ ] **No new `ds-candidate` folder** in rfc-site — the extension is upstream-only.

#### Success Criteria

- `<Breadcrumb>` renders the mockup's path display with path-param styling against both themes.
- `<Badge>` ships with `filter` + `severity` variants in the design-system repo; existing `status` call-sites unaffected.
- 4+ tests for `<Breadcrumb>` in `ds-candidates/Breadcrumb/Breadcrumb.test.tsx`; new `<Badge>` variant tests added to the design-system's `tests/primitives/Badge.test.tsx`. All green in both repos.
- `just check` 100% green; `just build` clean.

---

### Phase 6: Promote stabilized primitives to `@donaldgifford/design-system`

Batch promotion of the candidates that have hit the [readiness checklist](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md#the-ds-candidates-contract): used 2+ places, API stable, no portal-only deps. Primitives still used in only one place (or with API churn risk) stay in `ds-candidates/` until a second usage site lands.

#### Tasks

- [ ] **Readiness audit** — score each Phase 1-5 candidate against the checklist. Document the call per primitive in this phase's PR description.
  - Likely promoted: `<Button>` (used everywhere), `<Input>` (topbar + search + future API params), `<Kbd>` (topbar + search), `<Card>` (RFC sidebar + future MCP/API).
  - Likely stays in `ds-candidates/` (used only once at this point): `<CodeBlock>` (future MCP/API only), `<Tabs>` (future API/MCP only), `<Breadcrumb>` (Frameworks only).
  - The `<Badge>` extension (Phase 5) ships via its own design-system release independent of this batch.
  - Final promotion list confirmed in the audit; promotion is batched in one design-system PR per Resolved §12.
- [ ] **For each promoted primitive** (per [DESIGN-0001 §Promotion workflow](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md) + CLAUDE.md §Promotion workflow):
  - In the design-system repo (`../design-system`): `cp -r src/components/ds-candidates/<Component>/` → `src/primitives/<Component>/` (excluding the colocated `.test.tsx`), `git mv` the test into `tests/primitives/<Component>.test.tsx`, update `src/index.ts`, run lint/typecheck/test/build, add a changeset.
  - In `../design-system` ship one changeset PR with all the batch promotions (minor bump, e.g., `0.3.0` → `0.4.0`).
- [ ] **Once the design-system release lands** (changesets bot + publish workflow):
  - Bump `package.json`: `^0.3.0` → `^0.4.0`.
  - `rm node_modules/@donaldgifford/design-system && bun install` (per the CLAUDE.md flow now that `bun unlink` isn't implemented).
  - Swap candidate imports for package imports across the portal: `src/components/ds-candidates/<C>/` → `@donaldgifford/design-system`.
  - Delete the now-promoted `src/components/ds-candidates/<C>/` folders.
- [ ] **Sanity sweep:** `just check`; `just build`; visual diff on each route in `just dev-msw`.

#### Success Criteria

- Promoted primitives shipped in `@donaldgifford/design-system` and consumed via package imports across the portal.
- `src/components/ds-candidates/` cleared of promoted entries; non-promoted primitives stay until a second usage site.
- Zero visual regressions vs the pre-promotion state.
- `just check` 100% green; `just build` clean (bundle should *shrink* slightly since the design-system tree is already deduped).

---

### Phase 7: Directory table + toolbar upgrade (`_index.tsx`)

Replaces the current card grid in `_index.tsx` with the mockup's table shape: number cell, title + labels, status badge, authors, updated dateline. Toolbar above the table has filter triggers + sort + results count.

#### Tasks

- [ ] **Update `_index.tsx`:** loader stays the same (`listDocs` + `Link`-header pagination); the rendering swaps from `<DocCard>` grid to a `<table>` element. `<DocCard>` stays in `src/components/portal/` for now; may be deleted in a follow-up if nothing else uses it.
- [ ] **Add `src/components/portal/DirectoryTable/`** as a portal composite:
  - `DirectoryTable.tsx` — accepts `documents: Document[]` + `meta: { count, hasNext }` props. Renders the table.
  - `DirectoryToolbar.tsx` — accepts `filters`, `sort`, `onFilterChange`, `onSortChange` props. Uses `<Button>`, `<Input>`, `<Pill>` (or `<Badge>` filter variant) primitives.
  - `.module.css` files; `index.ts`.
- [ ] **Toolbar functionality:**
  - **Filter triggers** use native `<details>`/`<summary>` for the dropdown surface (Resolved §7 — defer the Popover primitive until Phase 9 confirms it's needed for the search-modal preview-pane positioning).
  - **Sort** dropdown with `updated_desc` / `updated_asc` / `id_desc` / `id_asc` — same `<details>` shape.
  - **Filter + sort state in the URL** (`?filter=type:rfc&sort=updated_desc`) so refresh / share / back-button works. RR7's `useSearchParams` provides this.
  - **Results count** — total fixtures available pre-filter, then `(N of M shown)` post-filter.
- [ ] **OpenAPI contract verification** (prerequisite — must complete before authoring tasks below): confirm `rfc-api`'s `listDocs` accepts `?filter=` / `?sort=` query params per `api/openapi.yaml`. If yes, regenerate the orval client and proceed. If no, raise a contract change upstream in `rfc-api` and pause Phase 7 until that lands. (Was Open Question §8.)
- [ ] **Loader update:** parse the new URL params and forward to `listDocs` once the contract is verified.
- [ ] **Tests:**
  - `tests/api/indexRoute.test.ts` — loader handles filter + sort params.
  - `tests/api/indexRouteRender.test.tsx` — table renders rows; toolbar interactions update URL + trigger reload.
- [ ] **Card grid removed** from the live route; `<DocCard>` retained in `src/components/portal/DocCard/` through this phase (Resolved §13 — schedule deletion in a follow-up PR ~2 weeks after this phase ships if no second usage materialises).

#### Success Criteria

- `/` renders the table shape from the mockup with all current fixture corpus surfaced.
- Filter + sort affect the visible rows and persist via URL params.
- Existing `_index` loader + render tests updated and green; new toolbar interaction tests added.
- `just check` 100% green; `just build` clean.

---

### Phase 8: RFC sidebar + cross-RFC preview card (`$type.$id.tsx`)

Two-column layout per the mockup: left metadata sidebar (status / author / created / updated / revision / PR link + labels) + right prose. Plus a hover preview card overlay for cross-RFC links (composed with the existing `<Anchor>` from `src/portal/markdown/components/`).

#### Tasks

- [ ] **Update `$type.$id.tsx`:** wrap the existing chrome + `<DocumentView>` in a two-column grid layout. Loader unchanged.
- [ ] **Add `src/components/portal/DocSidebar/`** — accepts the `Document` payload + renders metadata blocks (using `<Card>` for each block: Status / Authors / Created / Updated / Revision / Source).
- [ ] **Add `src/components/portal/RFCPreviewCard/`** — popover-style hover card.
  - Listens to a custom `onPreview` callback exposed by `<Anchor>` (extending `src/portal/markdown/components/Anchor.tsx`).
  - Fetches the target document's metadata on first hover (`getDoc` orval hook with cache via TanStack Query).
  - Renders `<Card variant="elevated">` containing the doc's id + title + status `<Badge>` + authors + date.
  - **Accessibility:** triggers on **hover and focus** (Resolved §9 — focus support is the a11y baseline; a small open-delay debounces accidental keyboard triggers). Closes on `esc` and on focus leaving the link.
  - **Positioning:** **CSS-only positioner** for v1 (Resolved §10 — `position: absolute` anchored to the link with sensible left/right flip via `data-side` attr). If the simpler approach gets squirrely against viewport edges or scroll containers, swap in `@floating-ui/react` as a follow-up.
- [ ] **`<Anchor>` extension:** add a Phase 8 prop `previewable?: boolean` (default `true` for resolved-internal links). When `true`, wraps the link in a `<RFCPreviewCard target={...}>` so the popover hydrates on hover/focus.
- [ ] **Sidebar styling** uses `--shadow-sm` (v0.3.0) for the elevated metadata blocks. Labels use `--tracking-wider` (v0.3.0) for the uppercase mono feel.
- [ ] **Tests:**
  - `tests/portal/markdown/components/Anchor.test.tsx` — new case: previewable internal link wraps in `<RFCPreviewCard>`.
  - `tests/portal/components/RFCPreviewCard.test.tsx` — hover/focus opens, click navigates, escape closes.
  - `tests/portal/components/DocSidebar.test.tsx` — renders all metadata blocks with the payload.
  - `tests/api/docPageRender.test.tsx` — full-render sees sidebar + prose laid out side-by-side.

#### Success Criteria

- RFC page renders the two-column mockup layout against both themes.
- Cross-RFC links in the body show a preview popover on hover + focus.
- Existing `$type.$id` tests still green; new sidebar + preview-card tests added.
- `just check` 100% green; `just build` clean.

---

### Phase 9: Search modal upgrade (`search.tsx`)

Upgrades the minimal `/search` page (IMPL-0003 Phase 7) into the mockup's full-page modal: filter pills, grouped results, preview pane, keyboard-hint footer. The existing URL-driven `/search` stays as the no-JS fallback and as the destination for the topbar trigger / `⌘K` keyboard shortcut.

#### Tasks

- [ ] **`<SearchModal>` portal composite** at `src/components/portal/SearchModal/`:
  - Renders as a fixed-position overlay using `--z-overlay` (v0.3.0) over a backdrop with `--shadow-lg`.
  - Hosts the existing `searchDocs` call (extracted from the current route) so it works in both modal + standalone-route modes.
  - Filter pills (all / titles / body / authors / labels) using the Phase 5 `<Pill>` filter variant.
  - Results grouped by document type (RFCs, ADRs, …) with sticky group headers.
  - Side preview pane on hover: shows the full snippet + a "Open" link to the doc page.
  - Footer: keyboard hints using `<Kbd>` (`↑↓` navigate, `↵` open, `esc` close).
- [ ] **`⌘K` global shortcut:** opens the modal from any route. Bind in `src/root.tsx` after `<Topbar>` mounts.
- [ ] **Modal-vs-route reconciliation:**
  - Direct nav to `/search` still works (no-JS friendly).
  - Opening the modal sets `?modal=1` on the current URL (Resolved §11) so the back button closes the modal and refresh re-opens it. The existing `q` / filter params on `/search` continue to round-trip via the URL.
- [ ] **Accessibility:** focus-trap inside the modal; `aria-modal="true"`; `<dialog>` element (native) if browser support is fine, else a focus-trap polyfill. Confirm jsdom test compatibility.
- [ ] **Tests:**
  - `tests/portal/components/SearchModal.test.tsx` — opens on `⌘K`, closes on `esc` / click-outside, filter pills affect results, preview pane shows the hovered hit.
  - `tests/api/searchRouteRender.test.tsx` — the URL-driven `/search` route still works as a no-JS fallback.

#### Success Criteria

- `⌘K` opens the modal from any route; `esc` / outside-click closes it.
- Filter pills narrow the visible results.
- Preview pane shows the selected hit's snippet.
- Direct nav to `/search` continues to work (no-JS path preserved).
- All keyboard interactions pass WAI-ARIA Dialog spec.
- `just check` 100% green; `just build` clean.

---

## File Changes

| File / Folder | Action | Phase | Description |
|---|---|---|---|
| `src/components/ds-candidates/README.md` | Modify | 1 | Authoring conventions refresher. |
| `src/components/ds-candidates/Button/**` | Create | 1 | First primitive — Button.tsx + .module.css + index.ts + .test.tsx. |
| `src/components/ds-candidates/Input/**` | Create | 2 | |
| `src/components/ds-candidates/Kbd/**` | Create | 2 | |
| `src/components/portal/Topbar/**` | Create | 3 | Portal composite. |
| `src/root.tsx` | Modify | 3 | Mount `<Topbar>` in Layout; remove per-route ThemeToggle usage. |
| `src/routes/_index.tsx`, `$type.$id.tsx`, `search.tsx` | Modify | 3 | Remove duplicate `<ThemeToggle>`; trim header chrome. |
| `src/components/ds-candidates/{Card,Tabs,CodeBlock}/**` | Create | 4 | Three primitives in parallel. |
| `src/components/ds-candidates/Breadcrumb/**` | Create | 5 | |
| `src/components/ds-candidates/Pill/**` | Create | 5 | Conditional on §1 = sibling primitive. |
| `../design-system/src/primitives/<C>/**` | Create | 6 | Per-primitive promotion in the design-system repo. |
| `package.json` | Modify | 6 | Bump `@donaldgifford/design-system` to the new minor. |
| Promoted `ds-candidates/<C>/` folders | Delete | 6 | After call-sites swapped to package imports. |
| `src/components/portal/DirectoryTable/**`, `DirectoryToolbar/**` | Create | 7 | |
| `src/routes/_index.tsx`, `_index.module.css` | Modify | 7 | Card grid → table; URL params for filter/sort. |
| `src/components/portal/DocSidebar/**`, `RFCPreviewCard/**` | Create | 8 | |
| `src/routes/$type.$id.tsx`, `$type.$id.module.css` | Modify | 8 | Two-column layout. |
| `src/portal/markdown/components/Anchor.tsx` | Modify | 8 | Add `previewable` integration. |
| `src/components/portal/SearchModal/**` | Create | 9 | |
| `src/routes/search.tsx` | Modify | 9 | Extract search logic; reconcile modal-vs-route. |
| `src/root.tsx` | Modify | 9 | Global `⌘K` binding for the modal. |
| `tests/portal/components/**`, `tests/api/**` | Create/Modify | per phase | Render + interaction tests per the Testing Plan. |
| `CLAUDE.md` | Modify | per phase | Per-phase repo-state updates as primitives + composites ship. |

## Testing Plan

- **Per-primitive (Phases 1-5):** colocated `Component.test.tsx` with 5-8 cases covering variants, sizes, prop pass-through, ref forwarding, className merge, keyboard interactions where applicable. Follow the patterns already in `tests/portal/markdown/components/` + the design-system repo's `tests/primitives/Badge.test.tsx`.
- **Per-portal-composite (Phases 3, 7-9):** render tests via `createRoutesStub` for route-level integration; component-level RTL tests for interactive state (filter selection, modal open/close, hover preview).
- **Promotion sanity (Phase 6):** visual diff sweep against `just dev-msw` for every promoted primitive's call-sites.
- **CI parity:** `just check` (typecheck + lint + format-check + tests) is the bar for every phase's PR. `just build` clean for every phase. Bundle-size monitoring lives in the PR description, not a hard gate (the new primitives + composites add real JS to the wire that can't be avoided).
- **`testTimeout: 15000`** in `vitest.config.ts` (landed during IMPL-0003 post-merge) covers Shiki cold starts; any new async-Shiki integration tests should fit comfortably inside that.

## Dependencies

- **Hard, already shipped:**
  - `@donaldgifford/design-system@0.3.0` — shadow / tracking / z token groups required by `<Card>`, `<Topbar>`, `<SearchModal>`.
  - `clsx@2` (already a runtime dep) — primitive `className` merge.
- **Hard, new (Phase 1):**
  - `@radix-ui/react-slot` — required for the `asChild` pattern on `<Button>` and `<Card>` (Resolved §2). The single sanctioned Radix dep per CLAUDE.md Hard rules; `bun add @radix-ui/react-slot` lands in Phase 1.
- **Soft / future:**
  - `shiki` direct usage in `<CodeBlock>` (Phase 4). Already a transitive dep via `@shikijs/rehype`; verify the version pin matches and add `shiki` as a direct runtime dep in `package.json` if the resolution feels brittle.
  - Popover positioner: **CSS-only for v1** (Resolved §10). `@floating-ui/react` deferred to a follow-up if Phase 8 / Phase 9 hit viewport-edge or scroll-container edge cases that CSS can't handle.
- **Icons:** BYO via `prefix` / `suffix` / `icon` slots — primitives accept arbitrary `ReactNode` (Resolved §3). No icon library / curated set introduced in this IMPL; revisit if duplication piles up.
- **Cross-repo:**
  - Phase 5 + Phase 6 each cut a `@donaldgifford/design-system` release. Phase 5's release adds the `<Badge>` filter / severity variants (Resolved §1); Phase 6's is the batch promotion of stabilized candidates (Resolved §12). Both ship via the design-system's changeset + publish workflow; coordinate version bumps with the consuming PRs in rfc-site so versions don't sit unused.
- **Upstream / contract:**
  - **Phase 7 prerequisite (was Open Question §8):** verify `rfc-api`'s `listDocs` endpoint accepts `?filter=` / `?sort=` against `api/openapi.yaml`. If absent, raise a contract change upstream in `rfc-api` and pause Phase 7's authoring tasks until the contract lands and is regenerated locally via `just gen-api`. Loader-side parsing in Phase 7's tasks lists this as a blocker.

## Resolved Questions

All decisions made up-front by the reviewer on 2026-05-11. Captured here for the record and so future readers can see *why* each phase looks the way it does. If any of these need to flip mid-IMPL, raise it as a new entry rather than silently editing the affected phase.

1. **`<Pill>` — extend `<Badge>` with new variants.** The mockup uses pills for status (current `<Badge>` job), filter chips (search modal), and severity (Frameworks rules). Resolution: extend `<Badge>` with `variant: "status" | "filter" | "severity"` in the design-system repo (Phase 5) rather than ship a sibling `<Pill>` primitive. Smaller surface, less duplication, existing `<Badge>` call-sites unaffected (default stays `"status"`).

2. **`asChild` (Radix Slot) for `<Button>` and `<Card>` — yes.** Imports `@radix-ui/react-slot` (sanctioned per CLAUDE.md Hard rules — the single allowed Radix dep). Proven pattern, no `<ButtonLink>` / `<CardLink>` surface duplication. Phase 1 lands the dep.

3. **Icon strategy — BYO via slots.** Primitives that need icons accept arbitrary `ReactNode` via `prefix` / `suffix` / `icon` props. No icon library or curated portal-internal set introduced in this IMPL. Revisit if duplication piles up across phases.

4. **`<Card>` sub-components — ship.** `<Card.Header>` / `<Card.Body>` / `<Card.Footer>` over loose CSS classes. Phase 4 authors all three sub-components.

5. **`<Tabs>` URL state — opt-in.** Default to local state; expose a `urlParam?: string` prop that, when set, syncs the active tab to `?<urlParam>=<value>` via RR7's `useSearchParams`. The API-examples page (deferred to a future IMPL) opts in for shareable `?lang=ts`-style links.

6. **`<Breadcrumb>` path-param API — attribute prop.** `<Breadcrumb.Item param>` sets `data-param="true"`; CSS targets the data attribute. Simpler than a separate `<Breadcrumb.Param>` sub-component.

7. **Phase 7 toolbar dropdowns — `<details>` for v1.** Native `<details>` / `<summary>` for the filter + sort triggers. A dedicated Popover primitive lands in Phase 9 only if the search-modal preview pane needs it; if Phase 7's `<details>` proves clunky in practice, the Popover backport happens then.

8. **Phase 7 `listDocs` filter + sort contract — verify upstream first.** Action item, not a design choice. Confirm `api/openapi.yaml` includes `?filter=` / `?sort=` query params on `listDocs` before Phase 7's authoring tasks start. If absent, contract change upstream in `rfc-api` blocks the phase. Recorded in Dependencies §Upstream / contract.

9. **Phase 8 preview card trigger — hover + focus.** Focus support is the a11y baseline (keyboard users need access to the preview too). A small open-delay (~150ms) debounces accidental triggers. Closes on `esc` and on focus leaving the link.

10. **Phase 8 / 9 popover positioning — CSS-only for v1.** `position: absolute` anchored to the trigger element with a `data-side` attr for left/right flip. If viewport-edge / scroll-container edge cases bite, swap in `@floating-ui/react` as a follow-up; not adopted up-front.

11. **Phase 9 modal-vs-route URL — `?modal=1` overlay.** Opening the modal sets `?modal=1` on the current URL; back button closes the modal and refresh re-opens it. Existing `q` / filter params on `/search` continue to round-trip via the URL.

12. **Promotion cadence — batch in Phase 6.** One design-system release covers all stabilized primitives, with the post-release version bump + import swap happening in a single rfc-site PR. Smaller primitive set + fixed promotion ceremony cost favours batching over per-primitive release churn.

13. **`<DocCard>` lifecycle — keep through Phase 7.** Once the table ships, `<DocCard>` is unused but not deleted. Follow-up PR scheduled for ~2 weeks after Phase 7 lands; if a second usage site materialises (e.g., a future "card view toggle" feature) we keep it indefinitely.

## References

In this repo:

- [INV-0002 — Inventory components needed from the rfc-portal mockup](../investigation/0002-inventory-components-needed-from-the-rfc-portal-mockup.md) — the inventory + build order this IMPL implements.
- [DESIGN-0001 — Portal architecture and `ds-candidates` promotion model](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md) — load-bearing convention for every primitive in this IMPL.
- [INV-0001 — Ship CSS Modules from design-system tsup build](../investigation/0001-ship-css-modules-from-design-system-tsup-build.md) — prefixed-global-class shape that new primitives' CSS Modules follow on promotion (Phase 6).
- [IMPL-0001 — Bootstrap the portal scaffold](./0001-bootstrap-portal-scaffold-per-design-0001.md) — `<Badge>` promotion (Phase 5/6) is the precedent for Phase 6's batch promotion in this IMPL.
- [IMPL-0003 — Wire up the Markdown rendering pipeline](./0003-wire-up-the-markdown-rendering-pipeline-per-design-0002.md) — Phase 8's `<Anchor>` extension builds on the existing `src/portal/markdown/components/Anchor.tsx`; Phase 9's modal builds on the `/search` route shipped in IMPL-0003 Phase 7.
- [`CLAUDE.md` §Promotion workflow](../../CLAUDE.md) — the operative procedure for Phase 6.
- [`CLAUDE.md` §Hard rules](../../CLAUDE.md) — anti-patterns to refuse; in particular the no-blanket-component-library rule (only `@radix-ui/react-slot` is sanctioned).
- [`api/openapi.yaml`](../../api/openapi.yaml) — Phase 7 verifies filter/sort support against this contract before authoring.

External:

- [`donaldgifford/design-system/rfc-portal-mockup_15.html`](https://github.com/donaldgifford/design-system/blob/main/rfc-portal-mockup_15.html) — visual reference.
- [`@donaldgifford/design-system` CHANGELOG](https://github.com/donaldgifford/design-system/blob/main/CHANGELOG.md) — v0.3.0 token additions consumed across this IMPL.
- [WAI-ARIA Authoring Practices — Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) — keyboard contract for `<Tabs>` (Phase 4).
- [WAI-ARIA Authoring Practices — Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) — keyboard + focus contract for `<SearchModal>` (Phase 9).
