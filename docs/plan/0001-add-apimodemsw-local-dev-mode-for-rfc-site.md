---
id: PLAN-0001
title: "Add API_MODE=msw local dev mode for rfc-site"
status: Draft
author: Donald Gifford
created: 2026-04-30
---
<!-- markdownlint-disable-file MD025 MD041 -->

# PLAN 0001: Add API_MODE=msw local dev mode for rfc-site

**Status:** Draft
**Author:** Donald Gifford
**Date:** 2026-04-30

<!--toc:start-->
- [Goal](#goal)
- [Context](#context)
- [Approach](#approach)
  - [Part 1: Boot MSW conditionally on both sides of SSR](#part-1-boot-msw-conditionally-on-both-sides-of-ssr)
  - [Part 2: Aggregate the orval-generated handlers](#part-2-aggregate-the-orval-generated-handlers)
  - [Part 3: Operator surface — flags, scripts, docs](#part-3-operator-surface--flags-scripts-docs)
- [Components](#components)
- [File Changes](#file-changes)
- [Verification](#verification)
- [Dependencies](#dependencies)
- [Open Questions](#open-questions)
- [References](#references)
<!--toc:end-->

## Goal

`bun run dev:msw` boots the rfc-site SSR app with **no** dependency on a
running `rfc-api`, no GitHub webhook, no GitHub PAT, and no seeded
Postgres. The orval-generated handlers + `@faker-js/faker` fixtures
serve every endpoint the routes use today (`listDocs`, `getDoc`, plus
the 7807 problem responses for the error-boundary surfaces).

Concretely, the operator-facing experience after this plan ships:

```sh
# Terminal 1: nothing. (No rfc-api, no Postgres, no GitHub webhook.)

# Terminal 2:
just dev:msw
# → vite serves on localhost:5173
# → /  shows a card grid with ≥ 1 fake doc
# → click → renders title + <Badge> + body
# → /rfc/9999 → portal 404 surface
```

Today's `bun run dev` (live `rfc-api` mode) keeps working unchanged —
this is an additive flag, not a replacement.

## Context

[IMPL-0001 §Phase 3 Open Questions](../impl/0001-bootstrap-portal-scaffold-per-design-0001.md#phase-3) recorded the dev-mode resolution as:

> **Resolution: require local rfc-api running for `bun run dev`.** orval's
> MSW handlers are used by the vitest smoke test only; revisit an
> `API_MODE=msw` fork (Oxide-style) if frontend-side iteration becomes
> hampered.

The escape-hatch condition has now triggered. Closing IMPL-0001's PR
([#2](https://github.com/donaldgifford/rfc-site/pull/2)) revealed that
the live-stack smoke checks in the test plan (visit `/`, click a doc,
see `/rfc/9999` → 404) cannot be performed in the loop's dev environment
because seeding rfc-api needs the GitHub-webhook ingest pipeline. That
pipeline is rfc-api's concern, not rfc-site's, and bringing it up just
to render a card grid is wildly disproportionate.

The orval config already enables MSW handler generation
(`mock: true` in `orval.config.ts`) and `tests/api/*` already wires
those handlers into vitest. We have all the materials — this plan is
about wiring them into the dev server, not generating anything new.

We also follow Oxide's [`rfd-site`](https://github.com/oxidecomputer/rfd-site)
precedent: their dev mode runs against an MSW-backed mock by default,
which is what made their portal pleasant to iterate on.

This plan is intentionally *not* an ADR. The decision was already
recorded in IMPL-0001's resolution log — the escape hatch was
foreseen. This document is the plan to execute the escape hatch, and
will spawn IMPL-0002 for the actual checklist work.

## Approach

### Part 1: Boot MSW conditionally on both sides of SSR

RR7's framework mode generates `entry.client.tsx` and `entry.server.tsx`
internally. To inject our MSW boot we add **explicit** entry overrides
so we can run code before hydration / before the SSR render pipeline
makes its first fetch.

**Browser side (`src/entry.client.tsx`):**

```tsx
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

async function enableMocking() {
  if (import.meta.env.MODE !== "development") return;
  if (import.meta.env.VITE_API_MODE !== "msw") return;
  const { worker } = await import("./portal/api/msw/browser");
  await worker.start({ onUnhandledRequest: "bypass" });
}

void enableMocking().then(() => {
  startTransition(() => {
    hydrateRoot(document, <StrictMode><HydratedRouter /></StrictMode>);
  });
});
```

**Server side (`src/entry.server.tsx`):** at module load (before any
loader runs) check `process.env.API_MODE === "msw"` and call
`setupServer(...handlers).listen({ onUnhandledRequest: "bypass" })`.
Module-level so it's set up exactly once per worker.

The flag has two surface forms because Vite namespaces client-exposed
vars: `VITE_API_MODE` for `import.meta.env`, plain `API_MODE` for
`process.env`. The `dev:msw` script sets both. Documented in the README
and `.env.example` so contributors aren't surprised.

`onUnhandledRequest: "bypass"` is deliberate — we don't want MSW
swallowing requests for static assets, the RR7 manifest, or
`mockServiceWorker.js` itself.

### Part 2: Aggregate the orval-generated handlers

orval emits per-tag handler files at
`src/portal/api/__generated__/<tag>/<tag>.msw.ts`. **We do not use the
generated handlers as-is** — they return per-call `faker` payloads,
which gives us non-deterministic IDs that don't round-trip from
listDocs to getDoc. Instead, we hand-write thin handlers that read a
fixture tree on disk.

Modules under `src/portal/api/msw/`:

- `fixtures.ts` — at module load, read `tests/examples/docs/<type>/`
  directories and parse the `0001-*.md` files (frontmatter + body).
  Build an in-memory `Document[]` indexed by `(type, id)`. Cache once
  per process. The fixture loader uses `node:fs` (SSR side) and a
  Vite glob import (`import.meta.glob('/tests/examples/docs/**/*.md',
  { eager: true, query: '?raw' })`) on the browser side so the
  bundle is self-contained — the worker doesn't need network access
  to a separate fixture URL.
- `handlers.ts` — `http.get('/docs', …)` returns a paginated slice of
  the fixture array with the RFC 5988 `Link` header set;
  `http.get('/docs/:type/:id', …)` looks up the fixture or returns a
  7807 `ErrNotFound` payload; `http.get('/search', …)` returns a
  filtered slice. Faker is used only for non-structural filler (a
  random author name when the frontmatter doesn't have one, a random
  `request_id` on errors).
- `browser.ts` — `export const worker = setupWorker(...handlers)` with
  the runtime safety check that errors loudly if imported in node.
- `server.ts` — `export const server = setupServer(...handlers)` with
  the inverse safety check.

The fixture tree mirrors docz's normal output so IDs are stable,
predictable, and look like real docz documents. Concretely, today the
rfc-site repo's own docs already follow this layout — we copy a small
subset (or write fresh fixtures) under `tests/examples/docs/` so the
fixture tree itself is review-able and grep-able. Suggested seed
contents:

```
tests/examples/docs/
  rfc/
    0001-example-proposal.md
    0002-another-proposal.md
  adr/
    0001-example-decision.md
  design/
    0001-example-design.md
  impl/
    0001-example-impl.md
  plan/
    0001-example-plan.md
  inv/
    0001-example-investigation.md
  README.md           # explains "this is a fixture tree, not real
                     # docs — see PLAN-0001"
```

Round-trip property: `GET /docs` returns IDs like
`{ type: "rfc", id: "0001-example-proposal" }`, and `GET
/docs/rfc/0001-example-proposal` returns the same fixture. No
404 surprises in dev.

### Part 3: Operator surface — flags, scripts, docs

- `package.json`: add `"dev:msw": "API_MODE=msw VITE_API_MODE=msw react-router dev"`.
- `justfile`: add `dev-msw: bun run dev:msw` recipe; alias as
  `just dev:msw` if just allows colons in recipe names (else
  `just dev-msw`).
- `public/mockServiceWorker.js`: generated by `bunx msw init public/`.
  Committed (per [MSW best practice](https://mswjs.io/docs/integrations/browser#service-worker-script))
  — this file has the MSW worker version baked in, and CI needs it on
  disk for the production-build assertion that no MSW code leaked.
- `.env.example`: document `API_MODE=msw` (server) and
  `VITE_API_MODE=msw` (client). Note that the dev script sets both
  for you so you usually don't need to.
- `README.md`: add a "Local development without rfc-api" section that
  points at `just dev:msw` and explains when to use it
  (iterating on routes / components / styling) vs `just dev` (verifying
  the rfc-api contract end-to-end).
- `CLAUDE.md`: short note in the Tooling section so future Claude
  sessions know the flag exists.

## Components

| Component | Purpose |
|-----------|---------|
| `src/entry.client.tsx` | RR7 client entry override — boots MSW worker before hydration when `VITE_API_MODE=msw`. |
| `src/entry.server.tsx` | RR7 server entry override — boots MSW server at module load when `API_MODE=msw`. |
| `src/portal/api/msw/fixtures.ts` | Reads `tests/examples/docs/**/*.md`, returns an indexed `Document[]`. |
| `src/portal/api/msw/handlers.ts` | Hand-written `http.*` handlers backed by `fixtures.ts`; the single source of MSW handler truth. |
| `src/portal/api/msw/browser.ts` | `setupWorker(...handlers)` — browser only. |
| `src/portal/api/msw/server.ts` | `setupServer(...handlers)` — node only. |
| `tests/examples/docs/<type>/<id>.md` | Hand-curated fixture tree; mirrors docz layout. |
| `tests/examples/docs/README.md` | "This is a fixture tree, not real docs — see PLAN-0001." |
| `public/mockServiceWorker.js` | MSW's prebuilt service worker; checked in. |
| `package.json` script `dev:msw` | One-shot env-flag wrapper around `react-router dev`. |
| `justfile` recipe `dev-msw` | Recipe parity with the package.json script. |
| `.env.example` + `README.md` | Operator-facing documentation. |

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/entry.client.tsx` | Create | RR7 client entry override; conditional MSW worker boot. |
| `src/entry.server.tsx` | Create | RR7 server entry override; conditional MSW server boot. |
| `src/portal/api/msw/fixtures.ts` | Create | Fixture-tree loader (node `fs` + Vite glob). |
| `src/portal/api/msw/handlers.ts` | Create | Hand-written handlers reading from `fixtures.ts`. |
| `src/portal/api/msw/browser.ts` | Create | `setupWorker` wrapper. |
| `src/portal/api/msw/server.ts` | Create | `setupServer` wrapper. |
| `tests/examples/docs/**/*.md` | Create | Hand-curated fixture tree (1 file per type to start). |
| `tests/examples/docs/README.md` | Create | Pointer to PLAN-0001. |
| `public/mockServiceWorker.js` | Create | Output of `bunx msw init public/`. |
| `package.json` | Modify | Add `"dev:msw"` script. Move `msw` and `@faker-js/faker` from `devDependencies` to `dependencies` (used at dev runtime, not test-only). |
| `justfile` | Modify | Add `dev-msw` recipe. |
| `.env.example` | Modify | Document `API_MODE` / `VITE_API_MODE`. |
| `README.md` | Modify | Add "Local development without rfc-api" section. |
| `CLAUDE.md` | Modify | One-line pointer in Tooling. |
| `vite.config.ts` | Modify (maybe) | If MSW worker needs a Vite plugin opt-in — confirm during implementation. |
| `tests/api/server.ts` | Reference | Existing test setup is the model for `src/portal/api/msw/server.ts`. |

## Verification

```bash
# Setup
just install

# Happy path
just dev-msw &
DEV_PID=$!
sleep 3
curl -fsSL http://localhost:5173/ | grep -q "ds-card"          # directory grid SSR'd
curl -fsSL http://localhost:5173/rfc/test-id-1 | grep -q "ds-badge"  # doc page SSR'd
kill $DEV_PID

# 404 surface
just dev-msw &
DEV_PID=$!
sleep 3
curl -fsSL http://localhost:5173/rfc/does-not-exist | grep -q "Not found"
kill $DEV_PID

# Regression: live-API dev mode still works (env-flag absent)
RFC_API_URL=http://localhost:8080 just dev &
DEV_PID=$!
sleep 3
# (smoke against rfc-api as before — manual)
kill $DEV_PID

# Production build does not bundle MSW or faker (local-only check)
just build
! grep -q "msw" build/server/index.js && echo "OK: server bundle clean"
! grep -rq "msw" build/client/assets/ && echo "OK: client bundle clean"

# Existing test suite stays green
just check
```

The "production build does not bundle MSW" check stays *local* for
v1 — we don't add a CI assertion until there's a second reason to
spin a dev server in CI (e.g., Playwright e2e). See Resolved Q1.

## Dependencies

- **Hard:** `msw@^2` and `@faker-js/faker@^10` (already in
  `devDependencies` from Phase 3). Move to `dependencies` since
  they're now imported at dev runtime via `dev:msw`. They are
  tree-shaken out of the production build by the
  `import.meta.env.MODE !== "development"` early-return.
- **Hard:** `bunx msw init public/` (one-time scaffold of
  `mockServiceWorker.js`).
- **Soft:** None. This work is independent of any other open IMPL or
  pending design decision.

## Resolved

- ~~**Should `dev:msw` also be the CI dev-server target?**~~ **Defer.**
  Skip the "production build does not bundle MSW" CI assertion for v1
  and revisit when we add Playwright e2e or an analogous reason to
  spin a dev server in CI. The Verification section's local-build
  grep is enough belt-and-suspenders for now.
- ~~**How do faker-generated IDs round-trip through router params?**~~
  **Pin a deterministic fixture set on disk under
  `tests/examples/docs/`** mirroring the canonical docz layout
  (`rfc/`, `adr/`, `design/`, `impl/`, `plan/`, `inv/` subdirs with
  numbered `0001-…md` files). The MSW handlers read this fixture
  tree at startup so IDs / titles / bodies are stable across reloads
  and align with what real docz output looks like. Bonus: the same
  fixtures double as `tests/api/*` corpus and as a docz layout
  smoke-target.
- ~~**Faker locale / themes?**~~ **English only.** No i18n preview
  mode in scope. Faker is used only for free-form filler text on
  fields that don't come from the fixture tree (e.g., author names,
  short summaries) — never for structural fields like type / id /
  status.

## Open Questions

-

## References

- [IMPL-0001 §Phase 3 — Open Question resolution](../impl/0001-bootstrap-portal-scaffold-per-design-0001.md#phase-3) — the decision this plan reverses.
- [DESIGN-0001 §Architecture: portal-first, primitives follow](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md) — the portal/api boundary the MSW layer slots into.
- [ADR-0002 — Adopt portal frontend stack](../adr/0002-adopt-portal-frontend-stack.md) — RR7 + Vite + Bun stack assumptions.
- [Integration reference §Local development](../integration/rfc-api-reference.md#local-development) — the alternative "live rfc-api" path that `dev:msw` complements.
- [MSW docs — Browser integration](https://mswjs.io/docs/integrations/browser)
- [MSW docs — Node.js integration](https://mswjs.io/docs/integrations/node)
- Oxide's `rfd-site` — precedent for MSW-backed dev mode.
