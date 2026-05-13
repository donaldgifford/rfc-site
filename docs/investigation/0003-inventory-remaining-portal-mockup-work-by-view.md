---
id: INV-0003
title: "Inventory remaining portal-mockup work by view"
status: Open
author: Donald Gifford
created: 2026-05-13
---
<!-- markdownlint-disable-file MD025 MD041 -->

# INV 0003: Inventory remaining portal-mockup work by view

**Status:** Open
**Author:** Donald Gifford
**Date:** 2026-05-13

<!--toc:start-->
- [Question](#question)
- [Hypothesis](#hypothesis)
- [Context](#context)
- [Approach](#approach)
- [Environment](#environment)
- [Findings](#findings)
  - [Cross-cutting — missing design-system primitives](#cross-cutting--missing-design-system-primitives)
  - [Cross-cutting — token / chrome gaps](#cross-cutting--token--chrome-gaps)
  - [Directory view (`/`)](#directory-view-)
  - [RFC page (`/$type/$id`)](#rfc-page-typeid)
  - [Search modal + `/search` route](#search-modal--search-route)
  - [Topbar](#topbar)
  - [API view (`/api`) — not yet wired](#api-view-api--not-yet-wired)
  - [MCP view (`/mcp`) — not yet wired](#mcp-view-mcp--not-yet-wired)
  - [Frameworks view (`/frameworks`) — not yet wired](#frameworks-view-frameworks--not-yet-wired)
- [Conclusion](#conclusion)
- [Recommendation](#recommendation)
- [References](#references)
<!--toc:end-->

## Question

After [IMPL-0004](../impl/0004-build-rfc-portal-components-per-inv-0002-inventory.md) closed with the *wiring* for every IMPL-0004 surface complete, what specific work remains — broken down **by view** and **by design-system primitive** — to bring the portal to visual parity with `donaldgifford/design-system/rfc-portal-mockup_15.html`?

The output is a structured inventory that lets us:

1. Decide what design-system primitives still need to be authored / promoted (cross-cutting, blocking multiple views).
2. Decide which views can ship a visual-rework PR independently vs. which are gated on a primitive landing first.
3. Triage the three not-yet-wired routes (`/api`, `/mcp`, `/frameworks`) — what's the scope of "structure + visuals" we can land *before* the upstream rfc-api / MCP-server work that gives them real data?

## Hypothesis

1. **Most visual gaps reduce to a small set of missing primitives** — `<Popover>` for the cascading filter menu + hover preview card, `<SegmentedControl>` for the sort toggle, possibly an icon-system primitive for the icon-only filter trigger and topbar nav. Once those land, the rfc-site CSS/JSX rework against the existing components should be straightforward.
2. **Per-view rework is mostly CSS + JSX, not behaviour** — every IMPL-0004 surface has its URL state machine, contract integration, and test surface locked in. Visual rework changes JSX shape and CSS modules; the loader, MSW handler, and component tests stay green.
3. **The three not-yet-wired views split cleanly into "shell + chrome can ship now" vs. "data layer gated on upstream"** — we can author the visual shell of `/api`, `/mcp`, `/frameworks` against the mockup, plus fixture or static data, and land the routes as visual surfaces. The real data layer (rfc-api `/api/v1/api-surface`-equivalent, MCP server endpoints, framework registry) is upstream work that can backfill into the existing surface without restructuring the route.

## Context

**Triggered by:** [IMPL-0004 close-out](../impl/0004-build-rfc-portal-components-per-inv-0002-inventory.md) + [CLAUDE.md §What's deferred](../../CLAUDE.md).

[INV-0002](0002-inventory-components-needed-from-the-rfc-portal-mockup.md) inventoried what *components* needed to exist; IMPL-0004 then shipped them. This INV is the natural successor — *now* the components exist and the wiring is correct, but the visual treatment hasn't been audited end-to-end against the mockup. The closest single concrete divergence — `<DirectoryToolbar>` vs the mockup at `rfc-portal-mockup_15.html:354-513` — surfaced during the IMPL-0004 Phase 7b PR review and is the prompt for this audit.

The mockup at `/Users/donaldgifford/code/design-system/rfc-portal-mockup_15.html` is ~4500 lines and contains six top-level views (per INV-0002 §Findings): Directory, RFC Page, Search, API, MCP, Frameworks. Three of those (Directory, RFC Page, Search) have live routes in the portal; three (API, MCP, Frameworks) are placeholders in the topbar with no route file yet.

## Approach

1. **Survey the mockup view by view.** For each of the six top-level views, extract:
   - The HTML structure / key elements (filter triggers, segmented controls, icon buttons, etc.).
   - The CSS classes the mockup defines + what design-system token they reference.
   - The data shape implied by the view (where does the data come from, what fields are surfaced).

2. **Compare against the current portal.** For each view:
   - **Wired views (Directory / RFC Page / Search):** diff the rendered JSX + CSS in `src/components/portal/<View>` and `src/routes/<route>` against the mockup. Identify every visual divergence and tag it.
   - **Not-yet-wired views (API / MCP / Frameworks):** identify what the mockup expects, what data shape it implies, and what subset can land as a "shell + chrome" rfc-site PR vs. what gates on upstream work.

3. **Tag findings consistently.** Every finding carries one or more tags so the inventory cross-references:
   - **View tags:** `#directory`, `#rfc-page`, `#search`, `#topbar`, `#api`, `#mcp`, `#frameworks`.
   - **Primitive tags:** `#popover-primitive`, `#segmented-control-primitive`, `#icon-system`, `#tooltip-primitive` (add others as discovered).
   - **Layer tags:** `#design-system` (work in the design-system repo), `#portal-visuals` (CSS / JSX rework in rfc-site), `#upstream-data` (gates on rfc-api or external).

4. **Roll up two summary tables** for triage:
   - **Missing design-system primitives** — name, motivating views, candidate API shape (pointer only — actual API decisions belong in a DESIGN doc spawned from this).
   - **Wired-but-visually-divergent surfaces** — view, current state, mockup target, gating primitive(s).

5. **Conclude with a sequencing recommendation** — which DESIGN docs to author next, which design-system PRs to ship first, which rfc-site IMPL slices follow.

## Environment

| Component | Version / Value |
|-----------|----------------|
| Mockup source | `/Users/donaldgifford/code/design-system/rfc-portal-mockup_15.html` (≈4500 lines) |
| Portal at IMPL-0004 close | `main` @ `a359a79` |
| design-system | `@donaldgifford/design-system@0.4.0` (consumed from GitHub Packages) |
| rfc-api | `v0.3.0` (listDocs filter+sort contract live) |
| Prior inventory | [INV-0002](0002-inventory-components-needed-from-the-rfc-portal-mockup.md) |

## Findings

> Findings populate iteratively as we walk each view. Each subsection follows
> the same shape: current state → mockup expectations → gap with tags →
> proposed resolution path. Tags use the convention from §Approach so the
> end-of-doc summary tables can be assembled mechanically.

### Cross-cutting — missing design-system primitives

> Populated by the per-view findings below. Each entry: primitive name, the
> views that motivate it, sketch of the API shape (binding decisions deferred
> to a DESIGN doc).

| Primitive | Motivating views | Notes |
|-----------|------------------|-------|
| _(populated during audit)_ | | |

### Cross-cutting — token / chrome gaps

> Tokens or design-system chrome utilities the mockup uses that the
> design-system doesn't expose yet. Often surface during the per-view audit
> as "this divergence is fixable in rfc-site CSS but the right home is a new
> token in design-system".

- _(populated during audit)_

### Directory view (`/`)

**Current portal state:** `src/routes/_index.tsx` + `<DirectoryToolbar>` + `<DirectoryTable>`. IMPL-0004 Phase 7a + 7b. Loader forwards `?filter[]` + `?sort` to `listDocs`, captures `X-Total-Count` + `X-Total-Count-Unfiltered`, branches the empty state on the unfiltered header. URL state machine + cursor invalidation rules locked in.

**Mockup expectations:** `rfc-portal-mockup_15.html` §268-516 (`.directory`, `.directory-hero`, `.live-filter`, `.table-toolbar`, `.filter-trigger` + `.filter-menu` + `.filter-submenu`, `.sort-control` + `.sort-toggle`, `.results-count`).

**Gap:**

_(populated during audit — pre-seeded from PR-review observation:)_

- Filter trigger is icon-only `32×32` (`.filter-trigger`), not a text "Type" button — `#directory` `#icon-system` `#portal-visuals`
- Filter menu is a two-level cascading menu (`.filter-menu` → `.filter-submenu` opens to the right on hover) — `#directory` `#popover-primitive` `#design-system`
- Sort is a segmented toggle group (`.sort-toggle` with multiple `.sort-opt` children, active one accent-tinted), not a `<select>` — `#directory` `#segmented-control-primitive` `#design-system`
- Results count uses uppercase mono `RESULTS` label + tabular-num value (`.results-count .rc-label` / `.rc-value`), not the current bold-count + "documents" word — `#directory` `#portal-visuals`
- Toolbar chrome: `border-bottom: 1px solid hairline` + mono 12px throughout — `#directory` `#portal-visuals`
- Directory hero with grid-pattern background + centered title + live filter input (mockup §274-294) — *not* in the current portal — `#directory` `#portal-visuals`

### RFC page (`/$type/$id`)

**Current portal state:** `src/routes/$type.$id.tsx` two-column layout — `<DocSidebar>` (Status / Authors / Created / Updated / Source / Discussion / Labels) + `<DocumentView>` (Markdown pipeline). IMPL-0004 Phase 8a + 8b. `<RFCPreviewCard>` (hover popover on cross-doc `<Anchor>` links) shipped Phase 8b.

**Mockup expectations:** _(to survey)_

**Gap:** _(populated during audit)_

### Search modal + `/search` route

**Current portal state:** `<SearchModal>` (IMPL-0004 Phase 9a + 9b — filter pills, grouped headers, focus-trap, preview pane, `?modal=1` URL state, 14 tests) and the no-JS-fallback `/search` route (IMPL-0003 Phase 7).

**Mockup expectations:** _(to survey — mockup §1306+ defines `.search-filters-row` + the modal chrome)_

**Gap:** _(populated during audit)_

### Topbar

**Current portal state:** `<Topbar>` (IMPL-0004 Phase 3 + 9a + 9b — brand wordmark + `<Input>`+`<Kbd>⌘K</Kbd>` search trigger + future-route placeholders + `<ThemeToggle>`, 9 tests).

**Mockup expectations:** _(to survey)_

**Gap:** _(populated during audit — the three nav placeholders (`API` / `MCP` / `Frameworks`) currently render as inert `<span aria-disabled>`; the mockup likely has them as real links once the routes exist.)_

### API view (`/api`) — not yet wired

**Current portal state:** No route. `<Topbar>` shows an inert `API` nav placeholder.

**Mockup expectations:** _(to survey — likely an OpenAPI surface viewer of some shape over rfc-api's `/api/v1/...` endpoints.)_

**Scope split:**

- _(populated during audit)_
- **Can ship now:** _(visual shell + chrome + placeholder content)_
- **Gated on upstream:** _(data layer — rfc-api endpoint-listing surface, possibly OpenAPI fetch, etc.)_

### MCP view (`/mcp`) — not yet wired

**Current portal state:** No route. `<Topbar>` shows an inert `MCP` nav placeholder.

**Mockup expectations:** _(to survey — Model Context Protocol server discovery + downloads, per INV-0002 §Findings.)_

**Scope split:**

- _(populated during audit)_
- **Can ship now:**
- **Gated on upstream:** _(MCP server endpoints don't exist yet — at minimum a manifest endpoint that rfc-site can hit.)_

### Frameworks view (`/frameworks`) — not yet wired

**Current portal state:** No route. `<Topbar>` shows an inert `Frameworks` nav placeholder.

**Mockup expectations:** _(to survey — compliance frameworks browser, with severity pills (`<Badge variant="severity">` already promoted in Phase 6 specifically for this view).)_

**Scope split:**

- _(populated during audit)_
- **Can ship now:**
- **Gated on upstream:** _(framework registry — where does the data live? rfc-api extension? separate service?)_

## Conclusion

_(to fill once findings populate. Expected shape: 1-2 paragraphs naming the cross-cutting primitives that block the most views, plus the recommended ordering — design-system primitives first, rfc-site visual rework second, not-yet-wired view shells third, upstream-data backfills last.)_

**Answer:** _(pending)_

## Recommendation

_(to fill once findings populate. Expected shape: one new DESIGN doc per non-trivial primitive (e.g. `<Popover>`), one IMPL doc that batches the primitive promotions + portal visual rework, one separate IMPL or PLAN doc per not-yet-wired view as the data layer becomes available.)_

## References

- [INV-0002 — Inventory components needed from the rfc-portal mockup](0002-inventory-components-needed-from-the-rfc-portal-mockup.md)
- [IMPL-0004 — Build rfc-portal components per INV-0002 inventory](../impl/0004-build-rfc-portal-components-per-inv-0002-inventory.md)
- [DESIGN-0001 — Portal architecture and ds-candidates promotion model](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md)
- [CLAUDE.md §What's deferred](../../CLAUDE.md)
- Mockup: `/Users/donaldgifford/code/design-system/rfc-portal-mockup_15.html`
