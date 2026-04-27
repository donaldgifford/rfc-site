---
id: DESIGN-0001
title: "Portal architecture and ds-candidates promotion model"
status: Draft
author: Donald Gifford
created: 2026-04-26
---
<!-- markdownlint-disable-file MD025 MD041 -->

# DESIGN 0001: Portal architecture and ds-candidates promotion model

**Status:** Draft
**Author:** Donald Gifford
**Date:** 2026-04-26

<!--toc:start-->
- [Overview](#overview)
- [Goals and Non-Goals](#goals-and-non-goals)
  - [Goals](#goals)
  - [Non-Goals](#non-goals)
- [Background](#background)
- [Detailed Design](#detailed-design)
  - [Repo layout](#repo-layout)
  - [The ds-candidates/ contract](#the-ds-candidates-contract)
  - [Component authoring rules](#component-authoring-rules)
  - [Token and theme integration](#token-and-theme-integration)
  - [Where the API client lives](#where-the-api-client-lives)
  - [Anti-patterns (hard refusals)](#anti-patterns-hard-refusals)
- [API / Interface Changes](#api--interface-changes)
- [Data Model](#data-model)
- [Testing Strategy](#testing-strategy)
- [Migration / Rollout Plan](#migration--rollout-plan)
- [Open Questions](#open-questions)
  - [Resolved during initial review](#resolved-during-initial-review)
  - [Still open](#still-open)
- [References](#references)
<!--toc:end-->

## Overview

The `rfc-site` portal is the SSR web frontend for [`rfc-api`](https://github.com/donaldgifford/rfc-api) and the first real consumer of [`@donaldgifford/design-system`](https://github.com/donaldgifford/design-system). This design specifies how the portal's component code is organized so that visual primitives can be built **inline first**, validated by real use, and then **promoted** into the design system as a mechanical copy — not a rewrite. The load-bearing convention is the `src/components/ds-candidates/` folder; everything else in this design exists to make that promotion path safe and cheap.

API integration with `rfc-api` is the *other* half of what the portal does, and is intentionally not specified here — see [ADR-0001](../adr/0001-consume-rfc-api-via-its-published-openapi-contract.md) for the OpenAPI-driven client decision. This design covers how the *view layer* is structured.

## Goals and Non-Goals

### Goals

- Let the portal render RFC pages quickly while still consuming the design system's tokens and theme contract from day one.
- Make promotion of a candidate component into the design system a `cp -r`, by enforcing the destination shape (folder layout, API conventions, dependency rules) upfront.
- Prevent the portal from accidentally re-creating the inconsistency that RFC-0002 was created to solve: parallel token systems, parallel theme switchers, two `Button`s, or a creeping blanket component library (Radix Themes, shadcn, Material).
- Surface real component requirements through actual portal use, rather than designing the design-system primitive APIs by anticipation.

### Non-Goals

- Portal features — RFC rendering rules, search, auth, data fetching — these belong in their own RFCs/designs.
- The design system's own roadmap (lives in IMPL-0001 done, and the future IMPL-0002 for primitives).
- Choosing a router or Markdown rendering library. The portal needs both, but the choice is portal-local and orthogonal to this design.
- Promoting any specific component. This design defines the *shape* of promotion; individual promotions will be tracked separately.

## Background

Per [**RFC-0002 §Rollout step 2**](https://github.com/donaldgifford/design-system/blob/main/docs/rfc/0002-internal-design-system.md): *"Iterate on the primitive APIs with the portal as the live consumer. Breaking changes are cheap while there is only one consumer."*

The failure mode this design avoids: shipping `Button`/`Heading`/`Card` APIs in `@donaldgifford/design-system@0.2.0` by anticipation, then discovering weeks into portal work that half the props are wrong, slot composition doesn't fit, and the variants don't match real RFC-page needs. We want primitives shaped by **actual use**, not speculation.

The binding constraints come from the design-system repo and are non-negotiable here:

- [**ADR-0002**](https://github.com/donaldgifford/design-system/blob/main/docs/adr/0002-react-tokens-as-primitive-foundation-defer-headless-libraries.md) — defer headless libraries; React + tokens are the foundation. The single sanctioned Radix dependency in any consumer is `@radix-ui/react-slot`, for `asChild` composition.
- [**ADR-0004**](https://github.com/donaldgifford/design-system/blob/main/docs/adr/0004-ship-dark-and-light-themes-in-v1-with-a-token-driven-switcher.md) — dark/light themes ship in v1, switched via `data-theme` and a `useTheme` hook exported from the package.
- [**DESIGN-0001 (design-system repo)**](https://github.com/donaldgifford/design-system/blob/main/docs/design/0001-design-token-architecture.md) — two-layer token model, naming conventions; consumed via a single `tokens.css` import at the app entry.
- [**DESIGN-0002 (design-system repo)**](https://github.com/donaldgifford/design-system/blob/main/docs/design/0002-primitive-component-api-conventions.md) — primitive API conventions: `forwardRef`, native DOM prop pass-through, `className` merges, string-union variants, `asChild` via `@radix-ui/react-slot`.

The original rfc-site build guide ([archived at `docs/archive/0001-rfc-site-build-guide.md`](../archive/0001-rfc-site-build-guide.md)) was the source material this design was lifted from. It is kept for provenance only — this design plus [ADR-0001](../adr/0001-consume-rfc-api-via-its-published-openapi-contract.md) supersede it. When the archived guide and this design disagree, this design wins; the archived guide should not be used as a current reference.

The reference implementation we are tracking is **Oxide's [`rfd-site`](https://github.com/oxidecomputer/rfd-site)** — a React 19 + React Router v7 + Vite + TanStack Query app that consumes `@oxide/design-system` and a generated OpenAPI client (`@oxide/rfd.ts`). Where this design and `rfd-site` agree, we copy. Where they diverge (e.g. `rfd-site` uses Tailwind alongside their design system; we don't), this design wins.

## Detailed Design

### Repo layout

```
src/
  components/
    ds-candidates/         ← extract-ready primitives
      Button/
        Button.tsx
        Button.module.css
        index.ts
      Heading/
        ...
    portal/                ← portal-only components (page chrome, etc.)
  pages/                   ← route-bound page components
  routes/                  ← router config
  styles/                  ← portal-local CSS only (NEVER tokens)
  main.tsx                 ← entry: imports tokens.css + mounts app
bunfig.toml                ← GitHub Packages auth (or .npmrc — not both)
package.json
```

The split between `ds-candidates/` and `portal/` is the load-bearing line. A component on the wrong side of it either prevents promotion (portal coupling leaks into a candidate) or hides a reusable primitive inside portal-local code.

### The `ds-candidates/` contract

A component lives in `ds-candidates/` only if it could plausibly be promoted into the design system. Every candidate must:

- Be one folder per component, named after the component.
- Export the component from `Component.tsx` as a named export with `forwardRef`.
- Co-locate styles in `Component.module.css`, referencing only design-system CSS variables (`var(--color-*)`, `var(--space-*)`, etc.).
- Re-export through `index.ts`.
- **Not import** from `portal/`, `pages/`, `routes/`, app state, routing, data fetching, or Markdown rendering. If a candidate reaches into portal code, it isn't a candidate yet — move it to `portal/` until the dependency is cut.

A component is **ready to promote** when:

- It is used in **2+ places** in the portal (use is the validator — once is not a pattern).
- The API has not churned for ~2 weeks of active development.
- A new variant/size/state would be pushed back on without a concrete reason.
- It depends on no portal-only concerns.

### Component authoring rules

These mirror DESIGN-0002 in the design-system repo so promoted components do not need a rewrite:

- **`forwardRef`** on every component that wraps a DOM element.
- **Native DOM prop pass-through** — spread `...rest` to the underlying element so consumers can attach `aria-*`, `data-*`, and event handlers without enumeration.
- **`className` merges, never replaces.** Use `clsx` or a `cn()` helper; consumer `className` layers on top.
- **`variant` / `size` / `status` as string unions.** Never `isPrimary`-style booleans. (Bad: `<Button isPrimary isLarge>`. Good: `<Button variant="solid" size="md">`.)
- **CSS Modules co-located.** No CSS-in-JS runtime, no Tailwind, no `style={}` for non-dynamic values.
- **No theme branching inside components.** Tokens already remap when `data-theme` flips. If the temptation appears, the missing piece is a semantic token in the design system.
- **`asChild` for composition** via `@radix-ui/react-slot` — the only sanctioned Radix dependency in this repo.

### Token and theme integration

- `tokens.css` is imported **once**, at the app root (`src/main.tsx`), via `import "@donaldgifford/design-system/tokens.css"`. After that, every CSS variable is globally available.
- The portal **never** redefines design-system CSS variables and **never** copies `tokens.css` content into portal CSS. If a token is wrong, fix it in the design system. If a needed token does not exist, add it to the design system.
- Theme switching uses `useTheme` from `@donaldgifford/design-system/theme`. The hook owns `data-theme` mutation, `localStorage` persistence (key `design-system:theme`), `prefers-color-scheme` first-load fallback, and SSR safety. The portal does not reimplement any of that.
- The dark palette is the default at `:root`. We **set `<html data-theme="dark">` explicitly** in `index.html` rather than relying on the implicit default — three characters of zero-cost clarity, plus the html element's `data-theme` value is then present from first paint and matches what `useTheme` writes on subsequent toggles.

### Where the API client lives

API integration is in scope for the portal but out of scope for `ds-candidates/`. The full decision lives in [ADR-0001](../adr/0001-consume-rfc-api-via-its-published-openapi-contract.md); the cookbook with sample payloads, error-sentinel mapping, and the Markdown contract is in [`docs/integration/rfc-api-reference.md`](../integration/rfc-api-reference.md). For the purposes of *this* design, the rules are:

- The OpenAPI-generated client and TanStack Query hooks live under `src/portal/api/` (or similar — under `portal/`, never under `ds-candidates/`).
- A `ds-candidate` **never** imports the API client, TanStack Query, route loaders, or anything that would tie it to `rfc-api`'s shape. If a candidate needs data, the consuming `portal/` page passes it as props.
- This is what makes promotion `cp -r`: the destination (`@donaldgifford/design-system`) has no concept of `rfc-api` and never will.
- **Cross-document links inside Markdown are resolved from the doc payload's `links[]` array, not by parsing relative paths in the Markdown body.** `rfc-api` does that resolution for us; doing it again on the client is duplicate work that drifts. This rule is portal-architectural — it constrains what the Markdown renderer accepts as input — and is documented in detail in the integration reference's Markdown contract section.

### Anti-patterns (hard refusals)

These are the failure modes this design exists to prevent — call them out and refuse:

- Forking the tokens (any duplicate `tokens.css`, any portal CSS that defines `--color-*` / `--space-*` / `--font-size-*`).
- Adding a blanket component library — Radix Themes, shadcn/ui, Material UI, Chakra, etc. The single sanctioned exception is `@radix-ui/react-slot`.
- Rolling a custom theme switcher in the portal.
- Theme-branching inside a component (`if (theme === "light") …` is a bug).
- Promoting prematurely — a component used once, that has churned three times in a week, is not ready.
- Skipping a changeset when editing the design system during a linked dev session — the change will silently not ship.

## API / Interface Changes

This design introduces no portal-public API. The contracts it relies on are all *consumer-side* against `@donaldgifford/design-system`:

- `import "@donaldgifford/design-system/tokens.css"` — global stylesheet, exactly once.
- `import { useTheme } from "@donaldgifford/design-system/theme"` — `{ theme, toggleTheme, setTheme }`.
- (Future) `import { Button, Heading, … } from "@donaldgifford/design-system"` — added per-promotion.

GitHub Packages authentication is required to install the design system. The portal commits **either** `bunfig.toml` **or** `.npmrc` (not both); `NPM_TOKEN` must have `read:packages`. In CI under the same `donaldgifford` GitHub owner, `NPM_TOKEN: ${{ secrets.GITHUB_TOKEN }}` suffices.

## Data Model

No persistent data is introduced by this design. The only client-side state worth noting is the theme key `design-system:theme` in `localStorage`, which is owned by `useTheme` in the design-system package — the portal does not read or write it directly.

## Testing Strategy

- **Stack:** vitest + jsdom + `@testing-library/react`, mirroring the design-system repo so promoted tests run as-is on the destination.
- **Candidate components:** unit tests are colocated next to the component file (`ds-candidates/Button/Button.test.tsx`). On promotion the test file is `git mv`'d into `design-system/tests/primitives/<Component>.test.tsx` to match the destination convention — see [Open Questions](#open-questions) for the full promotion mechanics.
- **Portal pages and routes:** tested in the portal only; not promoted.
- **Cross-cutting:** before promotion, run the portal's full suite plus a manual check that pages render identically against the just-installed package version (i.e. unlinked from any `bun link`).

## Migration / Rollout Plan

This is the rollout for the portal itself, not for promotions. Per phase:

1. **Tooling reconciliation.** `mise.toml` currently pins `node = 22` / `pnpm = 10.33.2` from the design-system template. Update to add `bun` and drop `pnpm`. Initialize React 19 + TypeScript strict + ESLint v9 flat config + Prettier mirroring the design-system repo. Set up vitest + jsdom + RTL.
2. **Package install.** Add GitHub Packages auth (`bunfig.toml` *or* `.npmrc`). `bun add @donaldgifford/design-system@0.1.0` (no caret on first install — first upgrade is deliberate).
3. **Wire token + theme.** Import `tokens.css` once in `src/main.tsx`. Use `useTheme` from `@donaldgifford/design-system/theme` for any theme toggle UI.
4. **Author components inline.** Build the first set of pages and primitives directly in `ds-candidates/` (and `portal/` for portal-only chrome). Apply the authoring rules and anti-patterns from the start.
5. **Promote when ready.** When a candidate satisfies the readiness checklist:
   - In the design-system repo: `cp -r` the candidate folder into `src/primitives/<Component>/` (excluding the colocated `.test.tsx`), `git mv` the test file to `tests/primitives/<Component>.test.tsx` to match the destination convention, update `src/index.ts`, run lint/typecheck/test/build, add a changeset, ship via the release workflow.
   - In the portal repo: `bun update @donaldgifford/design-system`, swap candidate imports for package imports, delete `ds-candidates/<Component>/` (and its now-orphaned test), verify pages render identically.
6. **Repeat step 5 per primitive.** No big-bang migration.

For parallel iteration on the design system: `bun link` from the design-system checkout, `bun link @donaldgifford/design-system` in the portal. Critical: run the design-system build after each edit (the portal imports from `dist/`, not source), add a changeset for any user-visible change, and **unlink before final testing** so the portal verifies against a published version.

## Open Questions

### Resolved during initial review

- ~~**Bundler:**~~ **Vite.** Driven by SSR maturity, the framework choice (RR7 is Vite-native), and the OpenAPI-codegen / Markdown-rendering plugin ecosystem. Bun stays as runtime + package manager.
- ~~**Auth file:**~~ **`bunfig.toml`.** Bun is the runtime; native config keeps the toolchain consistent. `.npmrc` is not committed.
- ~~**Framework + router:**~~ **React 19 + React Router v7**, following Oxide's `rfd-site`. Ratified in [ADR-0002](../adr/0002-adopt-portal-frontend-stack.md). React Router v7 covers what was previously two questions (framework and router).
- ~~**"Ready to promote" checklist canonical home:**~~ This design (the [`ds-candidates/` contract](#the-ds-candidates-contract) subsection) is the canonical home. Resolved on archival of the build guide. External docs link here.
- ~~**OpenAPI generator:**~~ **`orval`.** Picked over `@hey-api/openapi-ts` and `openapi-typescript`+`openapi-fetch` because it generates TanStack Query hooks directly (closing the gap that Oxide's stack closes by hand-writing them) and includes MSW handler generation for component tests. Notable: Oxide's own `@oxide/openapi-gen-ts` is Dropshot-specific and not portable to our hand-authored `rfc-api` spec — see ADR-0001 References. Codified alongside React Router v7 + TanStack Query in [ADR-0002](../adr/0002-adopt-portal-frontend-stack.md).
- ~~**Test colocation:**~~ **Colocate.** Tests live next to the component in the candidate folder (`ds-candidates/Button/Button.test.tsx`). The candidate folder stays self-contained for portal development; the test file's source path in this repo doesn't constrain the destination because the file is moved on promotion regardless.
- ~~**Test promotion mechanics:**~~ Tests don't `cp -r` with the component. Promotion is two mechanical operations: (1) `cp -r ds-candidates/<Component>/` → `design-system/src/primitives/<Component>/` (excluding the `.test.tsx`), then (2) `git mv ds-candidates/<Component>/<Component>.test.tsx` → `design-system/tests/primitives/<Component>.test.tsx`. The destination convention (top-level `tests/` mirroring `src/`) is what the design-system repo already uses; we conform to it on arrival, not before.
- ~~**Explicit dark default:**~~ **Explicit.** `index.html` sets `<html data-theme="dark">` rather than relying on the stylesheet's implicit `:root` default. Three characters of clarity at zero runtime cost; the html element's `data-theme` is present from first paint, matching what `useTheme` writes on subsequent toggles.

- ~~**Markdown rendering pipeline:**~~ Lifted into [DESIGN-0002 — Markdown rendering pipeline](./0002-markdown-rendering-pipeline.md). The full plugin chain (`react-markdown` + `remark-gfm` + custom boilerplate-strip + `rehype-slug` + `rehype-autolink-headings` + `@shikijs/rehype` + `rehype-sanitize`) and mermaid client-hydration strategy live there.

### Still open

- *(none currently — all questions raised on initial review have been resolved or lifted into companion docs)*

## References

In this repo:

- [Archived build guide — `docs/archive/0001-rfc-site-build-guide.md`](../archive/0001-rfc-site-build-guide.md) — original source material; lifted into this design and the related ADRs. Frozen snapshot, not authoritative.
- [ADR-0001 — Consume rfc-api via its published OpenAPI contract](../adr/0001-consume-rfc-api-via-its-published-openapi-contract.md) — the API-integration half of the portal architecture; this design defers all API-shape concerns to that ADR.
- [Integration reference — `docs/integration/rfc-api-reference.md`](../integration/rfc-api-reference.md) — companion cookbook to ADR-0001: endpoint payloads, error-sentinel UX mapping, Markdown contract, local-stack runbook.
- [Vendored OpenAPI spec — `api/openapi.yaml`](../../api/openapi.yaml) — the authoritative shape this portal codes against.

Reference implementation:

- [Oxide `rfd-site`](https://github.com/oxidecomputer/rfd-site) — the closest analogue to what we are building. Stack: React 19 + React Router v7 + Vite + TanStack Query + a generated OpenAPI client (`@oxide/rfd.ts`) + their own design system.

In `donaldgifford/rfc-api`:

- [rfc-api RFC-0002 — rfc-site web frontend for the Markdown Portal](https://github.com/donaldgifford/rfc-api/blob/main/docs/rfc/0002-rfc-site-web-frontend-for-the-markdown-portal.md) — `rfc-site` scope and phases.
- [rfc-api `api/openapi.yaml`](https://github.com/donaldgifford/rfc-api/blob/main/api/openapi.yaml) — the API surface this portal consumes.

In `donaldgifford/design-system`:

- [RFC-0002 — internal design system](https://github.com/donaldgifford/design-system/blob/main/docs/rfc/0002-internal-design-system.md) — purpose and rollout strategy. Especially §Rollout, which is the basis for portal-first development.
- [ADR-0001 — distribute design system via internal npm registry in a dedicated repo](https://github.com/donaldgifford/design-system/blob/main/docs/adr/0001-distribute-design-system-via-internal-npm-registry-in-a-dedicated-repo.md) — distribution model (GitHub Packages).
- [ADR-0002 — React + tokens as primitive foundation; defer headless libraries](https://github.com/donaldgifford/design-system/blob/main/docs/adr/0002-react-tokens-as-primitive-foundation-defer-headless-libraries.md) — most load-bearing decision; the reason the portal cannot pull in Radix Themes / shadcn / Material.
- [ADR-0003 — adopt Lucide as the base icon set](https://github.com/donaldgifford/design-system/blob/main/docs/adr/0003-adopt-lucide-as-the-base-icon-set.md) — relevant once an Icon primitive is needed.
- [ADR-0004 — ship dark and light themes in v1 with a token-driven switcher](https://github.com/donaldgifford/design-system/blob/main/docs/adr/0004-ship-dark-and-light-themes-in-v1-with-a-token-driven-switcher.md) — `data-theme` contract and `useTheme` hook.
- [DESIGN-0001 — design token architecture](https://github.com/donaldgifford/design-system/blob/main/docs/design/0001-design-token-architecture.md) — two-layer token model and naming conventions.
- [DESIGN-0002 — primitive component API conventions](https://github.com/donaldgifford/design-system/blob/main/docs/design/0002-primitive-component-api-conventions.md) — the API contract `ds-candidates/` components mirror so promotion is `cp -r`.
- [IMPL-0001 — bootstrap package and ship tokens/theming](https://github.com/donaldgifford/design-system/blob/main/docs/impl/0001-bootstrap-package-and-ship-tokens-theming.md) — the (done) implementation plan that produced `@donaldgifford/design-system@0.1.0`. This design picks up at IMPL-0001 Phase 6.
- [`0001-portal-cutover-guide.md`](https://github.com/donaldgifford/design-system/blob/main/docs/impl/0001-portal-cutover-guide.md) — brownfield variant of the build guide (for an existing portal migrating off inline tokens). Not what `rfc-site` needs, but useful prior art for future consumers.
