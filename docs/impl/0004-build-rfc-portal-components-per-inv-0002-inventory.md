---
id: IMPL-0004
title: "Build rfc-portal components per INV-0002 inventory"
status: Draft
author: Donald Gifford
created: 2026-05-11
---
<!-- markdownlint-disable-file MD025 MD041 -->

# IMPL 0004: Build rfc-portal components per INV-0002 inventory

**Status:** In flight — 7 of 9 phases shipped on `feat/components` as of 2026-05-08; remaining items gate on cross-repo coordination.
**Author:** Donald Gifford
**Date:** 2026-05-11

## Phase status snapshot (2026-05-08)

| Phase | Status | Notes |
|---|---|---|
| 1 — `<Button>` + authoring conventions | ✅ Shipped | 9 tests. |
| 2 — `<Input>` + `<Kbd>` | ✅ Shipped | 13 tests across both. |
| 3 — `<Topbar>` | ✅ Shipped | 7 tests (now 7 incl. Phase 9a updates). |
| 4 — `<Card>` + `<Tabs>` + `<CodeBlock>` | ✅ Shipped | 18 tests across all three. |
| 5 — `<Breadcrumb>` (in-repo) + `<Badge>` filter/severity (upstream) | ✅ Shipped | 6 in-repo tests; upstream branch `feat/badge-filter-severity-variants` (commit `3c0f1d1`). |
| 6 — Batch promotion | ✅ 4 of 4 promoted | `<Kbd>` + `<Input>` + `<Card>` + `<Button>` promoted (design-system commits `e66886a` + `ca47c3a` + `05bf8c1` + `c84eec2`, consumed via `bun link` against the local 0.4.0-pre branch). All four promotable ds-candidates cleared from `src/components/ds-candidates/`. |
| 7a — `<DirectoryTable>` | ✅ Shipped | 5 tests. |
| 7b — `<DirectoryToolbar>` (filter+sort URL state) | 🔴 Blocked | Upstream `rfc-api` contract change required for `listDocs?filter=…&sort=…`. |
| 8a — `<DocSidebar>` + two-column layout | ✅ Shipped | 7 tests. |
| 8b — `<RFCPreviewCard>` + `<Anchor>` extension | ✅ Shipped | 5 + 1 tests. |
| 9a — `<SearchModal>` + `⌘K` wiring | ✅ Shipped | 7 + 3 tests. |
| 9b — Filter pills / grouped results / preview pane / focus-trap polish / `?modal=1` | 🟡 Deferred | Filter pills gate on design-system `0.4.0` release; rest are follow-up polish. |

**Coverage:** 171 tests across 30 files; `just check` 100% green; production build clean (server bundle 79.31 kB / 21.28 kB gzip).


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
- [x] Create `src/components/ds-candidates/Button/`:
  - `Button.tsx` — `forwardRef`, native `<button>` prop pass-through, `clsx` className merge.
  - `Button.module.css` — tokens only.
  - `index.ts` — named export.
  - `Button.test.tsx` — colocated.
- [x] **Props shape:**
  - `variant: "primary" | "secondary" | "ghost" | "icon"` (string union per DESIGN-0001 §API shape; default `"secondary"`).
  - `size: "sm" | "md" | "lg"` (default `"md"`).
  - `asChild?: boolean` for Radix Slot composition with RR7 `<Link>` (Resolved §2). Imports `@radix-ui/react-slot` — the single sanctioned Radix dep per CLAUDE.md Hard rules.
  - All standard `<button>` props (`type`, `disabled`, `aria-*`, `onClick`, …).
- [x] **Visual treatment:** match the mockup's button styles (primary = filled accent; secondary = outlined; ghost = no chrome until hover; icon = square, padding-only). Use `--shadow-sm` from v0.3.0 on the primary variant's focus ring.
- [x] **Disabled state** styled per the mockup's disabled-button treatment.
- [x] **Focus-visible ring** using the design-system's `--color-accent` token; passes WCAG 2.1 AA contrast against `--color-bg`.
- [x] **Tests** (colocated `Button.test.tsx`):
  - Renders each variant + size combo with the right `data-variant` / `data-size` attrs.
  - Forwards refs (`forwardRef` smoke test).
  - Forwards arbitrary props (`data-testid`, `aria-label`).
  - `className` merges, doesn't replace.
  - Click handler fires on `userEvent.click`.
  - Disabled state blocks click + applies `aria-disabled`.
  - `asChild` composes with `<Link>` and the rendered element is an `<a>` with the button's classes (Resolved §2).
- [x] Wire `<Button>` into **one existing usage site** to validate the API in flight — `src/routes/search.tsx` submit button now uses `<Button variant="primary">`; the bespoke `.submit` styles in `search.module.css` were trimmed to layout-only. _One usage site so far; minimum two required before Phase 6 promotion — Phase 3's `<Topbar>` will be the second._
- [x] `just check` 100% green; no eslint or typecheck regressions.

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

- [x] Create `src/components/ds-candidates/Input/`:
  - `Input.tsx` — `forwardRef<HTMLInputElement>`, native `<input>` prop pass-through.
  - `Input.module.css` — tokens only.
  - `index.ts`, `Input.test.tsx`.
- [x] **`<Input>` props:**
  - All standard `<input>` props (`type`, `value`, `defaultValue`, `placeholder`, `disabled`, `aria-*`, …).
  - `size: "sm" | "md"` (default `"md"`).
  - `prefix?: React.ReactNode` — slot for a leading icon (rendered before the input).
  - `suffix?: React.ReactNode` — slot for a trailing `<Kbd>` hint (rendered after the input).
- [x] **Visual treatment:** match the mockup's search input — slim border, subtle background, focus-visible ring matching `<Button>`'s.
- [x] Create `src/components/ds-candidates/Kbd/`:
  - `Kbd.tsx` — renders a `<kbd>` with `forwardRef<HTMLElement>`.
  - `Kbd.module.css` — tokens only; use `--tracking-wider` (v0.3.0) for the uppercase mono feel.
  - `index.ts`, `Kbd.test.tsx`.
- [x] **`<Kbd>` props:**
  - All standard HTML element props.
  - `size: "sm" | "md"` (default `"sm"`; the topbar hint is small).
- [x] **Tests** for both: forwarding, className merge, variant/size attrs, prefix/suffix slot rendering for `<Input>`. 8 tests for `<Input>`, 5 for `<Kbd>`.
- [x] Wire `<Kbd>` into Phase 3's `<Topbar>` (deferred to Phase 3) and into the **existing `/search` route's submit-button kbd hint** if appropriate. _Wiring deferred to Phase 3 per IMPL plan — `<Input>` powers the Topbar's search trigger and `<Kbd>` powers the `⌘K` hint there._
- [x] `just check` 100% green.

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

- [x] Create `src/components/portal/Topbar/`:
  - `Topbar.tsx`, `Topbar.module.css`, `index.ts`, `Topbar.test.tsx`.
- [x] **Layout:** 3-col CSS grid — left brand, centered search trigger (`<Input>` rendered read-only with the `<Kbd>` `⌘K` suffix, opens the search modal on click — see Phase 9), right `<ThemeToggle>` + nav links. Sticky via `position: sticky; top: 0; z-index: var(--z-sticky)` (v0.3.0 token).
- [x] **Brand area:** "rfc-site" wordmark linking to `/`; uses `--tracking-tighter` (v0.3.0) for the display feel.
- [x] **Search trigger:** clicking the topbar `<Input>` opens the Phase 9 search modal. For now (Phase 3), wire it as a `<Link to="/search">` so the trigger is functional even before the modal lands.
- [x] **Nav slot:** placeholder links for the three future routes (`API`, `MCP`, `Frameworks`) marked `aria-disabled` / `<span>` so they're visible but inert until those routes exist. Easier to dial in spacing now than retrofit later.
- [x] **Wire into `src/root.tsx`'s Layout:**
  - `<Topbar />` rendered above `<Outlet />`.
  - `<ThemeToggle>` removed from `_index.tsx`, `$type.$id.tsx`, `search.tsx` headers.
- [x] **Existing route headers** trimmed of duplicate breadcrumb/title chrome where the topbar now covers it. `_index.tsx` lost its inline "Search" link + ThemeToggle; `search.tsx` lost its ThemeToggle.
- [x] **Tests** for `<Topbar>` (`Topbar.test.tsx`): brand link target, search trigger link target, `<ThemeToggle>` present, nav placeholder rendering, `⌘K` global shortcut nav + the "don't steal focus from an open input" guard. 6 tests.
- [x] **Existing route render tests** updated: no existing assertions referenced ThemeToggle directly, so no removal needed; existing `_index` / `$type.$id` / `/search` render tests stayed green against the trimmed headers.
- [x] **Keyboard shortcut wiring** for `⌘K`: bound globally so pressing it (Meta+K or Ctrl+K) navigates to `/search`. Guard short-circuits when the event target is an `<input>`, `<textarea>`, or contentEditable element. Phase 9 will upgrade to opening the modal instead of navigating.
- [x] `just check` 100% green; `just build` clean.

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

- [x] Create `src/components/ds-candidates/Card/`:
  - `Card.tsx`, `Card.module.css`, `index.ts`, `Card.test.tsx`.
- [x] **Props:**
  - `variant: "flat" | "elevated"` (default `"flat"`; `"elevated"` uses `--shadow-sm`).
  - `padding: "sm" | "md" | "lg"` (default `"md"`).
  - Native `<div>` prop pass-through.
  - `asChild` slot for composing with `<section>` / `<article>` / `<Link>` (Resolved §2 — uses `@radix-ui/react-slot`, same as `<Button>`).
- [x] **Composable sub-components** `<Card.Header>` / `<Card.Body>` / `<Card.Footer>` (Resolved §4 — sub-components over loose CSS classes for the explicit DX). Implemented with the `Object.assign(CardRoot, { Header, Body, Footer })` pattern so dot-notation surfaces on the TypeScript type without post-export mutation.
- [x] Tests: variant + padding combos, sub-component composition, refs + className merge. 7 tests in `Card.test.tsx`.

#### Tasks — `<Tabs>`

- [x] Create `src/components/ds-candidates/Tabs/`:
  - `Tabs.tsx`, `Tabs.module.css`, `index.ts`, `Tabs.test.tsx`.
- [x] **API shape:** uncontrolled root with `defaultValue`, controlled via `value` + `onValueChange`. Sub-components `<Tabs.List>`, `<Tabs.Trigger value="…">`, `<Tabs.Content value="…">` — Radix-style composition without pulling Radix Tabs in (we have one sanctioned Radix dep, `@radix-ui/react-slot`, per CLAUDE.md Hard rules). Same `Object.assign(TabsRoot, { List, Trigger, Content })` pattern as `<Card>`.
- [x] **Keyboard:** arrow-key navigation between triggers per WAI-ARIA Tabs pattern (ArrowLeft / ArrowRight wrap; Home / End jump to first / last). Triggers register themselves via a context-provided `registerTrigger(value, node)`; `focusByDirection(from, direction)` walks the registry.
- [x] **URL state:** opt-in via a `urlParam?: string` prop (Resolved §5). When set, tab state syncs to `?<urlParam>=<value>` via RR7's `useSearchParams`; when omitted, state is local. Callers like the API examples page opt in for shareable links.
- [x] Tests: switching tabs via click + keyboard, active state attr, content visibility, refs forward. 6 tests in `Tabs.test.tsx`.

#### Tasks — `<CodeBlock>`

- [x] Create `src/components/ds-candidates/CodeBlock/`:
  - `CodeBlock.tsx`, `CodeBlock.module.css`, `index.ts`, `CodeBlock.test.tsx`.
- [x] **Props:**
  - `code: string` (required).
  - `language?: string` (defaults to `"text"`).
  - `showCopy?: boolean` (default `true`).
  - `label?: string` (display label, e.g., `"curl"`).
- [x] **Highlighting:** uses `@shikijs/rehype`'s peer `shiki` directly (already a transitive dep via `@shikijs/rehype`). Async dynamic-import singleton (`highlighterPromise ??= import("shiki")`) so the cost is paid once across multiple `<CodeBlock>` instances. Renders `<MarkdownHooks>`-style: SSR `<pre><code>` fallback, then `useEffect` resolves Shiki and swaps to highlighted HTML via `dangerouslySetInnerHTML`. Dual-theme config (`github-light` / `github-dark`) matches `src/portal/markdown/pipeline.ts`.
- [x] **Distinct from `src/portal/markdown/components/Code.tsx`** — that one is page-bound to `<DocumentView>` and consumes hast from the unified pipeline. This one is the standalone primitive for non-Markdown contexts (API examples, MCP setup snippets).
- [x] **Copy button:** uses Phase 1's `<Button variant="ghost" size="sm">`. Calls `navigator.clipboard.writeText(code)`; flashes a "Copied" state for ~1.5s via a `setTimeout` with cleanup in `useEffect`.
- [x] Tests: renders highlighted output, copy button triggers `navigator.clipboard.writeText`, language label rendering, hides copy button when `showCopy={false}`. 5 tests in `CodeBlock.test.tsx` (Shiki mocked via `vi.mock("shiki", …)` so jsdom doesn't load the real WASM regex engine).

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

- [x] Create `src/components/ds-candidates/Breadcrumb/`:
  - `Breadcrumb.tsx`, `Breadcrumb.module.css`, `index.ts`, `Breadcrumb.test.tsx`.
- [x] **API shape:** root `<Breadcrumb>` + sub-component `<Breadcrumb.Item href?="…" param?: boolean>`. Renders an ordered list with `aria-label="Breadcrumb"`. Items without `href` (or with `current={true}`) render as a plain `<span>` per the WAI-ARIA Authoring Practices breadcrumb pattern. Same `Object.assign(BreadcrumbRoot, { Item })` pattern as `<Card>` / `<Tabs>`.
- [x] **Path-param styling:** `<Breadcrumb.Item param>` sets `data-param="true"` on the `<li>` wrapper; CSS targets the data attribute for the mockup's monospace + accent treatment on `{type}` / `{id}` segments (Resolved §6 — attribute prop over a separate sub-component, simpler API).
- [x] Tests: link items render as `<a>`; last item is plain text (no link); `param` items render with the `data-param` attribute + styling; `aria-current="page"` set when `current={true}`; `asChild` composes with RR7 `<Link>`-style wrappers; className merges on both link + plain-text branches. 6 tests in `Breadcrumb.test.tsx`.

#### Tasks — `<Badge>` extension (in `../design-system`)

- [x] In the design-system repo: add `variant: "status" | "filter" | "severity"` to `<Badge>` (default stays `"status"` for backward compatibility — existing rfc-site call-sites unaffected). Each variant maps to a distinct palette. Landed on the `feat/badge-filter-severity-variants` branch of `../design-system` (commit `3c0f1d1`).
  - `status` — current behaviour (Draft / Proposed / Accepted / …) backed by `--color-status-*`.
  - `filter` — selected/unselected states for the Phase 9 search-modal filter pills. `selected?: boolean` drives both the accent palette and `aria-pressed`; click wiring is consumer responsibility (wrap in `<button>` or pass `onClick` + role/tabIndex).
  - `severity` — critical / high / medium / low for the Frameworks rules view. Palette maps onto existing `--color-status-*` tokens (no new tokens introduced): `critical → rejected`, `high → draft`, `medium → proposed`, `low → tertiary fg`. Pass via `status="critical"` etc.
- [x] Add tests for each variant in the design-system's `tests/primitives/Badge.test.tsx`. 16 new tests, 28 total in the file; 352 tests in the design-system suite. New exports: `BADGE_SEVERITIES`, `BADGE_VARIANTS`, `BadgeSeverity`, `BadgeVariant`.
- [x] Add a changeset (minor bump). Filed as `.changeset/badge-filter-severity-variants.md` for the next design-system release. Phase 6's batch promotion can ride this same release or land afterwards once additional candidates hit the readiness checklist.
- [x] **No new `ds-candidate` folder** in rfc-site — the extension is upstream-only. rfc-site picks up the new variants once the `0.4.0` design-system release lands and `package.json` is bumped (deferred to Phase 6 / Phase 7 consumption).

#### Success Criteria

- `<Breadcrumb>` renders the mockup's path display with path-param styling against both themes.
- `<Badge>` ships with `filter` + `severity` variants in the design-system repo; existing `status` call-sites unaffected.
- 4+ tests for `<Breadcrumb>` in `ds-candidates/Breadcrumb/Breadcrumb.test.tsx`; new `<Badge>` variant tests added to the design-system's `tests/primitives/Badge.test.tsx`. All green in both repos.
- `just check` 100% green; `just build` clean.

---

### Phase 6: Promote stabilized primitives to `@donaldgifford/design-system`

Batch promotion of the candidates that have hit the [readiness checklist](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md#the-ds-candidates-contract): used 2+ places, API stable, no portal-only deps. Primitives still used in only one place (or with API churn risk) stay in `ds-candidates/` until a second usage site lands.

#### Tasks

- [x] **Readiness audit** — scored each Phase 1-5 candidate against the [readiness checklist](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md#the-ds-candidates-contract) (`used 2+ places`, `API stable ~2 weeks`, `no portal-only deps`). Current usage site count (post-Phase-5):

  | Candidate | Sites pre-9 | Sites post-9 | Verdict |
  |---|---|---|---|
  | `<Button>` | 1 (`search.tsx`) | 3 (`search.tsx` + `<SearchModal>` + `<CodeBlock>` copy-button) | ✅ **Promoted** to `@donaldgifford/design-system@0.4.0` (design-system commit `c84eec2`). |
  | `<Input>` | 1 (`<Topbar>`) | 2 (`<Topbar>` + `<SearchModal>`) | ✅ **Promoted** to `@donaldgifford/design-system@0.4.0` (design-system commit `ca47c3a`). |
  | `<Kbd>` | 1 (`<Topbar>`) | 2 (`<Topbar>` + `<SearchModal>` footer) | ✅ **Promoted** to `@donaldgifford/design-system@0.4.0` (design-system commit `e66886a`). |
  | `<Card>` | 0 | 2 (`<DocSidebar>` blocks + `<RFCPreviewCard>` popover) | ✅ **Promoted** to `@donaldgifford/design-system@0.4.0` (design-system commit `05bf8c1`). |
  | `<Tabs>` | 0 | 0 in this IMPL (future API examples / MCP only) | **Stay** in `ds-candidates/`. |
  | `<CodeBlock>` | 0 | 0 in this IMPL (future MCP / API only) | **Stay**. |
  | `<Breadcrumb>` | 0 | 0 in this IMPL (Frameworks route only) | **Stay**. |

  **Resolution:** Four candidates (`<Button>`, `<Input>`, `<Kbd>`, `<Card>`) hit the 2+ usage-site bar after Phase 9a shipped. ✅ All four have been promoted (CSS-Module → prefixed-global `.ds-*` class conversion per [INV-0001](../investigation/0001-ship-css-modules-from-design-system-tsup-build.md), cross-repo file move with test migration, design-system `0.4.0` minor bump, `bun link` validation, rfc-site import swap, candidate folder deletion). The `<Badge>` filter / severity variant work was already on the design-system's `feat/badge-filter-severity-variants` branch (commit `3c0f1d1`); all five changes (`<Button>` / `<Input>` / `<Kbd>` / `<Card>` + the `<Badge>` extension) ride the same `0.4.0` release.

- [ ] **For each promoted primitive** (per [DESIGN-0001 §Promotion workflow](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md) + CLAUDE.md §Promotion workflow):
  - ✅ `<Kbd>`: promoted to `../design-system/src/primitives/Kbd/` on the `feat/badge-filter-severity-variants` branch (commit `e66886a`). CSS converted from CSS Modules to prefixed-global `.ds-kbd` per [INV-0001](../investigation/0001-ship-css-modules-from-design-system-tsup-build.md); 5 tests migrated to `tests/primitives/Kbd.test.tsx`; `src/index.ts` exports the public surface. Existing `badge-filter-severity-variants` changeset extended to cover both changes for the `0.4.0` release.
  - ✅ `<Input>`: promoted to `../design-system/src/primitives/Input/` (commit `ca47c3a`). CSS converted: `.ds-input` (shell), `.ds-input__field` (inner input), `.ds-input__slot` (prefix/suffix wrappers). 8 tests migrated; `user-event` swapped for `fireEvent` so the design-system doesn't gain a new devDependency.
  - ✅ `<Card>`: promoted to `../design-system/src/primitives/Card/` (commit `05bf8c1`). CSS converted: `.ds-card` (root), `.ds-card__header` / `.ds-card__body` / `.ds-card__footer` (sub-components). 7 tests migrated; the `asChild` test was rewritten to render a plain `<a>` instead of an RR7 `<Link>` so design-system doesn't gain a `react-router` dep. The `Object.assign(CardRoot, { Header, Body, Footer })` dot-notation pattern is preserved verbatim. `@radix-ui/react-slot` added to design-system runtime dependencies.
  - ✅ `<Button>`: promoted to `../design-system/src/primitives/Button/` (commit `c84eec2`). CSS converted to prefixed-global `.ds-button` per [INV-0001](../investigation/0001-ship-css-modules-from-design-system-tsup-build.md). 9 tests migrated to `tests/primitives/Button.test.tsx` — `user-event` swapped for `fireEvent` and the `asChild` test rewritten to render a plain `<a>` (matching the `<Card>` migration convention). `asChild` Radix Slot composition + the `type="button"` default + `aria-disabled` mirror are preserved verbatim.
- [x] **Once the design-system release lands** — partial: validated locally via `bun link` against the design-system feat branch's `dist/` (the 0.4.0 release hasn't published yet, but the linked artefact is identical to what the release will ship):
  - ✅ `<Kbd>` consumed via `import { Kbd } from "@donaldgifford/design-system"` in `src/components/portal/Topbar/Topbar.tsx` and `src/components/portal/SearchModal/SearchModal.tsx`.
  - ✅ `src/components/ds-candidates/Kbd/` deleted.
  - [ ] After 0.4.0 publishes: `bun update @donaldgifford/design-system`, switch off `bun link` (`just ds-unlink`), final import-swap PR.
- [x] **Sanity sweep:** `just check` 100% green (166 tests; the 5 colocated Kbd tests moved to design-system); `just build` clean.

#### Success Criteria

- Readiness audit complete. ✅ **Result post-Phase-9a:** four candidates (`<Button>`, `<Input>`, `<Kbd>`, `<Card>`) hit the 2+ usage-site bar and are promotion-eligible; three (`<Tabs>`, `<CodeBlock>`, `<Breadcrumb>`) stay in `ds-candidates/` pending future-IMPL routes that consume them.
- ✅ Promoted primitives shipped in `@donaldgifford/design-system@0.4.0-pre` (riding the `<Badge>` filter / severity variant changeset) and consumed via package imports across the portal. Final `0.4.0` publish + `bun update` swap is the only remaining cross-repo step.
- ✅ `src/components/ds-candidates/` cleared of `<Button>` / `<Input>` / `<Kbd>` / `<Card>`; `<Tabs>` / `<CodeBlock>` / `<Breadcrumb>` stay until a second usage site materialises in a future IMPL.
- ✅ Zero visual regressions vs the pre-promotion state — `just check` 100% green; `just build` clean.

---

### Phase 7: Directory table + toolbar upgrade (`_index.tsx`)

Replaces the current card grid in `_index.tsx` with the mockup's table shape: number cell, title + labels, status badge, authors, updated dateline. Toolbar above the table has filter triggers + sort + results count.

#### Tasks

- [x] **OpenAPI contract verification** (prerequisite, was Open Question §8): inspected `api/openapi.yaml` — `listDocs` currently only accepts `Limit` + `Cursor` parameters; **no `?filter=` / `?sort=` support exists**. Per the IMPL gating, the toolbar authoring tasks are paused pending an upstream `rfc-api` contract change. The table layout itself is independent of those params, so this phase ships in two slices:
  - **7a (this PR):** table layout swap, `<DirectoryTable>` composite, render-level tests. No URL-driven filter/sort.
  - **7b (deferred):** `<DirectoryToolbar>`, filter / sort URL state, loader forwarding. Gates on the contract change.
- [x] **Update `_index.tsx`:** loader stays the same (`listDocs` + `Link`-header pagination); the rendering swapped from the `<DocCard>` `<ul>` grid to the new `<DirectoryTable>`. `<DocCard>` stays in `src/components/portal/DocCard/` through this phase (Resolved §13 — schedule deletion in a follow-up PR ~2 weeks after this phase ships if no second usage materialises). The route-level `HydrateFallback` was updated to a table-shaped skeleton.
- [x] **Add `src/components/portal/DirectoryTable/`** as a portal composite:
  - `DirectoryTable.tsx` — accepts `documents: readonly Document[]` props and renders a semantic `<table>` with 5 columns (ID, Title, Status, Authors, Updated). Title is the only clickable cell; the row's accessible name comes from the link (WAI-ARIA pattern for sortable / filterable data tables). Empty `authors` arrays render an em-dash placeholder. The `<time>` element preserves the raw ISO `updated_at` for hover-as-tooltip / machine reading.
  - `.module.css` — table chrome (sticky-feel uppercase header row, hairline borders, hover row, horizontal scroll container so narrow viewports don't overflow the page).
  - `index.ts`.
  - `DirectoryTable.test.tsx` — 5 tests covering column headers, row content, single-link-per-row invariant, empty-authors fallback, semantic `<time>` element.
- [ ] **Add `src/components/portal/DirectoryToolbar/`** as a portal composite — _Deferred to 7b._
  - `DirectoryToolbar.tsx` — accepts `filters`, `sort`, `onFilterChange`, `onSortChange` props. Uses `<Button>`, `<Input>`, `<Badge>` filter variant primitives.
- [ ] **Toolbar functionality** — _Deferred to 7b._
  - **Filter triggers** use native `<details>`/`<summary>` for the dropdown surface (Resolved §7 — defer the Popover primitive until Phase 9 confirms it's needed for the search-modal preview-pane positioning).
  - **Sort** dropdown with `updated_desc` / `updated_asc` / `id_desc` / `id_asc` — same `<details>` shape.
  - **Filter + sort state in the URL** (`?filter=type:rfc&sort=updated_desc`) so refresh / share / back-button works. RR7's `useSearchParams` provides this.
  - **Results count** — total fixtures available pre-filter, then `(N of M shown)` post-filter.
- [ ] **Loader update:** parse the new URL params and forward to `listDocs` once the contract is verified — _Deferred to 7b._
- [x] **Tests:**
  - `tests/api/indexRoute.test.ts` — loader unchanged; existing 3 tests stay green.
  - `tests/api/indexRouteRender.test.tsx` — full render through `createRoutesStub` exercises the new table end-to-end. The accessible-name link assertion (`screen.getByRole("link", { name: "Use PostgreSQL for primary storage" })`) and the Badge humanised-status assertions both survive the swap unchanged.
  - `src/components/portal/DirectoryTable/DirectoryTable.test.tsx` — 5 new component-level tests (column headers, row content, single-link invariant, empty authors, `<time>`).
- [x] **Card grid removed** from the live route; `<DocCard>` retained in `src/components/portal/DocCard/` through this phase (Resolved §13 — schedule deletion in a follow-up PR ~2 weeks after this phase ships if no second usage materialises).

#### Success Criteria

**7a — table layout (this PR):**

- `/` renders the table shape from the mockup with all current fixture corpus surfaced. ✅
- Existing `_index` loader + render tests stay green against the new table. ✅
- New `<DirectoryTable>` component-level tests (5 cases) added. ✅
- `just check` 100% green; `just build` clean. ✅ (150 tests, 27 files)

**7b — toolbar (deferred):**

- _(Deferred)_ Filter + sort affect the visible rows and persist via URL params.
- _(Deferred)_ New toolbar interaction tests added.
- _(Deferred)_ `rfc-api`'s `listDocs` accepts `?filter=` / `?sort=` query params.

---

### Phase 8: RFC sidebar + cross-RFC preview card (`$type.$id.tsx`)

Two-column layout per the mockup: left metadata sidebar (status / author / created / updated / revision / PR link + labels) + right prose. Plus a hover preview card overlay for cross-RFC links (composed with the existing `<Anchor>` from `src/portal/markdown/components/`).

#### Tasks

- [x] **Update `$type.$id.tsx`:** wrapped the existing chrome (breadcrumbs + header) outside, then sat `<DocSidebar />` + `<DocumentView />` inside a `.layout` two-column CSS grid (`minmax(0, 1fr) 280px`). The grid collapses to a single column under `900px` viewport. Loader unchanged.
- [x] **Add `src/components/portal/DocSidebar/`** — accepts the `Document` payload + renders 5-7 metadata blocks (Status / Authors / Created / Updated / Source, plus Discussion and Labels when those fields are populated). Each block is a `<Card variant="elevated" padding="sm">` with the label in `Card.Header` (uppercase + `--tracking-wider`) and the value in `Card.Body`. Source link routes to the `<repo>/blob/<commit|HEAD>/<path>` URL.
- [x] **Add `src/components/portal/RFCPreviewCard/`** — popover-style hover card.
  - Wraps a single trigger child (typically an RR7 `<Link>`) in a `<span>` and attaches hover / focus handlers. The orval-generated `useGetDoc` hook fetches the target lazily — `enabled: false` until the first hover/focus — so untouched preview-enabled links cost nothing.
  - Renders `<Card variant="elevated" padding="md" role="tooltip">` containing the doc's id + title + status `<Badge size="sm">` + authors + dateline.
  - **Accessibility (Resolved §9):** triggers on **hover AND focus**, `aria-describedby` wires the trigger to the popover when open, `Escape` closes. Configurable `openDelay` (defaults to `150ms` to debounce accidental triggers; pass `0` in tests).
  - **Positioning (Resolved §10):** **CSS-only positioner** for v1 — `position: absolute; top: calc(100% + var(--space-1)); left: 0; z-index: var(--z-overlay)`. Viewport-edge handling is deferred; swap in `@floating-ui/react` if the simple approach gets squirrely.
  - **Inert error surface:** when the target returns a 404 problem response, the popover renders `"<ID> not found"` (parsed via `classifyProblem`) instead of crashing; generic non-200s render `"Couldn't load <ID>"`.
- [x] **`<Anchor>` extension:** added the Phase 8b prop `previewable?: boolean` (default `true`). When `true` and the anchor resolves to a portal route, the resolved RR7 `<Link>` is wrapped in `<RFCPreviewCard type={…} id={…}>`. The route segments come from the resolved portal route (split + verified to have exactly 2 segments). Internal links that resolve to non-doc routes fall back to the bare link.
- [x] **Sidebar styling** uses `--shadow-sm` (v0.3.0) for the elevated metadata blocks (via `<Card variant="elevated">`). Labels use `--tracking-wider` (v0.3.0) for the uppercase mono feel.
- [x] **Tests:**
  - `tests/portal/markdown/components/Anchor.test.tsx` — added a 5th test: previewable internal link wraps in `<RFCPreviewCard>` (asserts `span[data-state="closed"]` ancestor). The existing test helper got a `QueryClientProvider` wrapper so the lazy `useGetDoc` hook can mount.
  - `src/components/portal/RFCPreviewCard/RFCPreviewCard.test.tsx` — 5 tests with a local MSW server: popover hidden by default; opens on hover and fetches; closes on pointer-leave; closes on `Escape`; renders the not-found error surface for 404 problem responses.
  - `src/components/portal/DocSidebar/DocSidebar.test.tsx` — 7 tests cover baseline blocks, the `<aside aria-label>` landmark, raw ISO timestamps via `<time dateTime>`, HEAD fallback when `source.commit` is absent, conditional rendering of `authors` / `discussion` / `labels`.
  - `tests/api/docPageRender.test.tsx` — updated to expect the Status badge in both the header and the sidebar (`getAllByText("Proposed").length >= 2`).

#### Success Criteria

**8a — sidebar + two-column layout (this PR):**

- RFC page renders the two-column mockup layout against both themes. ✅ (responsive collapse to a single column under 900px).
- Sidebar surfaces Status / Authors / Created / Updated / Source plus conditional Discussion + Labels blocks. ✅
- Existing `$type.$id` tests still green against the new layout. ✅
- New `<DocSidebar>` component-level tests (7 cases) added. ✅
- `just check` 100% green; `just build` clean. ✅ (157 tests, 28 files)

**8b — cross-RFC preview card:**

- Cross-RFC links in the body show a preview popover on hover + focus. ✅
- `<Anchor>` `previewable` extension + `<RFCPreviewCard>` portal composite + 5 new tests. ✅
- `just check` 100% green; `just build` clean. ✅ (163 tests, 29 files)

---

### Phase 9: Search modal upgrade (`search.tsx`)

Upgrades the minimal `/search` page (IMPL-0003 Phase 7) into the mockup's full-page modal: filter pills, grouped results, preview pane, keyboard-hint footer. The existing URL-driven `/search` stays as the no-JS fallback and as the destination for the topbar trigger / `⌘K` keyboard shortcut.

#### Tasks

- [x] **`<SearchModal>` portal composite** at `src/components/portal/SearchModal/`:
  - Renders as a fixed-position overlay using `--z-overlay` (v0.3.0) over a translucent backdrop (`rgba(0,0,0,0.45)`); the dialog itself uses `--shadow-lg`.
  - Controlled API (`open` + `onOpenChange`); the parent (`<Topbar>`) owns the state.
  - Hosts the `searchDocs` orval call directly so the modal is fully self-contained — the legacy `/search` route stays as the no-JS fallback per Resolved §11.
  - Header (title + close), `<Input>` searchbox (Enter submits), results body, footer with `<Kbd>` hints (`Esc` close, `↵` search).
  - Results re-use the same `<Snippet>` rendering as the route so the UI is consistent across surfaces.
  - AbortController on every search call so prior in-flight requests get cancelled when the user retypes.
  - Inert error surface: 4xx/5xx responses + network errors render `"Search failed — try again."` instead of crashing.
  - _(Deferred to 9b)_ Filter pills (`<Badge variant="filter">`) — gate on the upstream design-system 0.4.0 release.
  - _(Deferred to 9b)_ Results grouped by document type with sticky group headers.
  - _(Deferred to 9b)_ Side preview pane on hover.
  - _(Deferred to 9b)_ Full WAI-ARIA Dialog focus-trap polish — currently the input gets focus on open + `Escape` closes; tab-cycling within the dialog is browser-native.
- [x] **`⌘K` global shortcut:** updated in `<Topbar>` to open `<SearchModal>` instead of navigating to `/search`. The "don't steal focus from inputs" guard is preserved.
- [x] **Modal-vs-route reconciliation (partial):**
  - Direct nav to `/search` still works (no-JS friendly). ✅
  - Clicking the topbar trigger with **plain click** opens the modal; **meta-click / middle-click** navigates to `/search` (Cmd+click to open in a new tab still works).
  - _(Deferred to 9b)_ `?modal=1` URL state so back-button closes the modal and refresh re-opens it (Resolved §11).
- [x] **Accessibility (partial):** `role="dialog"`, `aria-modal="true"`, `aria-labelledby` wires to the title. Focus moves to the input on open via `queueMicrotask` + ref. Escape closes (bound via document keydown). Backdrop click closes. Backdrop and inline close button have distinct accessible names (`"Close search"` vs `"Close search dialog"`) so RTL queries can disambiguate.
- [x] **Tests:**
  - `src/components/portal/SearchModal/SearchModal.test.tsx` — 7 tests with a local MSW server: hidden when `open=false`; labelled dialog + focused input on open; query submission renders MSW-backed hits; Escape closes; backdrop click closes; close button closes; empty-prompt copy.
  - `src/components/portal/Topbar/Topbar.test.tsx` — 3 updates: ⌘K opens the modal (not navigates); modal stays closed when ⌘K fires inside an input; clicking the topbar trigger opens the modal.
  - `tests/api/searchRouteRender.test.tsx` — unchanged; the URL-driven `/search` route still works as a no-JS fallback (4 tests stayed green).

#### Success Criteria

**9a — modal overlay + ⌘K wiring (this PR):**

- `⌘K` opens the modal from any route; `esc` / outside-click closes it. ✅
- Modal hosts `searchDocs` and renders hits with the same `<Snippet>` chrome as the legacy route. ✅
- Direct nav to `/search` continues to work (no-JS path preserved). ✅
- `just check` 100% green; `just build` clean. ✅ (171 tests, 30 files)

**9b — filter pills + grouped results + preview pane + focus-trap (deferred):**

- _(Deferred)_ Filter pills narrow the visible results (gates on design-system `0.4.0` for `<Badge variant="filter">`).
- _(Deferred)_ Grouped results + sticky group headers.
- _(Deferred)_ Preview pane shows the selected hit's snippet.
- _(Deferred)_ Full WAI-ARIA Dialog focus-trap (the current implementation focuses the input on open + Escape closes + Tab cycles natively; a proper focus-trap polish is a follow-up).
- _(Deferred)_ `?modal=1` URL state for back-button-closes-modal behaviour (Resolved §11).

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
