---
id: ADR-0002
title: "Adopt React 19 + React Router v7 + TanStack Query + orval as the portal stack"
status: Proposed
author: Donald Gifford
created: 2026-04-27
---
<!-- markdownlint-disable-file MD025 MD041 -->

# 0002. Adopt React 19 + React Router v7 + TanStack Query + orval as the portal stack

<!--toc:start-->
- [Status](#status)
- [Context](#context)
- [Decision](#decision)
  - [Stack at a glance](#stack-at-a-glance)
  - [Why each piece](#why-each-piece)
- [Consequences](#consequences)
  - [Positive](#positive)
  - [Negative](#negative)
  - [Neutral](#neutral)
- [Alternatives Considered](#alternatives-considered)
- [References](#references)
<!--toc:end-->

## Status

Proposed.

## Context

`rfc-site` needs a frontend stack — framework, router, data-fetching layer, OpenAPI client generator. Several pieces have already been decided in flight:

- The [archived build guide](../archive/0001-rfc-site-build-guide.md) committed us to **React 19**.
- [DESIGN-0001 §Resolved](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md#resolved-during-initial-review) decided on **Vite** as the bundler and **Bun** as the runtime + package manager.
- [ADR-0001 §Resolved (post-initial-draft)](./0001-consume-rfc-api-via-its-published-openapi-contract.md#resolved-post-initial-draft) decided on **`orval`** as the OpenAPI client generator.
- DESIGN-0001 names **Oxide's [`rfd-site`](https://github.com/oxidecomputer/rfd-site)** as the reference implementation we are tracking — a React 19 + React Router v7 + Vite + TanStack Query app.

What is *not* yet recorded as a decision is the framework + router + data-fetching layer itself. This ADR ratifies that and consolidates the previously-decided pieces into a single record so future contributors can answer "what stack does the portal use?" by reading one document.

## Decision

### Stack at a glance

| Layer | Choice | Where decided |
|---|---|---|
| Runtime + package manager | **Bun** (latest stable) | Build guide; ratified here |
| Bundler | **Vite** | DESIGN-0001; ratified here |
| Framework + router | **React 19 + React Router v7** | This ADR |
| Data fetching | **TanStack Query** | This ADR |
| OpenAPI client generator | **`orval`** | ADR-0001 §Resolved (post-initial-draft); ratified here |
| Language | TypeScript strict, `target: ES2022`, `moduleResolution: bundler` | Build guide; mirror design-system repo |
| Lint / format | ESLint v9 flat + Prettier (mirror design-system repo) | Build guide |
| Tests | vitest + jsdom + `@testing-library/react` (mirror design-system repo) | Build guide |

### Why each piece

- **React 19.** `@donaldgifford/design-system`'s peer dep is `^18 || ^19`; React 19 is the path of least friction. Aligns with Oxide's `rfd-site` (also React 19).
- **React Router v7.** Post-Remix-merger, RR7 is the React-ecosystem framework + router unified into one package. It is what Oxide's `rfd-site` uses (`react-router`, `@react-router/fs-routes`, `@react-router/node`, `@react-router/serve`, `@react-router/dev`). Native SSR, file-system routing, route loaders/actions, Vite-native. Picking RR7 closes the previously-open framework question without expanding scope to evaluate Next.js, SvelteKit, or Astro — see Alternatives Considered.
- **TanStack Query.** Per Oxide's `rfd-site` (which uses `@tanstack/react-query`). Pairs natively with `orval`'s generated client (`orval` emits TanStack Query hooks directly). Handles caching, revalidation, request dedup, and loading-state machinery without us writing it.
- **`orval`.** Already decided in [ADR-0001 §Resolved (post-initial-draft)](./0001-consume-rfc-api-via-its-published-openapi-contract.md#resolved-post-initial-draft). Auto-generates TanStack Query hooks (saving the hand-written hook layer Oxide writes manually), plus MSW handler generation for component tests, plus optional zod schemas for runtime validation at the boundary. The full alternative analysis (`@hey-api/openapi-ts`, `openapi-typescript`+`openapi-fetch`, `@oxide/openapi-gen-ts`) lives in that ADR; this one only ratifies.
- **Vite.** Already decided in [DESIGN-0001 §Resolved](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md#resolved-during-initial-review). React Router v7 is Vite-native (RR7's templates use Vite by default), making this self-consistent. The OpenAPI codegen and Markdown rendering plugin ecosystems both assume Vite.
- **Bun.** Runtime + package manager only — Vite owns bundling. Per the (archived) build guide. Note: `mise.toml` still pins `node = 22` and `pnpm = 10.33.2` from the design-system repo template; reconcile (add `bun`, drop `pnpm`) when scaffolding starts.

## Consequences

### Positive

- **Cohesive, opinionated stack.** Every piece is chosen to compose with the next: orval emits TanStack Query hooks, RR7 is Vite-native, design-system's `useTheme` is React-19 SSR-safe. Few decisions left for "later."
- **Reference implementation exists.** Oxide's `rfd-site` is a working precedent for ~80% of this stack. We're not pioneering — we're copying a known-good pattern with two intentional divergences (no Tailwind, orval instead of a custom generator).
- **SSR + typed API client + caching from day one.** RR7 ships SSR; orval generates types and hooks; TanStack Query handles network-state concerns. The first page of `rfc-site` should render real `rfc-api` data without ad-hoc fetch helpers.
- **Single record of stack truth.** Future contributors point at this ADR; previously-decided pieces are linked from one place.

### Negative

- **React Router v7 is relatively young** (post-Remix-merger). Conventions around route loaders + TanStack Query coexistence — when to fetch in a loader vs in a query hook — are still consolidating in the community. We will need to define a portal-local pattern (likely: loaders for SSR-critical first-paint data, TanStack Query for everything client-rendered).
- **`orval`'s generated output is sizable.** Mitigated by gitignoring it and regenerating in CI per ADR-0001.
- **Locks us into the React ecosystem.** SvelteKit / Astro / etc. are off the table by transitive consequence of React 19 (see Alternatives Considered).

### Neutral

- **Bundler-runtime split** (Bun runtime + Vite bundler) is unconventional but well-supported. If it causes friction, swapping to Bun's native bundler later is a config-level change, not an architectural one.
- **No `next.config.*`-style framework config sprawl.** RR7 has its own conventions (file-system routes, server entry); pattern documentation is a near-term task.

## Alternatives Considered

- **Next.js (App Router).** Rejected. Next.js is more mature than RR7 and has a larger ecosystem, but it's heavier than we need (full server framework with caching/middleware/RSC) and would diverge from Oxide's `rfd-site` precedent. Switching costs nothing today, and Next's RSC story is a complexity we have no use for.
- **Remix (v2, pre-merger).** Superseded by RR7 — Remix v3 became React Router v7. Picking Remix v2 today would mean migrating to RR7 within a year.
- **SvelteKit / Astro.** Rejected by the build guide's commitment to React 19. Reconsidering them would mean throwing away the design-system integration story (`@donaldgifford/design-system` is a React component library; it cannot be consumed from Svelte/Astro components without a wrapper layer).
- **TanStack Query alternatives.**
  - *SWR:* smaller and simpler but ecosystem-light; orval's first-class integration is with TanStack Query.
  - *Plain fetch + React state:* viable for a small surface but would re-derive caching/dedup/retry logic the team would have to maintain.
  - *Apollo Client / urql:* GraphQL-shaped libraries; `rfc-api` is REST + OpenAPI by [ADR-0001](./0001-consume-rfc-api-via-its-published-openapi-contract.md), so these are off-spec.
- **Bun's native bundler instead of Vite.** Rejected in DESIGN-0001 §Resolved. Bun's bundler is fine for trivial SPAs but lacks the SSR maturity and plugin ecosystem we need (RR7, OpenAPI codegen, future Markdown rendering).
- **`@oxide/openapi-gen-ts` instead of `orval`.** Investigated and rejected in [ADR-0001 §Resolved (post-initial-draft)](./0001-consume-rfc-api-via-its-published-openapi-contract.md#resolved-post-initial-draft) — it is Dropshot-specific and explicitly not portable.

## References

In this repo:

- [DESIGN-0001 — Portal architecture and ds-candidates promotion model](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md) — bundler (Vite) + Bun runtime decisions, plus the portal architecture this stack runs inside.
- [DESIGN-0002 — Markdown rendering pipeline](../design/0002-markdown-rendering-pipeline.md) — uses this stack (`react-markdown` + unified ecosystem, runs under RR7 SSR, sanitized HTML output served to React 19).
- [ADR-0001 — Consume rfc-api via its published OpenAPI contract](./0001-consume-rfc-api-via-its-published-openapi-contract.md) — `orval` decision and full alternatives analysis.
- [Integration reference — `docs/integration/rfc-api-reference.md`](../integration/rfc-api-reference.md) — the rfc-api contract this stack codes against.
- [Archived build guide — `docs/archive/0001-rfc-site-build-guide.md`](../archive/0001-rfc-site-build-guide.md) — original tooling commitments (React 19, vitest, ESLint v9, Prettier).

External:

- [Oxide `rfd-site`](https://github.com/oxidecomputer/rfd-site) — reference implementation. React 19 + React Router v7 + Vite + TanStack Query + their own OpenAPI generator.
- [React Router v7](https://reactrouter.com/) — framework + router.
- [TanStack Query](https://tanstack.com/query/latest) — data-fetching layer.
- [orval](https://orval.dev/) — OpenAPI client generator.
