---
id: INV-0002
title: "Inventory components needed from the rfc-portal mockup"
status: Resolved
author: Donald Gifford
created: 2026-05-11
---
<!-- markdownlint-disable-file MD025 MD041 -->

# INV 0002: Inventory components needed from the rfc-portal mockup

**Status:** Resolved
**Author:** Donald Gifford
**Date:** 2026-05-11

<!--toc:start-->
- [Question](#question)
- [Hypothesis](#hypothesis)
- [Context](#context)
- [Approach](#approach)
- [Findings](#findings)
  - [Mockup views (six)](#mockup-views-six)
  - [Components needed — ds-candidates/ (reusable primitives)](#components-needed--ds-candidates-reusable-primitives)
  - [Components needed — portal-only composites](#components-needed--portal-only-composites)
  - [Already shipped (skip)](#already-shipped-skip)
- [Conclusion](#conclusion)
- [Recommendation](#recommendation)
  - [Build order](#build-order)
  - [How to capture the work](#how-to-capture-the-work)
- [References](#references)
<!--toc:end-->

## Question

What UI components — primitives and portal-only composites — does `rfc-site` still need to build to reach visual parity with `donaldgifford/design-system/rfc-portal-mockup_15.html`?

The mockup has been the soft visual reference since [IMPL-0001](../impl/0001-bootstrap-portal-scaffold-per-design-0001.md) Phase 4 (directory card grid) and Phase 5 (`<Badge>` promotion), but we never produced an explicit inventory of *everything else* it depicts. With IMPL-0001 / IMPL-0002 / IMPL-0003 all closed, the portal renders real data through real Markdown — but only three of the six mockup views (Directory, RFC Page, Search) exist as routes, and the visual treatment of those three is still ad-hoc relative to the mockup. Before we open a new IMPL doc to "ship the rest of the components", we need a concrete list.

## Hypothesis

The mockup's distinct UI elements partition cleanly into:

1. A small set of generic primitives reused across multiple views (Button, Input, Card, Tabs, Code-block, Breadcrumb, Kbd, Pill) — promotion candidates for `@donaldgifford/design-system`.
2. A larger set of page-specific composites that wire those primitives together with portal data (Topbar, Directory table + toolbar, Search modal, RFC sidebar + preview card, API sidebar + content, Frameworks sidebar + content, MCP hero + downloads).
3. Three views that don't have routes yet (API, MCP, Frameworks) and need to land before their composites have a home.

The expectation is that the `ds-candidates/` half can be built bottom-up without committing to the new routes, and that one or two primitives (Button most likely) gate most of the rest of the work.

## Context

The mockup is the agreed visual reference; what we're missing is the *plan* against it.

**Triggered by:** post-IMPL-0003 follow-up — `feat/components` branch opened to start building primitives, but with no inventory the scope is unbounded. CLAUDE.md §Repo state confirms IMPL-0001/0002/0003 are closed and "next impl-level work" is open.

**Other constraints flowing in:**

- [DESIGN-0001](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md) §The `ds-candidates/` contract — the promotion model and authoring rules.
- [INV-0001](./0001-ship-css-modules-from-design-system-tsup-build.md) — primitive CSS shape (prefixed global class) and tsup-build path that newly authored candidates will follow.
- `@donaldgifford/design-system@0.3.0` (just bumped) — added `--shadow-*` / `--tracking-*` / `--z-*` primitive token groups specifically to unblock chrome / popovers / modals / nav layering that this inventory needs.

## Approach

1. Survey `/Users/donaldgifford/code/design-system/rfc-portal-mockup_15.html` (≈4500 lines, six top-level views). Identify the section boundaries and sample the HTML of each view to extract its distinct UI elements.
2. Cross-reference against:
   - `@donaldgifford/design-system` published exports (`src/index.ts`, `src/primitives/`, `src/theme/`, `src/tokens/`, CHANGELOG).
   - `src/components/portal/` (inline portal composites already shipped).
   - `src/components/ds-candidates/` (currently empty after `<Badge>` promoted out in IMPL-0001 Phase 6).
   - `src/routes/` (which mockup views actually have routes).
   - `src/portal/markdown/` (the IMPL-0003 components — page-bound, not promotion candidates).
3. Bucket missing components into **`ds-candidates/` (promote-ready primitives)** vs **portal-only (page composites)**, with a one-line rationale + reuse count per item.
4. Recommend a build order based on the primitive dependency graph (which components unblock the most others).

Audit performed via Explore subagent against the mockup HTML and the repo on 2026-05-11.

## Findings

### Mockup views (six)

- **Directory** — table layout (numbered cells, title + labels, status badges, authors, timestamps), live filter input, toolbar (filter triggers, sort, count).
- **RFC Page** — two-column layout: left sidebar (status / author / created / updated / revision / PR link + labels) + right prose (headings, tables, ASCII diagrams, admonitions, code blocks); cross-RFC links show a hover preview card.
- **Search** — full-page modal: search input, filter pills (all / titles / body / authors / labels), grouped results (RFCs + labels), side preview pane with snippet highlighting, keyboard-hint footer (`⌘K`, `↑↓`, `↵`, `esc`).
- **API** — left sidebar (endpoints grouped, GET/POST badges) + main content (endpoint header, path with path-param styling, "Try it" banner, param tables, tabbed example code with multiple languages).
- **MCP** — hero section, two info cards (version / size badges), download grid (platform cards with icons), expandable setup sections, tabbed example code (Claude Code / Cursor / Claude Desktop).
- **Frameworks** — left sidebar (expandable tree, version badges) + main content (breadcrumb, detail header with metadata groups, collapsible rule rows with severity pills).

### Components needed — `ds-candidates/` (reusable primitives)

Ordered by reuse count + dependency-graph priority.

| Component | Used in | Notes |
|---|---|---|
| **`<Button>`** | All 6 views (~15+ instances) | Primary / secondary / icon-button variants. Blocking dep for Tabs, Downloads, filter triggers, CTAs. |
| **`<Input>`** (and `<SearchBox>` composite) | Directory live filter, Search modal | Text input with optional prefix icon + suffix `<Kbd>` slot. |
| **`<Kbd>`** | Topbar (`⌘K`), Search footer (`↑↓`, `↵`, `esc`) | Tiny keyboard-hint badge — small enough that it could ship in the same PR as `<Input>`. |
| **`<Card>`** | RFC sidebar metadata blocks, MCP info cards, Download grid, framework rule rows | Elevated container surface — `--shadow-sm` / `--shadow-md` from v0.3.0 unblock this. |
| **`<Tabs>`** | API examples (curl / Go / TS), MCP setup (Claude Code / Cursor / Desktop) | Horizontal tab switcher. |
| **`<CodeBlock>`** | API examples, MCP code samples | Wraps Shiki-highlighted `<pre>` with language label + copy button. **Note**: distinct from `src/portal/markdown/components/Code.tsx`, which is page-bound to `<DocumentView>`; this one is the standalone primitive for non-Markdown contexts. |
| **`<Breadcrumb>`** | Frameworks header, API endpoint paths | Segmented path display with path-param styling (`/api/v1/{type}/{id}`). |
| **`<Pill>`** (filter / severity variant) | Search filter chips, framework severity (critical / high / medium / low) | Open question: extend `<Badge>` with new variants vs. ship a sibling primitive. Decide before authoring. |

### Components needed — portal-only composites

Live in `src/components/portal/` (or directly in route files for one-shot layouts). **Never promoted.**

| Component | Lands in | Notes |
|---|---|---|
| **`<Topbar>`** | All routes via `src/root.tsx` Layout | Sticky 3-col grid: brand + centered search widget + nav links/avatar. Shared by every view. |
| **Directory table + toolbar** | `src/routes/_index.tsx` | Replaces the current card grid with the mockup's table shape (number / title+labels / status / authors / updated) + filter menu + sort + results count. |
| **Search modal overlay** | `src/routes/search.tsx` upgrade | Upgrades the current minimal `/search` page (IMPL-0003 Phase 7) to the mockup's full-page modal — filter pills, grouped results, preview pane, footer hints. |
| **RFC sidebar + preview card** | `src/routes/$type.$id.tsx` | Left metadata column + hover popover on cross-RFC links (composes with `<Anchor>` from `src/portal/markdown/components/`). |
| **API sidebar + content** | new route `src/routes/api.tsx` | Endpoint nav, "Try it" banner, param tables, tabbed code. Data source TBD — likely the vendored OpenAPI spec (`api/openapi.yaml`) parsed at build time. |
| **Frameworks sidebar + content** | new route `src/routes/frameworks.tsx` | Tree navigator, breadcrumb header, collapsible rule rows. Data source TBD — out of `rfc-api`'s current contract. |
| **MCP hero + download grid** | new route `src/routes/mcp.tsx` | Hero + platform cards. Static content; no API dependency. |

### Already shipped (skip)

- **Primitives:** `<Badge>` (`@donaldgifford/design-system` v0.2.0).
- **Tokens:** full palette + semantic + (new in v0.3.0) `--shadow-*` / `--tracking-*` / `--z-*`.
- **Hooks:** `useTheme` from `@donaldgifford/design-system/theme`.
- **Portal composites:** `<ThemeToggle>`, `<DocCard>`, `<RouteErrorBoundary>`, `<Skeleton>`.
- **Portal Markdown components:** `<DocumentView>`, `<Snippet>`, `<Anchor>`, `<Pre>`, `<MermaidBlock>` (page-bound — not promotion candidates).
- **Routes:** `_index.tsx` (directory), `$type.$id.tsx` (RFC page), `search.tsx` (search). The three new mockup views (API, MCP, Frameworks) need routes too.

## Conclusion

**Answer:** the mockup needs **8 `ds-candidates/` primitives** and **7 portal-only composites** to reach visual parity, plus **3 new routes** (`/api`, `/mcp`, `/frameworks`) for the composites to land in. One open question (`<Pill>` as a `<Badge>` variant vs sibling primitive) should be decided before authoring starts.

## Recommendation

### Build order

Driven by the primitive dependency graph — earlier items unblock later items.

1. **`<Button>` → `<Input>` → `<Kbd>`** — Button is the most-reused primitive across the mockup; Input + Kbd unblock the Topbar (which lands once and benefits every route).
2. **`<Topbar>`** — portal-only composite that lives in `src/root.tsx`'s Layout. Lands once, benefits every view including the three we haven't built yet.
3. **`<Card>` → `<Tabs>` → `<CodeBlock>`** — author in parallel once Button is shipped. These three unblock the bulk of the API and MCP views.
4. **`<Breadcrumb>` + `<Pill>` (after the variant-vs-sibling call)** — used but not blocking; last in the primitive wave.
5. **Portal-only composites** — can start as soon as the first wave of primitives ships. Directory table + RFC sidebar are highest-value (existing routes); API / MCP / Frameworks layouts depend on the data-source decisions called out above.

### How to capture the work

Two options:

- **Formal (recommended)** — open a `DESIGN-0003` (or fold straight into `IMPL-0004`) that pins this inventory + ordering + the open `<Pill>` decision, and gives each primitive a phase with checkbox tasks like IMPL-0001/0002/0003 did. Predictable PR scope, clean phase-by-phase docz trail, future-Claude has explicit context.
- **Loose** — keep this branch (`feat/components`) and ship one PR per primitive, scoping each from commit messages + the existing promotion workflow in CLAUDE.md.

The primitive set is small enough (8 items) that the loose path is viable, but the three new routes + their composites + the open `<Pill>` decision are enough load-bearing context that the formal path is worth the upfront write-up.

**Decision (2026-05-11): formal path.** [IMPL-0004](../impl/0004-build-rfc-portal-components-per-inv-0002-inventory.md) pins this inventory + build order into nine phases with checkbox tasks, success criteria per phase, and a Resolved Questions section that locks in the 13 substantive in-IMPL decisions. The three new routes (`/api`, `/mcp`, `/frameworks`) are deferred to a follow-up IMPL since their data sources are unresolved.

## References

In this repo:

- [DESIGN-0001 — Portal architecture and `ds-candidates` promotion model](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md) — the `ds-candidates/` contract and promotion checklist drive every primitive decision below.
- [IMPL-0001 — Bootstrap the portal scaffold](../impl/0001-bootstrap-portal-scaffold-per-design-0001.md) — Phase 4 references the mockup for Directory + RFC Page layouts; Phase 5 promoted `<Badge>` (the only primitive currently published).
- [IMPL-0003 — Wire up the Markdown rendering pipeline](../impl/0003-wire-up-the-markdown-rendering-pipeline-per-design-0002.md) — `src/portal/markdown/components/` (Anchor / Pre / MermaidBlock) are page-bound and explicitly *not* promotion candidates; this inventory excludes them.
- [INV-0001 — Ship CSS Modules from the design-system tsup build](./0001-ship-css-modules-from-design-system-tsup-build.md) — prefixed-global-class shape that any new primitive's CSS Module will follow on promotion.
- [`CLAUDE.md` §Architecture: portal-first, primitives follow](../../CLAUDE.md) — the load-bearing convention this inventory respects (build inline → promote when stable).

External:

- [`donaldgifford/design-system/rfc-portal-mockup_15.html`](https://github.com/donaldgifford/design-system/blob/main/rfc-portal-mockup_15.html) — the audited mockup (≈4500 lines, six views).
- [`@donaldgifford/design-system` CHANGELOG](https://github.com/donaldgifford/design-system/blob/main/CHANGELOG.md) — published primitives + token versions referenced above.
