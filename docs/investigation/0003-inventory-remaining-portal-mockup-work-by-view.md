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
  - [Cross-cutting — over-engineered surfaces from the dropped cross-type assumption](#cross-cutting--over-engineered-surfaces-from-the-dropped-cross-type-assumption)
  - [Cross-cutting — cross-doc reference policy](#cross-cutting--cross-doc-reference-policy)
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

### Scope clarification (decided 2026-05-14 during INV-0003 review)

The audit surfaced a structural question on first pass — the mockup's directory shows only RFCs (eyebrow `/ docs / rfcs`, brand `rfcs / portal`, topbar nav lists `Directory` rather than per-type entries) while the portal's current `/` renders a cross-type table. Confirmed with the author: **the rfc-site portal is RFC-only at the surface.** Other docz types (ADR / DESIGN / IMPL / PLAN / INV) are **repo-internal artifacts only** — they live in their owning repo's `docs/` tree and serve the engineering workflow (this very INV is one). They are *not* published to rfc-site. RFCs are the org-wide, cross-team docs that earn portal surface area.

Two cross-repo consequences of this scope:

- **rfc-api still indexes all 6 types** per [rfc-api DESIGN-0002](https://github.com/donaldgifford/rfc-api/blob/main/docs/design/0002-documenttype-extensibility-for-multiple-content-types.md) — its corpus is broader than the portal's. `/api/v1/docs` (cross-type) is reserved per that DESIGN for "activity feeds, cross-corpus MCP tooling, and any consumer that wants 'everything'". The portal is *not* one of those consumers and should narrow to RFCs at the consumer layer.
- **Cross-doc references in RFC bodies** ("per ADR-0001", "see DESIGN-0002") refer to repo-internal artifacts the portal cannot resolve. Today our `<Anchor>` component renders unresolved internal-looking hrefs as `<span data-broken-link>`. A policy decision is needed — surfaced as a new finding under §Findings → cross-cutting.

This scope clarification answers the largest open question raised by the first-pass Directory audit and is load-bearing for every other view in this inventory. **All §Findings below assume RFC-only scope unless explicitly tagged otherwise.**

A new tag joins the conventions from §Approach:

- `#rfc-only-scope` — applies to findings that exist today *only because* of the dropped cross-type assumption. These are over-engineered surfaces or fixtures that should be removed or narrowed.

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

### Cross-cutting — over-engineered surfaces from the dropped cross-type assumption

Surfaces that exist today *only because* IMPL-0001 / IMPL-0002 / IMPL-0004 were built on the (now-disproven) assumption that the portal would surface all 6 docz types. Per §Context's RFC-only scope clarification, these need to be removed or narrowed.

- **`<DirectoryToolbar>`'s Type filter is dead-on-arrival.** Phase 7b shipped a multi-select Type pill panel inside a `<details>` disclosure. With only one type to ever show, this control has nothing to filter. Mockup correctly shows the cascading filter menu's fields as **Authors** + **Labels** (no Type — implied by scope). Remove the Type filter from the toolbar; replace with Authors / Labels filters once their `?filter=author:` / `?filter=labels:` contracts land in rfc-api (DESIGN-0003 §Filter semantics already names them as Phase 2 extension targets). `#directory` `#rfc-only-scope` `#upstream-data` `#portal-visuals`
- **`<SearchModal>`'s 6 filter pills are wrong scope.** Phase 9b shipped `All / RFC / ADR / Design / Impl / Plan / Inv` — the 6-type filter set was correct *only* under the cross-type assumption. Mockup's search section uses different filter axes (need to audit; likely Authors + Labels + status, similar to the directory). Remove the Type pills; replace with the mockup's filter shape. `#search` `#rfc-only-scope` `#portal-visuals` (audit will refine after the §Search section populates).
- **`<SearchModal>`'s `?filter=type:...` payload narrowing** uses the Phase 9b filter pills to client-side narrow the rendered `SearchResult[]`. Once the pills go, this client-side filter goes with them; the modal's payload becomes whatever rfc-api's `searchDocs` returns under the implicit "RFC-only" narrowing (`?type=rfc` is already supported on `/api/v1/search` per the openapi spec, so this is just a parameter the portal pins). `#search` `#rfc-only-scope`
- **MSW fixture corpus is over-broad.** `tests/examples/docs/<type>/` has 8 fixtures across all 6 types (1 IMPL, 1 DESIGN, 1 INV, 2 ADR, 1 PLAN, 2 RFC). Those non-RFC fixtures represent rfc-api's broader registry surface (valid for *its* corpus per DESIGN-0002) but mislead the portal-side dev mode — `just dev-msw` renders surfaces that won't exist in production. Two options: (a) drop the non-RFC fixtures, (b) keep them so MSW dev mode tests doc-page rendering for all types (since the `$type.$id.tsx` route does need to handle non-RFC types when reached via direct URL — see cross-doc reference policy below). Decision deferred to the spawning DESIGN doc. `#directory` `#search` `#rfc-only-scope` `#design-decision`
- **`<DirectoryTable>` ID column shows canonical `RFC-0001`**, but the mockup expects bare numeric `0011` because type is implied by scope. Pure presentation change in `<DirectoryTable>`; URL form (`urlIdFromCanonical`) already strips to bare numeric and that's what `_index.tsx` routes against. `#directory` `#rfc-only-scope` `#portal-visuals`

### Cross-cutting — cross-doc reference policy

RFCs frequently reference repo-internal docz artifacts in their bodies — "per ADR-0001", "see DESIGN-0002", "tracked in IMPL-0003". Under the RFC-only scope, the portal cannot resolve these to portal routes (there's no `/adr/0001` page; ADR-0001 lives in some repo's `docs/adr/0001-...md`).

Today's behavior: `<Anchor>` (IMPL-0003 Phase 4 — `src/portal/markdown/components/Anchor.tsx`) resolves doc links via `links[].target` → `links[].href` → external `<a target=_blank rel=noopener>` → `<span data-broken-link>` for unresolved internal-looking hrefs. With non-RFC links no longer resolvable through the portal, the third → fourth fallback is what fires for every "see ADR-0001"-style reference.

Three policies to consider:

1. **Surface as broken** (status quo) — `<span data-broken-link>` with some visual treatment. Honest but ugly; treats internal-only refs as bugs.
2. **Resolve to GitHub source URL** — `links[].href` already carries the source-repo path for each doc; for non-RFC types we could render an external link to the source repo's `docs/<type>/<id>...md`. Requires rfc-api to expose the source URL even for non-portal-indexed types (it likely already does — `Document.source.repo` + `Document.source.path` are in the schema).
3. **Hide entirely** — render the reference text but strip the link. Cleanest visually; loses the navigation affordance.

Recommend (2) — keeps the reader's path to the referenced doc viable without claiming the portal can render it. `#rfc-only-scope` `#cross-doc-references` `#portal-visuals` `#design-decision`

### Cross-cutting — missing design-system primitives

> Populated by the per-view findings below. Each entry: primitive name, the
> views that motivate it, sketch of the API shape (binding decisions deferred
> to a DESIGN doc).

| Primitive | Motivating views | Notes |
|-----------|------------------|-------|
| `<TableOfContents>` / `<DocTOC>` | RFC page | Right-column sticky TOC with scroll-spy `.current` highlight + `.nested` indenting for h3-under-h2. Likely lives in `src/components/portal/` (RFC-only, not a candidate) — feeds off `Document.body` headings harvested via the markdown pipeline. |
| `<NumberLine>` (eyebrow) | RFC page | Mono 13px accent `RFC / 0011` eyebrow with fading-gradient `::after` divider above the h1. Trivial — could be inlined into the route, or promoted if reused in the breadcrumb. |
| `<Callout>` (admonition) | RFC page | Maps GFM alert syntax (`> [!NOTE]`, `[!WARNING]`, `[!TIP]`, `[!CAUTION]`) to a saturated-tint surface with circular icon chip. **Requires** a remark/rehype plugin to lift GFM alerts into a `<Callout>` element. Status palette already supplies the colors. |
| `<ReferencesFooter>` | RFC page | Two-column "References / Referenced by" footer for `<article>`. Consumes `Document.links[]` for outgoing refs; "Referenced by" needs an rfc-api back-references endpoint or client-side fan-out. |
| `<RFCRow>` | Directory | The mockup's `.rfc-row` is `grid-template-columns: 80px 1fr 100px 220px 100px` with mono number / serif-italic title / status-badge / authors / updated cells. Likely a portal component (consumes `DirectoryTable`'s data) rather than a ds-candidate — too RFC-specific to promote. |

### Cross-cutting — token / chrome gaps

> Tokens or design-system chrome utilities the mockup uses that the
> design-system doesn't expose yet. Often surface during the per-view audit
> as "this divergence is fixable in rfc-site CSS but the right home is a new
> token in design-system".

- **`--font-serif`** — mockup uses a serif family for `<h1>` (42px / 400) and the prose `<h2>` (26px / 500). The design-system currently exposes `--font-sans` + `--font-mono` only. Adding a third family token is the right home — without it the rfc-site has to either (a) hard-code a `font-family` declaration inside `.rfc-content-header h1` (a token fork — banned by Hard rules) or (b) live with sans h1. Motivated by the RFC page (probably also future Frameworks/About surfaces). `#rfc-page` `#design-system-promote`
- **`--status-{draft,proposed,accepted,rejected,superseded}`** — confirm the design system surfaces these. Mockup uses them both inline (`color: var(--status-draft)`) and via `color-mix(..., var(--status-proposed) 16%, var(--bg-base))` for admonition tints. `<Badge>` consumes them today; admonitions will too. Verify they're public CSS variables, not internal-to-Badge. `#rfc-page` `#design-system-verify`
- **`--bg-raised`** — mockup uses a slightly lighter surface for blockquotes, table headers, admonitions, and mermaid containers. The design-system has `--color-bg-elevated` (used by Card variant=elevated) but the mockup's `--bg-raised` is shallower than `--bg-elevated`. May need a new mid-tier surface token, or rename to align both. `#rfc-page` `#directory` `#design-system-verify`
- **`--code-bg / --code-fg / --code-border / --code-keyword / --code-string / ...`** — design-system 0.3.0 added `--color-code-*` palette wrappers (already in use by the markdown pipeline). Verify the mockup's Tokyo Night token set is fully covered by what the design-system ships. Shiki's dual-theme output emits `--shiki-light` / `--shiki-dark` inline; the chrome surrounding it (border, padding, language badge) uses the design-system `--color-code-*` set. `#rfc-page` `#design-system-verify`
- **`--ease`** — mockup defines a global `--ease` cubic-bezier and applies it to most transitions (`transition: opacity 160ms var(--ease)`). Design-system may already ship a motion token; verify and use it instead of hard-coding `ease-in-out` in portal CSS. `#rfc-page` `#directory` `#design-system-verify`

### Directory view (`/`)

**Current portal state:** `src/routes/_index.tsx` + `<DirectoryToolbar>` + `<DirectoryTable>`. IMPL-0004 Phase 7a + 7b. Loader forwards `?filter[]` + `?sort` to `listDocs`, captures `X-Total-Count` + `X-Total-Count-Unfiltered`, branches the empty state on the unfiltered header. URL state machine + cursor invalidation rules locked in. **Today** the loader hits `/api/v1/docs` (cross-type) and renders all 6 doc types — wrong scope per §Context.

**Loader endpoint decision (was open, now decided in audit):**

Per §Context, the portal is RFC-only. Two paths to load the RFC directory:

- **Path A — `listDocsByType("rfc")`** (per-type endpoint, architecturally correct per rfc-api DESIGN-0002 — "`/api/v1/{type}` is the primary per-type list, `/api/v1/docs` is for everything-consumers"). **Cost:** loses Phase 7b's filter/sort URL-state machine — DESIGN-0003 OQ8 explicitly deferred extending `?filter=` / `?sort=` to per-type endpoints ("YAGNI"). Requires a rfc-api contract follow-up to extend DESIGN-0003 to `listDocsByType` before the toolbar's sort/filter can come along.
- **Path B — `listDocs?filter=type:rfc` pinned in the loader** (cross-type endpoint, narrowed to RFC at the consumer). Keeps Phase 7b filter/sort working as-is. Slightly off-pattern relative to rfc-api DESIGN-0002 (the cross-type endpoint is intended for "everything"-consumers), but justifiable: rfc-api hasn't extended filter/sort to per-type yet, and `listDocs` is the only endpoint that has the contract we need.

**Recommendation:** ship Path B in the visual-rework IMPL (no cross-repo gating); open a follow-up rfc-api issue to extend DESIGN-0003 contract to `listDocsByType` so we can migrate to Path A long-term. `#directory` `#rfc-only-scope` `#upstream-data`

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

**Structural mismatch — resolved.** First-pass audit raised two interpretations of the mockup's single-type directory; §Context's RFC-only scope clarification (2026-05-14) resolved this: the portal is RFC-only at the surface; `/` *is* the RFC directory. No per-type routes for ADR / DESIGN / etc. — those are repo-internal artifacts. The mockup's design is literal and correct; the portal's current cross-type `/` is the mistake.

### RFC page (`/$type/$id`)

**Current portal state:** `src/routes/$type.$id.tsx` mounts a **two-column** layout — `<DocSidebar>` (right column, `<Card variant="elevated">` blocks for Status / Authors / Created / Updated / Source / Discussion / Labels) + `<DocumentView>` (left column, Markdown pipeline). Above the layout sits a header containing a `Directory / <doc.id>` breadcrumb, an `<h1>` + `<Badge>` row, a dateline (`{id} · updated <RelativeDate> · created <RelativeDate>`), and an "authors" line. Doc prose is styled via `src/portal/markdown/styles.css` (`.markdown-body` sans 15px / 1.65, h1=32px / h2=26px with hairline underline / h3=22px / sans throughout). `<RFCPreviewCard>` (hover popover on cross-doc `<Anchor>` links) shipped Phase 8b. **Per the new scope, only RFC docs are reached via portal navigation; non-RFC types (ADR/DESIGN/IMPL/PLAN/INV) are addressable only via direct URLs as fallbacks for cross-references — see Cross-cutting cross-doc reference policy.**

**Mockup expectations** (mockup §641-1248 CSS + §3093-3559 body markup):

- **Three-column grid, not two.** `.rfc-view { display: grid; grid-template-columns: 240px minmax(0,1fr) 240px; gap: 56px; max-width: 1400px; padding: 56px 32px }`. The portal collapses left+right into a single right column at 280px.
- **Left sidebar = metadata** (`.rfc-sidebar-left`, `position: sticky; top: 88px`): blocks for "Metadata" (Status / Author / Created / Updated / Revision / PR) and "Labels". Mono 12px throughout, with `.sidebar-heading` mono 10px uppercase tracked 0.14em and a hairline `border-bottom`. `.meta-row` is a flex row: `.key` (mono 11px tertiary) left, `.val` (mono 11px primary) right-aligned. Status val is colored inline (`color: var(--status-draft)` etc.); PR val uses `color: var(--accent)`.
- **Right sidebar = TOC only** (`.rfc-sidebar-right`, sticky `top: 88px`, mono 11px): a "On this page" `.sidebar-section` wrapping a `.toc-list` with `.current` (active section gets `color: var(--accent)` + `border-left` accent), `.nested` items get an additional left indent. Mockup's TOC scroll-spy is purely client-side (no API surface).
- **Center = article content**:
  - `.rfc-content-header { pb: 32px; border-bottom: hairline; mb: 40px }`.
  - `.number-line` is a mono 13px accent string like `RFC / 0011` with a fading-gradient `::after` divider — `display: flex; align-items: center` + `font-family: var(--font-mono); color: var(--accent); letter-spacing: 0.06em`.
  - `h1`: **`font-family: var(--font-serif); font-size: 42px; font-weight: 400; line-height: 1.12; letter-spacing: -0.02em`**. Portal uses **sans 36px font-weight-700** — visually very different surface.
  - `.rfc-header-meta`: mono 12px tertiary, flex gap 20px, with status-badge first then `·` dividers, authored-by linked in accent, revision, relative time.
- **`.rfc-prose`** (15.5px / 1.72; very close to portal):
  - `h2` is **`font-family: var(--font-serif); font-size: 26px; font-weight: 500; letter-spacing: -0.015em`** with a mono `#` prefix (`.hash`) revealed on hover; portal uses **sans 26px hairline underline**.
  - `h3` is sans 17px 600 weight (close to portal's sans 22px — note size delta).
  - `p` color is `--fg-secondary` (portal uses `--fg-primary`); `p strong` upgrades to primary 500.
  - `ul / ol`: `padding-left: 24px`, `li::marker` color `--fg-muted`.
  - **Inline `code`**: mono 13px, subtle border + `--code-bg` chip — portal is already close, just verify token mapping.
  - **`pre` (code block)**: Tokyo Night palette; mono 13px / 1.65; padding `18px 22px`; **language badge via `pre[data-lang]::before` floating top-right** (`text-transform: uppercase; letter-spacing: 0.14em`). Portal uses Shiki output and does not surface a `data-lang` chip.
  - **Blockquote**: `bg: var(--bg-raised)`, hairline border, italic, mono-style `::before` quote-mark glyph in `--fg-muted`. Portal uses left-accent-bar pattern (different visual).
  - **Cross-RFC link with hover preview**: `.rfc-link` accent-colored with dotted underline + nested `.preview-card` revealed on hover (`pc-num` mono accent, `pc-title` serif 15px, `pc-meta` mono 10px with status-dot, author handles, date). Portal has `<RFCPreviewCard>` which is conceptually equivalent but visual chrome diverges (Card surface vs the mockup's bespoke 320px-wide preview).
  - **Admonitions** (`.admonition.note / .warning / .tip / .caution`): saturated tinted backgrounds via `color-mix` against the status color, circular icon chip floated left (note=`i` italic-serif, warning=`!`, tip=`✓`, caution=`✕`), no left border. Sharp corners (`border-radius: 0`). The Markdown pipeline emits `<blockquote>` for `> [!NOTE]` — no admonition primitive yet.
  - **`.codeblock` + `.codeblock-header`**: opt-in header chrome with `.lang` (mono uppercase 10px accent type-color) + `.caption` (mono 11px tertiary), separated by `background: color-mix(--code-bg + 20% black)`. Mockup also defines `.ascii-diagram` (narrow code-block variant, no language tag, with `.hl` / `.dim` token classes — see also the `mermaid-marker` plugin already in place).
  - **Tables**: `.table-caption` mono 11px tertiary with `▸ ` accent prefix; `th` mono 10px uppercase tracked 0.1em on `--bg-raised`; td uses hairline borders. Portal's `markdown-body` table is close but lacks the accent-prefixed caption / mono-uppercase th treatment.
  - **`.mermaid-diagram`**: padded `--bg-raised` container + centered `.mermaid-caption` (mono 11px tertiary). Portal renders mermaid via `<MermaidBlock>` without the caption sub-element.
- **Article footer** (`.rfc-footer`, **at the bottom of `<article>`, not in the sidebar**): two-column `grid-template-columns: 1fr 1fr; gap: 48px`, headings "References" and "Referenced by" (each mono 10px uppercase tracked 0.14em with hairline underline). Each ref is a `.rfc-footer-ref` flex row: `.r-num` mono 12px accent (min-width 72px) + `.r-title` 14px secondary. Empty state: `.rfc-footer-empty` mono 12px muted "None yet — no other RFCs reference this one." **Portal has no footer surface at all** — references come from the `links[]` array on the doc payload but only `<Anchor>` resolution consumes it.

**Gap:**

- **Layout: 2-column → 3-column.** Portal uses `minmax(0,1fr) 280px` (prose + right sidebar). Mockup is `240px 1fr 240px` (metadata + prose + TOC). Two structural moves required: (a) split `<DocSidebar>` so metadata moves to the **left** column and (b) introduce a new **right-column TOC** component. Page-shell padding also widens (`max-width: 1400px` vs portal's `1180px`) and gap grows (`56px` vs `--space-8`). `#rfc-page` `#portal-layout`
- **Header typography swap (serif h1).** Mockup's `h1` is **serif 42px font-weight 400**; portal renders sans 36px 700. The serif family is a token (`--font-serif`) that exists in the mockup but is **not currently exposed by the design system** (verify in §Cross-cutting / missing primitives). Either (a) add a `--font-serif` token + apply to `.rfc-content-header h1` + h2/h3 in prose, or (b) deliberately keep the sans h1 and document the divergence. `#rfc-page` `#design-system-promote` `#portal-visuals`
- **`.number-line` prefix.** Mockup renders a discrete `RFC / 0011` mono-accent eyebrow above the h1 with a fading-gradient `::after` divider. Portal surfaces `{id}` inline in the dateline below the title instead. Trivial leaf change — promote a `<NumberLine>` portal component or inline the `.number-line` markup directly. **Note:** with the RFC-only scope decided, the literal `RFC / NNNN` form can be hard-coded (no `<type>` prefixing logic). `#rfc-page` `#portal-visuals`
- **Header meta row layout.** Mockup pattern: `Badge · authored by <accent>name</accent> · revision N · 2 hours ago`. Portal renders: `<h1><Badge/>` on the same row, then dateline + authors on separate lines. Reconcile to mockup's single `flex gap-5 mono-12 tertiary` row. Note: **revision** is not in the current `Document` schema — see API gap below. `#rfc-page` `#portal-visuals`
- **Metadata sidebar visual treatment.** Mockup's `.sidebar-section` is **chrome-less**: just a `.sidebar-heading` (mono 10px uppercase tracked 0.14em with hairline underline) over a list of `.meta-row` (key flex-left, val flex-right). Portal wraps each metadata facet in `<Card variant="elevated">` with `--shadow-sm`, producing visible chip-like cards. Decision: drop the Card chrome and adopt the flat sidebar (the design-system's `--tracking-wider` token is already used for the label — only the surrounding Card needs to go). `#rfc-page` `#portal-visuals`
- **Status val is color-coded inline in the metadata row, not a Badge.** Mockup: `<span class="val" style="color: var(--status-draft);">Draft</span>` — a colored span, no background pill. Portal: full `<Badge>` primitive. Either keep the Badge (richer) or hew to mockup's plain-colored-span — Badge already maps `status → color` so this is a CSS-only choice. `#rfc-page` `#design-decision`
- **Missing TOC sidebar.** No `<TableOfContents>` component exists. Required: walk the rendered hast (or harvest from `rehype-slug` output) to emit a `<nav>` + `<ul>` with `id`-anchored links and (eventually) IntersectionObserver-driven `.current` highlighting. Mockup also marks nested headings (`.nested`) for h3-under-h2 indenting. Two flavors of implementation: (a) build from `Document.body` markdown at render-time on the client (simple, no API change), or (b) extend `rfc-api`'s Document payload with a `toc: { id, title, level }[]` field (cheaper SSR but contract surface area). **Recommend (a) for now** — keep the contract narrow and let the markdown pipeline compute the TOC. `#rfc-page` `#portal-new-component`
- **Missing references footer.** Mockup ends each article with a two-column footer (References / Referenced by). `Document.links[]` partially supplies this (the outgoing direction) — `Referenced by` requires a **new API field or endpoint** on `rfc-api` for the inverse edges (or the loader could synthesize it by listing all RFCs and filtering). Decision needed: (a) ship References only (existing data) + leave "Referenced by" out, (b) lean on `links[]` heuristically (filter by `kind === "references"` if the contract surfaces it), or (c) extend `rfc-api` with a `/api/v1/rfc/{id}/back-references` endpoint. **Recommend (a) for first pass** + file a follow-up RFC against rfc-api for back-refs. `#rfc-page` `#portal-new-component` `#rfc-api`
- **Prose visual deltas:**
  - **h2 / h3 family.** Mockup h2 is serif 26px 500 + mono `#` hash prefix on hover; portal is sans 26px 600 with hairline underline. Tied to the `--font-serif` decision above. `#rfc-page` `#portal-visuals`
  - **`p` default color.** Mockup uses `--fg-secondary` for body copy + `--fg-primary` for `<strong>`; portal uses `--fg-primary` for body. Quiet but visible visual change. `#rfc-page` `#portal-visuals`
  - **Code-block language badge.** Mockup floats a `data-lang` chip top-right via `pre[data-lang]::before`. Portal's Shiki output does not emit `data-lang` — would need a rehype plugin (or extend `mermaid-marker`) to carry the `meta.lang` through to a hast property. `#rfc-page` `#portal-visuals`
  - **Blockquote chrome.** Mockup is raised-bg italic + decorative serif `"` glyph; portal is left-bar with no glyph. Cosmetic. `#rfc-page` `#portal-visuals`
  - **Admonitions.** Mockup defines `.admonition.note / .warning / .tip / .caution` with saturated tints + circular icon chip. The markdown pipeline emits ordinary `<blockquote>` for GFM's `> [!NOTE]` callout syntax. **Needs a rehype plugin** to lift GFM alerts into `.admonition` markup + a CSS layer (or a new `<Callout>` ds-candidate). Sharp corners + status-color tints align with the design-system status palette. `#rfc-page` `#design-system-promote`
  - **Tables.** Mockup `th` is mono 10px uppercase tracked 0.1em on `--bg-raised`; portal `th` is sans 600 on `--bg-elevated`. Mono uppercase is the consistent table-header treatment across the mockup. `#rfc-page` `#portal-visuals`
  - **Mermaid caption.** Mockup pairs `.mermaid-diagram` with a centered `.mermaid-caption` (`<figcaption>` if we want to be semantic). Trivial extension of `<MermaidBlock>` — accept a `caption` prop or read from a sibling element. `#rfc-page` `#portal-visuals`
- **Cross-RFC preview-card visual chrome.** Mockup's 320px preview card uses a bespoke layout (`pc-num` mono accent / `pc-title` serif 15px / `pc-meta` mono 10px with status-dot + handles + month-year). Portal's `<RFCPreviewCard>` uses a `<Card>` surface composed of portal helpers. Visual reconciliation needed — likely just CSS in `<RFCPreviewCard>`. `#rfc-page` `#portal-visuals`
- **Schema gap: `revision`.** Mockup's metadata row surfaces `Revision: 4`. The current `Document` schema has no `revision` field. Either drop the row, derive from `source.commit` ("ref" → short SHA), or extend rfc-api. **Recommend deriving from `source.commit`** (display the first 7 chars) — no contract churn. `#rfc-page` `#rfc-api` `#design-decision`
- **Schema gap: `pr` link.** Mockup's metadata row surfaces `PR: #412` colored in accent. The current `Document` schema has `discussion?: { url, comment_count }` (Phase 8a wired this into the sidebar's "Discussion" block). Reuse `discussion.url` and display the trailing path segment as `#412` instead of "View discussion". Single CSS / formatter change. `#rfc-page` `#portal-visuals`
- **Updated-cell relative time.** Mockup shows `2h ago` in the metadata row + `2 hours ago` in the header meta. Portal shows `Apr 29, 2026` via `Date.toLocaleDateString()` in both places. Same decision the Directory `Updated` column raised — reconcile globally (relative-only / absolute-only / relative-with-absolute-on-hover). `#rfc-page` `#directory` `#design-decision`
- **`<DocSidebar>` "Source" block.** Mockup's metadata sidebar has no "Source: github.com/..." block — it's implicit in the page URL + revision + PR. Portal's Source block surfaces the GitHub deeplink. **Keep it** — useful for "view raw" / "edit on GitHub" affordances even if the mockup omits it. (Optionally move below the article into the footer.) `#rfc-page` `#design-decision`

### Search modal + `/search` route

**Current portal state:** `<SearchModal>` is a fixed-position overlay (`width: ~640px`-ish via the dialog styles; verify in CSS module) with: a header (h2 + Close `<Button>`), a search `<Input>`, a filter-pill toolbar (`All` + 6 per-type pills via `<Badge variant="filter">`), grouped results bucketed by `document.type` with sticky uppercase mono `<h3>` headers, a side preview pane that calls `useGetDoc` lazily, and an `<Esc>` / `<↵>` footer. Focus is trapped via a `keydown` listener; `?modal=1` mirrors open state to the URL; backdrop click + Escape close. The legacy `/search` route (IMPL-0003 Phase 7) renders the same `searchDocs` payload but with a single-column hit list using `<Snippet>` — no preview pane, no filter pills, no grouping. (IMPL-0004 Phase 9a + 9b, 14 tests.)

**Mockup expectations** (mockup §1250-1490 CSS + §3602-3725 body markup):

- **Overlay** (`.search-overlay`): `position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); padding-top: 96px`. Modal mounts top-of-page, not vertically centered.
- **Modal shell** (`.search-modal`): `width: 780px; max-width: calc(100vw - 48px); background: var(--bg-raised); border: 1px solid var(--border-default); box-shadow: 0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.4); max-height: calc(100vh - 192px)`. Sharp-ish corners (`--r-sm`).
- **Input row** (`.search-input-row`): borderless inline-flex `[icon] [<input>] [esc-hint]`, padding `18px 22px`, hairline `border-bottom`. **The Close button does not exist** — the only dismiss affordance inside the modal is the inline `<span class="kbd">esc</span><span>to close</span>` cluster on the right.
- **Filter pills row** (`.search-filters-row`): `flex; gap: 4px; padding: 10px 20px; background: var(--bg-base); font-family: var(--font-mono); font-size: 11px`. Pills are **`all results 12` / `titles` / `body` / `authors` / `labels`** — i.e. **content-scope filters, not document-type filters**. Active pill: `color: var(--accent); background: var(--accent-bg)`. The "all results" pill carries a result-count chip (`<span style="color: var(--accent-dim); margin-left: 4px;">12</span>`).
- **Results grid** (`.search-results`): `grid-template-columns: 320px 1fr; overflow-y: auto`. Two scrolling regions side-by-side, hairline border between.
- **Result list** (`.search-results-list`): grouped by **content kind** (`RFCs — 8 matches`, `Labels — 1 match`, presumably `Authors`, `Sections` etc.) — **not by `document.type`**. Group headers (`.result-group-header`): sticky, mono 10px uppercase tracked 0.12em, `bg: var(--bg-base); border-bottom: hairline`.
- **Result item** (`.result-item`): three-row layout — `.ri-top` (flex-row: `.ri-num` mono 10px accent + `.ri-status` status-badge SM right-aligned), `.ri-title` (13.5px primary, `-webkit-line-clamp` 2 implied), `.ri-snippet` (11.5px tertiary, `-webkit-line-clamp` 2). Active hit: `background: color-mix(in srgb, var(--accent) 8%, var(--bg-elevated))`. `<mark>` inside `.ri-snippet` uses `bg: var(--accent-bg); color: var(--accent)`. Label results have a special form: `.ri-num` reads `LABEL` (in `--fg-tertiary` instead of accent), `.ri-status` shows `9 RFCs`, and the `.ri-title` is just the label name.
- **Preview pane** (`.result-preview`): full-width column 2, `bg: var(--bg-base); padding: 24px 28px`. `.rp-header`: `pb: 16px; mb: 18px; border-bottom: hairline`. `.rp-num-line`: mono 11px accent eyebrow. `.rp-title`: **serif 22px font-weight 400** — same serif decision as the RFC h1. `.rp-meta`: flex gap 14px mono 11px tertiary with `·` dividers in `--fg-muted`. `.rp-body`: 13.5px / 1.65; **`<h3>` rendered as uppercase mono 13px tertiary section headers** (Summary / Motivation / Proposed Solution). Match-highlights via `<mark>`.
- **Footer** (`.search-footer`): hairline border-top, `bg: var(--bg-base); padding: 10px 20px`, mono 10px tertiary. Hints: `↑↓ navigate`, `↵ open`, `tab preview`. **`.search-footer .powered`** right-aligned (`margin-left: auto`): `meilisearch ● 12ms` — engine name + latency dot.

**Gap:**

- **Filter pills: WRONG SCOPE.** Portal pills filter by `document.type` (RFC / ADR / Design / Impl / Plan / Inv). Mockup pills filter by **content kind / facet** (all / titles / body / authors / labels). Two consequences: (a) per the RFC-only scope, type filters are dead-on-arrival anyway (every result is `type === "rfc"`), and (b) the mockup's facet filters need a contract change — `searchDocs` would need a `field` (or `match_in`) param to restrict to title-only / body-only / authors / labels. **Today** the OpenAPI `SearchResult` envelope returns `matched_terms` but no field-of-match, so the portal can't even do client-side bucketing. **Decision needed**: rip the type pills out, replace with content-scope pills, and (probably) extend `rfc-api`'s `searchDocs` contract. `#search` `#rfc-only-scope` `#rfc-api`
- **Result grouping: wrong dimension.** Portal buckets by `document.type` with sticky group headers. Mockup buckets by **content kind** (`RFCs`, `Labels`, possibly `Authors`, `Sections`). Tied to the filter decision above — the grouping should mirror the facet pills. `#search` `#portal-visuals`
- **Mixed-shape result items.** Mockup's `Labels — 1 match` group has a label result that isn't an RFC: id reads `LABEL` (tertiary, not accent), status reads `9 RFCs`, title is just the tag name. This implies the API has at least three (and possibly more) result-envelope kinds (`document`, `label`, `author`, possibly `section`). Today portal's `SearchResult.document` is the only result shape. **Contract gap on rfc-api**: search needs to surface more than just doc-matches. `#search` `#rfc-api`
- **Preview-pane visual divergence.** Portal's preview is a `<Card variant="elevated">` (visible border + shadow); mockup's is borderless using only `bg: var(--bg-base)` + a hairline rule under `.rp-header`. Portal title is sans (h2 24-ish via the design-system styles); mockup is **serif 22 / 400**. Section headings in `.rp-body` are mono-uppercase, not the default `<h3>` rendering. `#search` `#portal-visuals`
- **Missing meilisearch latency footer.** Mockup's `.search-footer .powered` shows `meilisearch ● 12ms`. Portal's footer has only `<Kbd>Esc</Kbd> close` and `<Kbd>↵</Kbd> search`. To wire the latency surface, `searchDocs` would need to return a `meta: { engine, latency_ms }` field — or the portal can compute round-trip from the `fetch` Promise + display "engine name" as a static label. **Recommend** computing latency client-side from the request promise; do not extend the OpenAPI surface for a UI flourish. `#search` `#portal-visuals`
- **Missing keyboard nav (↑↓ navigate, ↵ open, tab preview).** Mockup hints these in the footer but portal has no `↑/↓` handler — the user has to Tab through `<Link>`s. Real keyboard nav over the result list is a non-trivial addition: roving tabindex, active-result tracking, `Enter` to open. Today `setActiveResult` only fires on mouse hover / focus events; would need to be the source-of-truth keyboard cursor. `#search` `#portal-keyboard`
- **Missing "all results 12" count chip on the active pill.** Mockup's active pill has an inline result-count badge appended. Trivial — `<Badge variant="filter">` would need a `count` slot or the count rendered as a child. `#search` `#portal-visuals`
- **Header chrome simplification.** Portal renders an explicit `Search documents` h2 + Close `<Button>` header above the input. Mockup has neither — the `<input>` row IS the header, with the `esc to close` inline-kbd cluster providing dismissal affordance. Drop the header row. `#search` `#portal-visuals`
- **Sticky group-header chrome.** Portal heading uses `<h3>` with a count `<span>`; mockup uses a flat `.result-group-header` div pinned with `position: sticky; top: 0; z-index: 1`. Form is close enough; the differences are typography (10px / 0.12em tracking) + the `bg: var(--bg-base)` solid surface that hides scrolling rows beneath. `#search` `#portal-visuals`
- **Result-item active-state coloring.** Portal sets `background: var(--color-bg-elevated)` on the active item (verify in CSS module). Mockup uses `color-mix(in srgb, var(--accent) 8%, var(--bg-elevated))` — a subtle accent tint, not a flat hover swap. Token-only change. `#search` `#portal-visuals`
- **`/search` route as no-JS fallback.** The legacy route has none of the filter pills, grouping, preview pane, or keyboard affordances. If we want it to remain a useful fallback (vs a "graceful but ugly" surface), it needs at minimum the facet-pill row (since that's the search-API contract change anyway) — but the preview pane and keyboard nav arguably aren't required on a no-JS surface. **Decision needed:** treat `/search` as feature-parity with the modal, or accept it as a degraded fallback? **Recommend the latter** to avoid duplicating the JS interactions. `#search` `#design-decision`
- **Search-results-list scroll region.** Mockup uses `grid-template-columns: 320px 1fr` with the list scrolling independently of the preview pane (both `overflow-y: auto`). Portal currently uses a single body grid (verify in `SearchModal.module.css`). Two-pane scrolling is the only sane affordance for the preview pattern; verify the wiring. `#search` `#portal-layout`

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
