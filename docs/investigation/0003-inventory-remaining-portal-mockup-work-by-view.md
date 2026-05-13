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

**Current portal state:** `src/routes/_index.tsx` + `<DirectoryToolbar>` + `<DirectoryTable>`. IMPL-0004 Phase 7a + 7b. Loader forwards `?filter[]` + `?sort` to `listDocs`, captures `X-Total-Count` + `X-Total-Count-Unfiltered`, branches the empty state on the unfiltered header. URL state machine + cursor invalidation rules locked in. Renders all 6 doc types in a single cross-type table.

**Mockup expectations:** `rfc-portal-mockup_15.html` §268-516 (CSS) + §2848-end-of-directory-section (HTML body). Three sub-regions:

- **`.directory-hero`** (§274-311, body §2851): centered serif 48px title "Request for Comments" with a mono 11px eyebrow `/ docs / rfcs` above it, all over a radial-masked grid-pattern background. Below: a 46px-tall `.live-filter` row (`<svg lf-icon>` + `<input lf-input>` + `<span kbd>/</span>`) — type-ahead client-side filter, NOT a separate search route. Focus state shifts border to `--accent-border` + 3px accent-bg ring.
- **`.table-toolbar`** (§354-515, body §2863-2920): horizontal `justify-content: space-between` toolbar with `border-bottom: 1px solid hairline`, mono 12px throughout.
  - **Left** (`.toolbar-left`): `.filter-trigger` — 32×32 grid-placed icon-only button (hamburger 3-line icon, currentColor stroke) → opens `.filter-menu` (160px min-width, absolute-positioned, elevated-bg, hairline border, ds shadow-md). Each `.filter-menu-item` (Authors / Labels in the mockup) hovers to reveal a `.filter-submenu` positioned to the right (`left: calc(100% + 6px)`); submenu has `max-height: 380px` + `overflow-y: auto` for the long label list (platform, security, kubernetes, aws, iam, wiz, okta, argocd, backstage, docs, tooling) and a similar shorter authors list (donald, priya, sam, ameer).
  - **Right** (`.toolbar-right`): `.sort-control` = uppercase mono `sort` label + `.sort-toggle` segmented control (2 `<button .sort-opt>` children: "updated ↓" / "number ↑", active one painted with `--accent` foreground + `--accent-bg` background + `--accent-border` border). Then `.results-count` = uppercase-tracked mono `Results` label + tabular-num value (`<span rc-value>11</span>`).
- **`.rfc-table`** (§517-639, body §2922+): rows of `<div class="rfc-row">` — CSS grid `72px 1fr 120px 160px 100px`, gap 24px, padding 18/8, hairline `border-bottom`, hover `--bg-raised`. Five cells per row:
  - `.rfc-number`: bare URL-form number ("0011"), mono 13px medium tertiary
  - `.rfc-title-cell`: title (15px sans medium primary) + `.labels` row of `<span class="label-tag">` chips (mono 10px, 2/7 padding, `--bg-elevated` bg, hairline border, tertiary fg). One row carries multiple labels: `platform docs tooling`.
  - `.status-cell`: `.status-badge` — outlined Oxide-rfd-style badge (mono 11px uppercase, 0.08em letter-spacing, `border: 1px solid currentColor`, `padding: 3px 8px 2px 8px`, `background: color-mix(currentColor 10%, transparent)`, color per status from `--status-*` tokens).
  - `.authors-cell`: mono 12px secondary, ellipsis overflow ("donald")
  - `.updated-cell`: mono 12px tertiary, tabular-num, right-aligned, **relative-time** label ("2 hours ago")

**Gap:**

- **No directory hero in the portal.** `_index.tsx`'s header is just `<h1>Directory</h1>` over hairline divider — missing the eyebrow, serif title, grid-pattern background, and the `.live-filter` input row entirely — `#directory` `#portal-visuals` (CSS chrome) + potentially `#live-filter-primitive` if we promote the focus-state chrome (input + svg-icon + kbd-suffix composite is a candidate primitive — `<Input>` already supports `suffix` slot, but the `.live-filter` mockup combines svg+input+kbd in one focus-bordered shell that's worth its own primitive shape).
- **Live filter behaviour is unmodelled.** Mockup is a type-ahead client-side filter; the portal currently has no equivalent. The Topbar's `⌘K` search modal is a different surface (cross-doc full-text search). Decision needed: is `.live-filter` redundant with the topbar search, a per-view in-table filter, or both? `#directory` `#unmodelled-behaviour`
- **Filter trigger is text "Type" button, not icon-only 32×32.** `#directory` `#icon-system` `#design-system` (need an icon primitive or at least an iconography convention) `#portal-visuals`
- **Filter menu is flat `<details>`/pill panel, mockup is two-level cascading menu.** `#directory` `#popover-primitive` `#design-system`. Note: mockup's cascade is `Authors → submenu` + `Labels → submenu` — these are filter *fields* (each field has its own value list). Today we only filter on `type`. DESIGN-0003 §Filter semantics explicitly lists `author:` and `status:`/`labels:` as Phase 2 extension targets — the mockup's UI implies those fields will exist; the contract change is the gating piece. `#directory` `#upstream-data` (rfc-api needs to expose `?filter=author:foo` / `?filter=labels:bar`).
- **Sort is native `<select>`, mockup is segmented toggle group.** `#directory` `#segmented-control-primitive` `#design-system` `#portal-visuals`. Mockup only shows TWO sort options ("updated ↓" / "number ↑"); we have SIX (created_desc / created_asc / updated_desc / updated_asc / id_desc / id_asc). A segmented control with 6 buttons would be cramped — likely combine "asc/desc" into a single button with a directional arrow, leaving 3 logical sort axes (updated, created, id/number). Decision needed.
- **Results count widget mismatched.** Current: `<strong>N</strong> documents` / `1 document` / `N of M shown`. Mockup: uppercase-tracked mono `Results` label + tabular-num value `N` (no "of M" widget in the mockup, so the filter-vs-unfiltered count we wired up is portal-specific UX). `#directory` `#portal-visuals`. Keep the `N of M shown` semantics — it's load-bearing for the empty-state branch — but restyle to mockup chrome.
- **Toolbar lacks `border-bottom` + mono-12px chrome.** `#directory` `#portal-visuals`. Mono-throughout treatment is a tone shift; should probably extract to a design-system "toolbar surface" recipe rather than re-implement per-route.
- **Table chrome divergence.**
  - **5 cols match by count (ID/Title/Status/Authors/Updated) but content differs:** mockup ID is bare numeric ("0011"), portal shows canonical (`RFC-0001`) — see structural-mismatch note below. `#directory` `#portal-visuals`
  - **Title cell missing labels chip-row** below the title. `Document.labels: string[]` already exists in the API; the portal table doesn't render it. `#directory` `#portal-visuals`
  - **Status badge style — verify against `<Badge>` 0.4.0 output.** Mockup uses an outlined Oxide-style badge (border `currentColor`, 10% bg tint, mono 11px uppercase letter-spacing 0.08em). Portal screenshots from PR #8 look close — same outlined-with-tint shape — but the typographic + spacing details (uppercase, letter-spacing, padding 3/8/2/8) need direct comparison. If `<Badge>` already nails the rendering, no change. If not, this is a design-system tweak. `#directory` `#design-system` (verification pass) `#rfc-page` (Badge is shared)
  - **Authors cell is mono + secondary fg + ellipsis-overflow.** Portal currently renders authors as the doc-page treatment, no mono. `#directory` `#portal-visuals`
  - **Updated cell uses relative time ("2 hours ago")**, portal uses absolute (`Apr 29, 2026`). Decision needed: relative-only / absolute-only / relative-with-absolute-on-hover. The current `<time>` element preserves raw ISO via `dateTime` attribute, so adding relative-time formatting is a leaf change. `#directory` `#portal-visuals`
- **Row hover effect.** Mockup: hover paints `--bg-raised` over the full row (cursor pointer on the entire row). Portal: single-clickable-cell pattern (only the title is a link, per WAI-ARIA sortable/filterable-table guidance). This is a deliberate accessibility/semantics tension — the mockup's "click anywhere on the row" is convenient but conflicts with sortable-table conventions. Decision needed: keep portal's single-clickable-cell or adopt mockup's full-row-click with appropriate landmark treatment. `#directory` `#design-decision`

**Structural mismatch (worth flagging at the conclusion level):** the mockup's directory is **single-type — RFCs only** (eyebrow `/ docs / rfcs`, page title "Request for Comments", row IDs as bare numbers "0011"). The portal's `/` is **cross-type** (RFC + ADR + DESIGN + IMPL + PLAN + INV all mixed). Two interpretations:

1. **Mockup is per-type:** every doc-type gets its own directory route (`/rfc`, `/adr`, `/design`, ...) with the hero + table shown above. The current cross-type `/` is then either replaced (the topbar nav lands you on one of the per-type routes) or kept as an unstyled "everything" surface. Implications: rfc-api's `listDocsByType` becomes the loader for these views; the cross-type `/api/v1/docs` endpoint is for search/filter aggregation only.
2. **Mockup is one example — the design extends to all types:** the `/ docs / rfcs` eyebrow varies per route, "Request for Comments" → "Architecture Decision Records", etc. The portal's `/` could either become a "pick a type" landing page or stay as the cross-type table (with the mockup styling applied) and the per-type views layer on top.

This decision shapes IMPL planning materially and is the largest open question in this audit. `#directory` `#design-decision` `#cross-cutting`

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
