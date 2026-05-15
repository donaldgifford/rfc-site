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
- [Alternatives Considered](#alternatives-considered)
  - [A. Stay the course (INV-0003 §Recommendation)](#a-stay-the-course-inv-0003-recommendation)
  - [B. Vendor design-system primitives + tokens into rfc-site](#b-vendor-design-system-primitives--tokens-into-rfc-site)
  - [C. Switch to a third-party design system](#c-switch-to-a-third-party-design-system)
  - [D. Serve the mockup HTML directly, no React](#d-serve-the-mockup-html-directly-no-react)
- [Risks and Mitigations](#risks-and-mitigations)
- [Success Criteria](#success-criteria)
- [References](#references)
<!--toc:end-->

## Summary

One-time hard cut: delete every UI-layer artefact in `rfc-site` that depends on `@donaldgifford/design-system`, keep the data + framework + markdown layers, then rebuild views directly against `donaldgifford/design-system/rfc-portal-mockup_15.html` as the visual spec. The design-system promotion model from [DESIGN-0001](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md) is superseded by this RFC. The published `@donaldgifford/design-system` package stays as-is (frozen at 0.4.0); rfc-site stops consuming it.

Implementation detail is captured in [DESIGN-0003 — Rebuild rfc-site against the mockup](../design/0003-rebuild-rfc-site-against-the-mockup.md), which covers what gets deleted, what stays, the per-view CSS strategy, theme decisions, and the five-phase rollout. This RFC is the *decision*; DESIGN-0003 is the *plan*.

## Problem Statement

The portal was built against a "design-system promotion" model from [DESIGN-0001](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md): components authored in `src/components/ds-candidates/`, promoted to a separate `@donaldgifford/design-system` GitHub Packages dependency once stable, then consumed back. Four IMPLs shipped against this model ([IMPL-0001](../impl/0001-bootstrap-portal-scaffold-per-design-0001.md), [IMPL-0002](../impl/0002-wire-up-apimodemsw-local-dev-mode.md), [IMPL-0003](../impl/0003-wire-up-the-markdown-rendering-pipeline-per-design-0002.md), [IMPL-0004](../impl/0004-build-rfc-portal-components-per-inv-0002-inventory.md)).

[INV-0003](../investigation/0003-inventory-remaining-portal-mockup-work-by-view.md) (PR #9, 2026-05-15) audited the resulting visual state against the mockup and tallied a substantial gap:

- **Directory view:** ~12 tagged visual + structural gaps + a scope correction (the cross-type `listDocs` loader + the `<SearchModal>` type filter pills are dead-on-arrival under the RFC-only scope).
- **RFC page:** ~17 tagged gaps including the 2-col → 3-col layout swap, serif `h1`, missing TOC sidebar, missing references footer, missing admonition wiring.
- **SearchModal:** filter-pill scope wrong (doc-type vs content-kind), result grouping wrong dimension, preview pane visually divergent.
- **Topbar:** brand identity wrong (single text → 3-element composite), missing glass surface, missing avatar chip.
- Three views (`/api`, `/mcp`, `/frameworks`) have **no routes at all**.

INV-0003 §Recommendation sequenced the close-of-gap work as four phases across three repos (rfc-site + design-system + rfc-api), 8 spawned follow-ups in `inv-0003-followups.local.md`, critical path 5 items deep through a new DESIGN-0003 + IMPL in the design-system, then 0.5.0 publish, then rfc-site consumes. **Three repos, two releases, three coordinated branches per visual change.**

The design-system was the right choice when the long-term goal was a multi-portal ecosystem. The short-term goal is "RFC reading experience that matches the mockup", and the design-system tax now slows that goal. **The mockup is the spec.** The data plane is working. The visual layer is blocked, and the design-system has been the bottleneck.

## Proposed Solution

Hard cut, single direction:

1. **Delete** every UI-layer artefact that depends on `@donaldgifford/design-system`. Don't vendor. Don't copy. Git history preserves the work; resurrection is straightforward if priorities change.
2. **Keep** the data + framework + markdown layers — they don't depend on the design-system and are doing their jobs (the API client, markdown pipeline, RR7 loaders, MSW dev mode, test infrastructure).
3. **Rebuild** views fresh against the mockup HTML/CSS as the visual spec. Per-view CSS modules. No promotion model. No external design-system package. No `bun link` loop.
4. **Defer** the design-system entirely. The published `@donaldgifford/design-system` package stays as-is (frozen at 0.4.0); rfc-site stops consuming it. Resurrection is a future RFC's problem.

The detailed implementation plan — what gets deleted, what stays, the per-view CSS strategy, the five-phase rollout — lives in [DESIGN-0003](../design/0003-rebuild-rfc-site-against-the-mockup.md).

## Alternatives Considered

### A. Stay the course (INV-0003 §Recommendation)

Follow F-3 → F-4 → F-5 → F-6 → F-7 → F-8 from `inv-0003-followups.local.md`: author DESIGN-0003 in the design-system repo, ship `@donaldgifford/design-system@0.5.0`, then two portal rebuild IMPLs, then two view-shell IMPLs.

**Rejected:** 5-step critical path across 3 repos. Every visual change pays the promotion tax. Iteration speed is the primary driver against.

### B. Vendor design-system primitives + tokens into rfc-site

Half-measure: copy the design-system's source (Card / Tabs / CodeBlock / Breadcrumb / Badge / Button / Kbd / Input) into rfc-site as the starting point, then iterate.

**Rejected by user:** *"I dont want to copy anything we did, start from scratch and assume the design system doesnt exist."* Also: preserves API-shape decisions (`asChild` via Slot, variant unions) that may not be the right shape for rfc-site-only consumption.

### C. Switch to a third-party design system

Radix Themes, shadcn/ui, MUI, Chakra, etc.

**Rejected by CLAUDE.md Hard rules** ("Never add a blanket component library"). Also: the mockup's visual language is bespoke (serif h1, mono uppercase labels, Tokyo-Night code blocks, glass topbar) and would not survive these libraries' chrome without heavy override.

### D. Serve the mockup HTML directly, no React

Serve `rfc-portal-mockup_15.html` at `/` as the actual rendered site. No React. No build step.

**Rejected:** throws away the API client, the markdown rendering pipeline, the SSR loader pattern — all the data-plane work that's solid. The mockup is a *visual* spec; the portal needs a real rendering layer to merge live `rfc-api` data into the mockup's chrome.

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Visual rework takes longer than the design-system tax would have | High | Medium | Phases sized for incremental shipping; user-visible value lands per-phase rather than after the 5-step critical path of Alternative A |
| Deleted code contained non-obvious load-bearing logic | Medium | Low | Git history preserves everything; surviving API + markdown integration tests catch regressions; Phase 0 stubs ensure the build passes before any rebuild starts |
| Resurrecting the design-system later is hard if its API shape is forgotten | Low | Low | Published 0.4.0 stays; CLAUDE.md can carry a "if you ever want to resurrect" footnote |
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

- [DESIGN-0003 — Rebuild rfc-site against the mockup](../design/0003-rebuild-rfc-site-against-the-mockup.md) — the implementation plan this RFC authorises
- [INV-0003 — Inventory remaining portal-mockup work by view](../investigation/0003-inventory-remaining-portal-mockup-work-by-view.md) — the audit that motivated this pivot
- [DESIGN-0001 — Portal architecture and ds-candidates promotion model](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md) — superseded by this RFC's §Proposed Solution
- [ADR-0001 — Consume rfc-api via its OpenAPI contract](../adr/0001-consume-rfc-api-via-its-published-openapi-contract.md) — still load-bearing; this RFC does not touch the contract
- [ADR-0002 — Adopt portal frontend stack](../adr/0002-adopt-portal-frontend-stack.md) — still load-bearing; this RFC explicitly keeps the stack
- [DESIGN-0002 — Markdown rendering pipeline](../design/0002-markdown-rendering-pipeline.md) — still load-bearing; the markdown pipeline survives the cut
- [IMPL-0001](../impl/0001-bootstrap-portal-scaffold-per-design-0001.md), [IMPL-0002](../impl/0002-wire-up-apimodemsw-local-dev-mode.md), [IMPL-0003](../impl/0003-wire-up-the-markdown-rendering-pipeline-per-design-0002.md), [IMPL-0004](../impl/0004-build-rfc-portal-components-per-inv-0002-inventory.md) — implementation history; preserved in git, not actively maintained going forward
- Mockup: `donaldgifford/design-system/rfc-portal-mockup_15.html` — the visual contract
