---
id: RFC-0001
title: "Defer the design-system promotion model and iterate rfc-site against the mockup"
status: Draft
author: Donald Gifford
created: 2026-05-15
---
<!-- markdownlint-disable-file MD025 MD041 -->

# RFC 0001: Defer the design-system promotion model and iterate rfc-site against the mockup

**Status:** Draft
**Author:** Donald Gifford
**Date:** 2026-05-15

<!--toc:start-->
- [Summary](#summary)
- [Problem Statement](#problem-statement)
- [Proposed Solution](#proposed-solution)
- [Design](#design)
  - [Stack — unchanged](#stack--unchanged)
  - [OpenAPI client — unchanged](#openapi-client--unchanged)
  - [What gets deleted (Phase 0 "the wipe")](#what-gets-deleted-phase-0-the-wipe)
  - [What stays](#what-stays)
  - [Tokens & CSS strategy](#tokens--css-strategy)
  - [Open questions](#open-questions)
- [Alternatives Considered](#alternatives-considered)
  - [A. Stay the course (INV-0003 §Recommendation)](#a-stay-the-course-inv-0003-recommendation)
  - [B. Vendor design-system primitives + tokens into rfc-site](#b-vendor-design-system-primitives--tokens-into-rfc-site)
  - [C. Switch to a third-party design system](#c-switch-to-a-third-party-design-system)
  - [D. Serve the mockup HTML directly, no React](#d-serve-the-mockup-html-directly-no-react)
- [Implementation Phases](#implementation-phases)
  - [Phase 0 — the wipe (one PR)](#phase-0--the-wipe-one-pr)
  - [Phase 1 — vendor mockup tokens + rebuild Topbar + Directory](#phase-1--vendor-mockup-tokens--rebuild-topbar--directory)
  - [Phase 2 — rebuild RFC page](#phase-2--rebuild-rfc-page)
  - [Phase 3 — rebuild SearchModal + /search](#phase-3--rebuild-searchmodal--search)
  - [Phase 4 — new view shells (sequenced)](#phase-4--new-view-shells-sequenced)
  - [Out-of-scope](#out-of-scope)
- [Risks and Mitigations](#risks-and-mitigations)
- [Success Criteria](#success-criteria)
- [References](#references)
<!--toc:end-->

## Summary

One-time hard cut: delete every UI-layer artefact in `rfc-site` that depends on `@donaldgifford/design-system`, keep the data + framework + markdown layers, then rebuild the views directly against `donaldgifford/design-system/rfc-portal-mockup_15.html` as the visual spec. The design-system promotion model from [DESIGN-0001](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md) is superseded by this RFC. The published `@donaldgifford/design-system` package stays as-is (frozen at 0.4.0); rfc-site stops consuming it. Git history preserves the deleted work; resurrection is a future RFC's problem.

## Problem Statement

The portal was built against a "design-system promotion" model from [DESIGN-0001](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md): components authored in `src/components/ds-candidates/`, promoted to a separate `@donaldgifford/design-system` GitHub Packages dependency once stable, then consumed back. Four IMPLs shipped against this model ([IMPL-0001](../impl/0001-bootstrap-portal-scaffold-per-design-0001.md), [IMPL-0002](../impl/0002-wire-up-apimodemsw-local-dev-mode.md), [IMPL-0003](../impl/0003-wire-up-the-markdown-rendering-pipeline-per-design-0002.md), [IMPL-0004](../impl/0004-build-rfc-portal-components-per-inv-0002-inventory.md)).

[INV-0003](../investigation/0003-inventory-remaining-portal-mockup-work-by-view.md) (PR #9, 2026-05-15) audited the resulting visual state against the mockup and tallied a substantial gap:

- **Directory view:** ~12 tagged visual + structural gaps + a scope correction (`<SearchModal>` filter pills + cross-type `listDocs` loader are dead-on-arrival under the RFC-only scope).
- **RFC page:** ~17 tagged gaps including the 2-col → 3-col layout swap, serif `h1`, missing TOC sidebar, missing references footer, missing admonition wiring.
- **SearchModal:** filter-pill scope is wrong (doc-type vs content-kind), result grouping is wrong dimension, preview pane visually divergent.
- **Topbar:** brand identity wrong (single text → 3-element composite), missing glass surface, missing avatar chip.
- Three views (`/api`, `/mcp`, `/frameworks`) have **no routes at all**.

INV-0003 §Recommendation sequenced the close-of-gap work as four phases across three repos (rfc-site + design-system + rfc-api), 8 spawned follow-ups in `inv-0003-followups.local.md`, critical path 5 items deep through a new DESIGN-0003 + IMPL in the design-system, then 0.5.0 publish, then rfc-site consumes. **Three repos, two releases, three coordinated branches per visual change.**

The design-system was the right choice when the long-term goal was a multi-portal ecosystem. The short-term goal is "RFC reading experience that matches the mockup", and the design-system tax now slows that goal. **The mockup is the spec.** The data plane (rfc-api + orval client + markdown pipeline + RR7 loaders) is working. The visual layer is what's blocked, and the design-system has been the bottleneck.

## Proposed Solution

Hard cut, single direction:

1. **Delete** every UI-layer artefact that depends on `@donaldgifford/design-system`. Don't vendor. Don't copy. Git history preserves the work; resurrection is straightforward if priorities change.
2. **Keep** the data + framework + markdown layers — they don't depend on the design-system and are doing their jobs (the API client, markdown pipeline, RR7 loaders, MSW dev mode, test infrastructure).
3. **Rebuild** views fresh against the mockup HTML/CSS as the visual spec. Per-view CSS modules. No promotion model. No external design-system package. No `bun link` loop.
4. **Defer** the design-system entirely. The published `@donaldgifford/design-system` package stays as-is (frozen at 0.4.0); rfc-site stops consuming it. Resurrection is a future RFC's problem.

## Design

### Stack — unchanged

Per [ADR-0002](../adr/0002-adopt-portal-frontend-stack.md), the stack stays:

- React 19 + React Router v7 (framework mode) + Vite, served by `react-router-serve`.
- TanStack Query 5 for client-side caching of orval-generated hooks (where used).
- Bun for runtime + package management.
- TypeScript ^5.7 strict; vitest + jsdom + Testing Library for tests.

No framework change. No new dependencies. The pivot is about styling distribution, not the stack.

### OpenAPI client — unchanged

Per [ADR-0001](../adr/0001-consume-rfc-api-via-its-published-openapi-contract.md), the client is generated from the vendored `api/openapi.yaml` via orval (`tags-split` mode at `src/portal/api/__generated__/`), with `scripts/gen-api-check.sh` as the CI drift signal. Stays as-is. **No reason to switch generators or to abandon the vendored-spec convention.**

### What gets deleted (Phase 0 "the wipe")

**Component layer:**

- `src/components/ds-candidates/` — entire directory (Card / Tabs / CodeBlock / Breadcrumb).
- `src/components/portal/` — entire directory (Topbar / DirectoryTable / DirectoryToolbar / DocSidebar / RFCPreviewCard / SearchModal / RouteErrorBoundary / Skeleton / ThemeToggle / DocCard).

Even portal components that don't directly import the design-system are deleted: they're styled against design-system tokens, the styles would be load-bearing-wrong post-cut, and the user wants a clean reset.

**Dependency surface:**

- `@donaldgifford/design-system` from `package.json`.
- `bunfig.toml` (entire file — GitHub Packages auth was its only role).
- The `NPM_TOKEN` requirement for `bun install` falls out (CI `secrets.GITHUB_TOKEN` reference can stay in workflows but won't be exercised).

**Style / theme imports:**

- `import "@donaldgifford/design-system/tokens.css"` in `src/root.tsx`.
- `import "@donaldgifford/design-system/styles.css"` in `src/root.tsx`.
- `useTheme` from `@donaldgifford/design-system/theme`.

The mockup is dark-only. Drop the light theme entirely; hard-code `<html data-theme="dark">` on the root layout. The CLAUDE.md Hard rule against rolling our own theme switcher was design-system policy; with the design-system gone, that rule's context goes too. If a light-theme toggle is wanted later it's a 30-line component against the local tokens.

**Tests:**

- All component-level test files (those that import the deleted components). Routes' loader tests stay; route-render tests get rewritten alongside the new view JSX.

**Tooling:**

- `just ds-build` / `just ds-link` / `just ds-unlink` recipes from `justfile`.
- CLAUDE.md sections describing the design-system promotion model get rewritten for the new model.
- `inv-0003-followups.local.md` items F-3 / F-4 / F-5 / F-6 are scrapped or rewritten; the tracker stays useful only for the rfc-api RFC (F-2) and the deferred /frameworks question (F-9).

**Routes — stub, don't delete:**

- `src/routes/_index.tsx`, `src/routes/$type.$id.tsx`, `src/routes/search.tsx` — keep the loaders + error boundaries + meta + types + HydrateFallback exports (those are still correct). Stub the JSX bodies to minimal "view under construction" markup so the build passes and the loader logic still runs.

### What stays

- `src/portal/api/` — config / fetcher / queryClient / errors / pagination / docId helpers / MSW dev mode + handlers / orval-generated client config. Verify nothing here imports design-system; expected clean.
- `src/portal/markdown/` — DocumentView / Snippet / pipeline / plugins / components (Anchor / Pre / MermaidBlock). One import to check: `<Pre>` may reference `<CodeBlock>` (ds-candidate) for non-Markdown contexts — if so, redirect or stub during Phase 0.
- `src/routes/` — loaders + error boundary wiring + types + meta. JSX bodies stubbed in Phase 0; rebuilt per-view in Phases 1-4.
- `src/root.tsx` — Layout (sans the design-system style imports) + App (QueryClientProvider) + HydrateFallback.
- `tests/setup.ts`, `tests/utils/*`, MSW server + fixtures, API tests + markdown tests.
- `api/openapi.yaml`, `orval.config.ts`, `scripts/gen-api-check.sh`.
- All RR7 / Vite / Bun / TypeScript / vitest config.
- `mise.toml`, `justfile` (minus the `ds-*` recipes), `.docz.yaml`, the docz docs directory tree.

### Tokens & CSS strategy

The mockup is the visual spec. Phase 0 (or Phase 1) extracts the mockup's `:root { --... }` token block from `rfc-portal-mockup_15.html` into a new `src/styles/tokens.css`. The mockup is **external** (a separate artefact in `donaldgifford/design-system`), not prior rfc-site work, so consuming its tokens is consuming the spec, not "copying what we did".

Per-view CSS gets extracted into per-component CSS modules as components are built in Phases 1-N. The mockup's CSS organisation already maps cleanly:

- `.topbar`, `.brand`, `.kbd` → `src/components/Topbar/`
- `.directory`, `.directory-hero`, `.live-filter`, `.table-toolbar`, `.rfc-row`, `.status-badge`, `.label-tag`, `.authors-cell`, `.updated-cell` → `src/components/Directory/`
- `.rfc-view`, `.rfc-sidebar-left`, `.rfc-sidebar-right`, `.rfc-content`, `.rfc-prose`, `.rfc-footer`, `.toc-list`, `.sidebar-section`, `.meta-row`, `.number-line`, `.rfc-link`, `.preview-card`, `.admonition`, `.ascii-diagram`, `.codeblock`, `.mermaid-diagram` → `src/components/DocPage/` + `src/portal/markdown/`
- `.search-overlay`, `.search-modal`, `.search-input-row`, `.search-filters-row`, `.search-results`, `.result-item`, `.result-preview`, `.search-footer` → `src/components/SearchModal/`
- `.api-layout`, `.api-sidebar`, `.api-endpoint-header`, `.method`, `.try-it`, `.api-section`, `.param-row`, `.response-row`, `.example-tabs`, `.example-code` → `src/components/ApiPage/`
- `.mcp-layout`, `.mcp-hero`, `.mcp-cards`, `.mcp-card`, `.mcp-section`, `.download-grid`, `.download-item`, `.step` → `src/components/McpPage/`
- `.fw-layout`, `.fw-sidebar`, `.fw-tree`, `.fw-content`, `.fw-detail-header`, `.fw-section-block`, `.fw-rule-row`, `.sev-pill` → `src/components/FrameworksPage/` (deferred per Phase 4)

No `src/components/ds-candidates/`. No `src/components/portal/`. Just `src/components/<View>/` with co-located CSS modules + tests.

### Open questions

- **MSW fixture corpus narrowing.** INV-0003 raised this; not blocking Phase 0. The current 8-fixture set across 6 types still works for loader + API client tests. RFC-only narrowing can land in any rebuild PR.
- **`useTheme` replacement.** Mockup is dark-only. Hard-coding `<html data-theme="dark">` is the simplest move; an optional toggle can come later if needed.
- **Yank the published `@donaldgifford/design-system` package?** Recommend no — it's not actively consumed by anything else, leaving it published preserves the option to resume. Frozen at 0.4.0 (0.4.0-pre is unreleased; ignore).
- **Co-locate or root-level `src/components/`?** The mockup is one view per directory, no shared primitives. Recommend flat `src/components/<View>/` (no `portal/` or `ds-candidates/` subfolders) — simpler, matches the mockup's organisation.

## Alternatives Considered

### A. Stay the course (INV-0003 §Recommendation)

Follow F-3 → F-4 → F-5 → F-6 → F-7 → F-8 from `inv-0003-followups.local.md`: author DESIGN-0003 in the design-system repo, ship `@donaldgifford/design-system@0.5.0`, then 2 portal rebuild IMPLs, then 2 view-shell IMPLs.

**Rejected:** 5-step critical path across 3 repos. Every visual change pays the promotion tax. Iteration speed is the primary driver against.

### B. Vendor design-system primitives + tokens into rfc-site

Half-measure: copy the design-system's source (Card / Tabs / CodeBlock / Breadcrumb / Badge / Button / Kbd / Input) into rfc-site as the starting point, then iterate.

**Rejected by user:** *"I dont want to copy anything we did, start from scratch and assume the design system doesnt exist."* Also: preserves API-shape decisions (`asChild` via Slot, variant unions) that may not be the right shape for rfc-site-only consumption.

### C. Switch to a third-party design system

Radix Themes, shadcn/ui, MUI, Chakra, etc.

**Rejected by CLAUDE.md Hard rules** ("Never add a blanket component library"). Also: the mockup's visual language is bespoke (serif h1, mono uppercase labels, Tokyo-Night code blocks, glass topbar) and would not survive these libraries' chrome without heavy override.

### D. Serve the mockup HTML directly, no React

Serve `rfc-portal-mockup_15.html` at `/` as the actual rendered site. No React. No build step.

**Rejected:** throws away the API client, the markdown rendering pipeline, the SSR loader pattern — all the data plane work that's solid. The mockup is a *visual* spec; the portal needs a real rendering layer to merge live `rfc-api` data into the mockup's chrome.

## Implementation Phases

### Phase 0 — the wipe (one PR)

- Delete `src/components/ds-candidates/`, `src/components/portal/` (entire directories).
- Delete all component-level test files that import deleted components.
- Remove `@donaldgifford/design-system` from `package.json`. Delete `bunfig.toml`.
- Delete `just ds-build` / `just ds-link` / `just ds-unlink` recipes from `justfile`.
- Strip design-system imports from `src/root.tsx`. Hard-code `<html data-theme="dark">`. Create empty `src/styles/tokens.css` placeholder + wire it as the global stylesheet import.
- Stub `src/routes/_index.tsx`, `$type.$id.tsx`, `search.tsx` JSX bodies. Keep loaders + error boundaries + types + meta + HydrateFallback intact.
- Rewrite CLAUDE.md to reflect the new state (no promotion model, mockup-direct, flat `src/components/`).
- Confirm `bun run build` + `bun test` pass with the stubs (test count drops substantially; API + markdown tests stay).
- One PR. Land before any rebuild starts.

### Phase 1 — vendor mockup tokens + rebuild Topbar + Directory

- Extract mockup's `:root { --... }` block into `src/styles/tokens.css`. Wire into `src/root.tsx`.
- Extract Topbar CSS (mockup §142-257) into `src/components/Topbar/Topbar.module.css`. Build component fresh: 3-element brand composite, glass surface, fixed 56px height, grid `260px 1fr auto`, mono-12 nav, avatar chip slot.
- Extract Directory CSS (mockup §268-639) into per-component modules. Build `<DirectoryHero>` (eyebrow `/ docs / rfcs` + serif "Request for Comments"), `<LiveFilter>`, `<DirectoryToolbar>` (icon-only filter trigger + cascading filter menu + segmented sort toggle), `<DirectoryTable>` (5-col grid: 80px id + 1fr title + 100px status + 220px authors + 100px updated), `<RfcRow>`.
- Wire to existing `_index.tsx` loader; pin `?filter=type:rfc` per INV-0003 Directory Path B.
- New tests against new components.
- One PR. Smallest scope; exercises the new pattern.

### Phase 2 — rebuild RFC page

- Extract RFC-page CSS (mockup §641-1248) into per-component modules.
- Build `<DocPage>` (3-col layout: 240px metadata-left + minmax(0,1fr) prose + 240px TOC-right, max-width 1400px, gap 56px).
- Build `<DocSidebar>` (metadata, left): chrome-less `.sidebar-section` blocks for Metadata + Labels.
- Build `<TableOfContents>` (right): sticky `top: 88px`, scroll-spy `.current`, `.nested` h3-under-h2 indent.
- Build `<NumberLine>` eyebrow + serif `h1` (42px / 400) + `<HeaderMeta>` (mono 12px tertiary, `·` dividers).
- Build `<ReferencesFooter>` consuming `Document.links[]`.
- Build `<Callout>` admonition + companion `remark-github-alerts` plugin (`src/portal/markdown/plugins/`) lifting GFM `> [!NOTE]` syntax into `<Callout>` markup.
- Apply prose visual deltas: h2 serif 26px / 500 + mono `#` hash hover prefix, `p` color `--fg-secondary`, language-badge chip on `pre[data-lang]`, blockquote raised-bg + serif quote glyph, table th mono-uppercase, mermaid caption sub-element.
- Wire to existing `$type.$id.tsx` loader; derive `revision` from `source.commit` (first 7 chars); reformat Discussion as `PR: #412` using `discussion.url`'s trailing path segment.
- New tests.
- One PR.

### Phase 3 — rebuild SearchModal + /search

- Extract Search CSS (mockup §1250-1490) into per-component modules.
- Build `<SearchModal>` fresh: 780px width, top-anchored (`padding-top: 96px`), no header chrome (the input row IS the header), content-scope filter pills (`all / titles / body / authors / labels` — not doc-type), grouped results by content kind (`RFCs — N matches`, `Labels — N matches`, etc.), 320px / 1fr two-pane scrolling, serif-titled preview pane, mockup keyboard-nav hints (`↑↓ ↵ tab`), `meilisearch ● 12ms` latency footer (computed client-side).
- Rebuild `/search` as the no-JS fallback (degraded surface — no preview pane, no keyboard nav).
- Wire to `searchDocs`; the content-scope pills + grouping depend on `rfc-api` extensions (F-2 in the followups tracker); ship with type-pinned `?type=rfc` as the v1 narrowing.
- New tests.
- One PR.

### Phase 4 — new view shells (sequenced)

- **`/mcp` first.** Content is portal-local (server name / version / config snippets). No upstream dependency. Build hero + 2-col `<McpCards>` + four numbered `<McpSection>` steps + `<DownloadGrid>` + `<ExampleTabs>` (build fresh — no inheritance from the deferred ds-candidate `<Tabs>`). One PR.
- **`/api` second.** Parse vendored `api/openapi.yaml` client-side and emit portal-native renderer matching the mockup chrome 1:1 (avoid Redoc — CSS-override pain not worth it). 3-col layout, sidebar grouped by OpenAPI `tag`, HTTP method chips (`.method.get/.post/.put/.patch/.delete`), endpoint header + `.path-line` + `.try-it` band (defer live-execution), param + response tables, example tabs. Hew to `api/openapi.yaml` paths as source of truth — NOT the mockup paths (which predate the rfc-api type-split). One PR.
- **`/frameworks` deferred.** Data plane question is unresolved (no `framework` source in `rfc-api`; needs an upstream RFC or sibling service). Don't ship until that decision lands.

### Out-of-scope

- Any new design-system primitives. The `@donaldgifford/design-system` package is frozen at 0.4.0 and not consumed.
- Promoting anything out of rfc-site. The promotion model is what this RFC defers.
- Re-litigating ADR-0001 (OpenAPI contract) or ADR-0002 (frontend stack) — both still load-bearing and unchanged.
- The `inv-0003-followups.local.md` tracker entries F-3 / F-4 / F-5 / F-6 — scrapped. F-1 (scope-narrow cleanup) is subsumed by Phase 0 + Phase 1 of this RFC. F-2 (rfc-api RFC) and F-9 (/frameworks data plane) survive as still-relevant upstream items.

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Visual rework takes longer than the design-system tax would have | High | Medium | Phases 1-4 are scoped to one view each; can ship incrementally, get user-visible value faster than the 5-step critical path of Alternative A |
| Deleted code contained non-obvious load-bearing logic | Medium | Low | Git history preserves everything; the surviving API + markdown integration tests catch regressions; Phase 0 stubs ensure the build passes |
| Resurrecting the design-system later is hard if its API shape is forgotten | Low | Low | Published 0.4.0 stays; CLAUDE.md can carry a "if you ever want to resurrect" footnote; not a Phase 0 deliverable |
| User decides mid-rebuild they want the design-system back | Medium | Low | `git revert` Phase 0; the wipe is one PR's worth, not weeks of resurrection |
| Mockup itself is wrong or out of date | High | Low | Mockup is the spec by user choice; if the spec is wrong, fix the spec, not the implementation. Mockup lives in a sibling repo and can be iterated separately |
| Visual chrome ends up too coupled to rfc-site's structure to extract a real design-system later | Medium | Medium | Acceptable trade. The premise of this RFC is that the design-system is deferred *indefinitely*. If it returns, extraction is a separate project, not a constraint on this rebuild |

## Success Criteria

- All `src/components/ds-candidates/` + `src/components/portal/` artefacts are removed from `rfc-site`. `@donaldgifford/design-system` is removed from `package.json`. `bunfig.toml` is deleted. `bun run build` + `bun test` pass with the surviving suite.
- Each rebuilt view (Directory / RFC page / Search modal / `/mcp` / `/api`) renders against the mockup with **zero** `@donaldgifford/design-system` imports. Manual side-by-side smoke confirms visual parity.
- Iteration time for a typical visual change is **one PR in one repo** (vs. INV-0003's 3-repo critical path).
- CLAUDE.md reflects the new model. DESIGN-0001 + INV-0003 are annotated as superseded / deferred. The followups tracker is rewritten or scrapped.
- The published `@donaldgifford/design-system` package stays at 0.4.0 in GitHub Packages, frozen but available.

## References

- [INV-0003 — Inventory remaining portal-mockup work by view](../investigation/0003-inventory-remaining-portal-mockup-work-by-view.md) — the audit that motivated this pivot. Tagged §Findings drive the Phase 1-4 scope.
- [DESIGN-0001 — Portal architecture and ds-candidates promotion model](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md) — superseded by this RFC's §Proposed Solution.
- [ADR-0001 — Consume rfc-api via its OpenAPI contract](../adr/0001-consume-rfc-api-via-its-published-openapi-contract.md) — still load-bearing; this RFC does not touch the contract.
- [ADR-0002 — Adopt portal frontend stack](../adr/0002-adopt-portal-frontend-stack.md) — still load-bearing; this RFC explicitly keeps the stack.
- [DESIGN-0002 — Markdown rendering pipeline](../design/0002-markdown-rendering-pipeline.md) — still load-bearing; the markdown pipeline survives Phase 0.
- [IMPL-0001](../impl/0001-bootstrap-portal-scaffold-per-design-0001.md), [IMPL-0002](../impl/0002-wire-up-apimodemsw-local-dev-mode.md), [IMPL-0003](../impl/0003-wire-up-the-markdown-rendering-pipeline-per-design-0002.md), [IMPL-0004](../impl/0004-build-rfc-portal-components-per-inv-0002-inventory.md) — implementation history; preserved in git, not actively maintained going forward.
- Mockup: `donaldgifford/design-system/rfc-portal-mockup_15.html` — the visual contract.
