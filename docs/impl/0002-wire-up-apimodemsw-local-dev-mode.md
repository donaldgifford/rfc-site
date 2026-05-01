---
id: IMPL-0002
title: "Wire up API_MODE=msw local dev mode"
status: Draft
author: Donald Gifford
created: 2026-04-30
---
<!-- markdownlint-disable-file MD025 MD041 -->

# IMPL 0002: Wire up API_MODE=msw local dev mode

**Status:** Draft
**Author:** Donald Gifford
**Date:** 2026-04-30

<!--toc:start-->
- [Objective](#objective)
- [Scope](#scope)
  - [In Scope](#in-scope)
  - [Out of Scope](#out-of-scope)
- [Implementation Phases](#implementation-phases)
  - [Phase 1: Fixture tree](#phase-1-fixture-tree)
  - [Phase 2: Fixture loader (`fixtures.ts`)](#phase-2-fixture-loader-fixturests)
  - [Phase 3: MSW handlers + wrappers + real pagination](#phase-3-msw-handlers--wrappers--real-pagination)
  - [Phase 4: Unify `tests/api/*` against the shared fixtures](#phase-4-unify-testsapi-against-the-shared-fixtures)
  - [Phase 5: Conditional MSW boot (`entry.client.tsx` + SSR setup)](#phase-5-conditional-msw-boot-entryclienttsx--ssr-setup)
  - [Phase 6: Operator surface (script, recipe, docs)](#phase-6-operator-surface-script-recipe-docs)
  - [Phase 7: Verification + PR-2 test plan refresh](#phase-7-verification--pr-2-test-plan-refresh)
- [File Changes](#file-changes)
- [Testing Plan](#testing-plan)
- [Dependencies](#dependencies)
- [Resolved](#resolved)
- [Open Questions](#open-questions)
- [References](#references)
<!--toc:end-->

## Objective

Implement the `API_MODE=msw` local dev mode designed in
[PLAN-0001](../plan/0001-add-apimodemsw-local-dev-mode-for-rfc-site.md) so
contributors can run `bun run dev:msw` (alias `just dev-msw`) against a
hand-curated fixture tree and iterate on routes / components / styling
without standing up `rfc-api`, Postgres, or the GitHub-webhook ingest
pipeline. The existing `bun run dev` path (against a live `rfc-api`)
continues to work unchanged.

**Implements:** [PLAN-0001](../plan/0001-add-apimodemsw-local-dev-mode-for-rfc-site.md)

## Scope

### In Scope

- Hand-curated fixture tree at `tests/examples/docs/<type>/<id>.md`
  mirroring the canonical docz layout.
- A fixture loader that reads the tree from both SSR (`node:fs`) and
  the browser (`import.meta.glob`) and returns a typed `Document[]`.
- MSW handlers covering every endpoint the routes in `src/routes/**`
  consume today: `listDocs`, `listDocsByType`, `getDoc`, `searchDocs`,
  plus the 7807 `ErrNotFound` payload for the route-error-boundary
  surface.
- **Real RFC 5988 `Link`-header pagination** with cursor strings — so
  dev-mode exercises the same code path the live API will, and a
  cursor-parser regression surfaces in dev (not just CI).
- **Migrating the existing `tests/api/*` integration tests to share
  the new fixture tree** so the doc corpus has a single source of
  truth. Targeted error-path overrides (`mockProblem(404)` etc.) stay.
- A side-effect SSR boot in `src/portal/api/msw/setup.ts`
  (`server.listen()` at module load when `API_MODE=msw`), imported by
  `src/root.tsx`. **No `entry.server.tsx` override** — keeps RR7's
  default streaming entry untouched, no boilerplate to maintain.
- An RR7 `entry.client.tsx` override — necessary to `await
  worker.start()` before hydration.
- A pinned `mockServiceWorker.js` in `public/` (committed).
- Operator surface: `bun run dev:msw` script, `just dev-msw` recipe,
  `.env.example` + `README.md` + `CLAUDE.md` updates.
- Local verification (curl smokes, "no MSW in prod bundle" grep).
- Refresh PR #2's test plan to point at `dev:msw` for the manual
  smoke checks.

### Out of Scope

- A CI assertion that the production bundle is MSW-free
  (PLAN-0001 Resolved Q1 — defer until there's a second CI dev-server
  reason).
- `API_MODE=msw` in production builds (the flag short-circuits in
  any non-`development` mode).
- Internationalisation of fixture content (PLAN-0001 Resolved Q3 —
  English only).
- A randomness knob (`API_SEED=…`); deferred until anyone asks for it.
- Playwright / e2e harness changes.
- Trimming the orval-emitted `*ResponseMock` faker factories that
  Phase 3 doesn't import — they're regenerated, harmless, and
  trimming would require an orval-config change that also kills the
  `*MockHandler` factories we *do* depend on.

## Implementation Phases

Each phase builds on the previous one. A phase is complete when all
its tasks are checked off and its success criteria are met. Phases
1–4 are pure logic; Phases 5–7 do the wiring + verification.

---

### Phase 1: Fixture tree

The on-disk corpus the loader will read. Hand-curated, deterministic,
mirrors the docz layout. Done first because every later phase
references it.

The pattern: filenames carry numeric prefixes for ordering
(`0001-…md`, `0002-…md`); frontmatter carries the canonical
`Document.id` (must match `^[A-Z]+-[0-9]+$` per the openapi spec).
Body is real Markdown so the renderer downstream
([DESIGN-0002](../design/0002-markdown-rendering-pipeline.md)) has
something realistic to chew on.

#### Tasks

- [x] Create `tests/examples/docs/` with one subdir per
  `DocumentType.id`: `rfc/`, `adr/`, `design/`, `impl/`, `plan/`,
  `inv/`.
- [x] Author at least one fixture per type. Each file frontmatter:
  ```yaml
  ---
  id: RFC-0001
  type: rfc
  title: "Example proposal"
  status: proposed
  authors:
    - name: "Sam Author"
      handle: "samauthor"
  created_at: 2026-01-15T09:00:00Z
  updated_at: 2026-02-03T11:30:00Z
  source:
    repo: "donaldgifford/rfc-site"
    path: "tests/examples/docs/rfc/0001-example-proposal.md"
    commit: "deadbeef"
  ---
  ```
  Body is Markdown (intro paragraph + a fenced code block + a
  list — enough to exercise the renderer).
- [x] Add at least 2 RFCs and 2 ADRs so listDocs returns multiple
  rows and **pagination has multiple pages to slice** (Phase 3
  pagination becomes meaningful here — set the per-page limit
  small enough that ≥ 2 pages exist with the current corpus, e.g.
  `limit=3`). 8 fixtures: 2 RFCs, 2 ADRs, 1 each of design/impl/plan/inv.
- [x] One fixture in `proposed`, one in `accepted`, one in `draft`
  status — drives the `<Badge>` variant rendering. Mix: 4 accepted,
  2 draft, 2 proposed.
- [x] `tests/examples/docs/README.md`: short pointer (≤ 10 lines)
  explaining "this is a fixture tree for `API_MODE=msw`, see
  PLAN-0001 / IMPL-0002. Don't import from app code outside
  `src/portal/api/msw/`."
- [ ] ~~Add `tests/examples/` to `.prettierignore` if Markdown
  formatting drift becomes annoying~~ — defer until it does.
  Prettier left them alone in this commit.

#### Success Criteria

- `find tests/examples/docs -name '*.md' -not -name 'README.md' | wc -l` ≥ 6.
- Every fixture parses as valid YAML frontmatter + Markdown body.
- Every fixture's `id` matches `^[A-Z]+-[0-9]+$`.
- Every fixture's `type` matches its parent directory name.
- Bun + Vite + RR7 build still pass (`just check && just build`) —
  this phase is data-only, but we verify nothing is auto-routed
  from `tests/`.

---

### Phase 2: Fixture loader (`fixtures.ts`)

A single module exposing a typed in-memory index of all fixtures.
Same module works on both SSR (node) and browser sides, with a
runtime branch on `typeof window`.

The browser side uses Vite's `import.meta.glob`
(`/tests/examples/docs/**/*.md`, `{ eager: true, query: '?raw' }`) so
the worker bundle is self-contained — no separate fixture URL the
service worker would have to fetch through itself.

The SSR side uses `node:fs.readdirSync` + `readFileSync` rooted at
`process.cwd()`. RR7 dev runs from project root.

Frontmatter parsing: `yaml` package (Resolved Q3 — modern,
well-maintained, MIT). Add to `dependencies`.

#### Tasks

- [x] Add `yaml` to `dependencies` (`bun add yaml`) — landed at `^2.8.3`.
- [x] Create `src/portal/api/msw/fixtures.ts`:
  - `loadFixtures(): Promise<Document[]>` — caches the FixtureCache
    *promise* in a module variable. Async because the SSR branch
    `await import("node:fs")`s dynamically (keeps `node:*`
    builtins out of the client bundle).
  - `findById(type, id): Promise<Document | undefined>` — O(1)
    lookup against an internal `Map<string, Document>` keyed by
    `${type}/${id}`.
  - `byType(type): Promise<Document[]>` — pre-bucketed and sorted
    by `id` ascending.
- [x] Internal helpers (not exported): `parseFixture`,
  `validateDocument`, `requireString`, `requireSource` — hand-rolled
  guards, no zod.
- [x] Unit-test the loader at `tests/api/msw/fixtures.test.ts`
  (10 tests):
  - Loads ≥ 6 docs.
  - `findById("rfc", "RFC-0001")` returns the seeded fixture.
  - `findById` returns undefined for missing (type, id).
  - `byType("rfc")` returns 2 fixtures sorted by id.
  - `byType("adr")` returns 2 fixtures sorted by id.
  - `byType("nonexistent")` returns `[]`.
  - `body` field is populated with the markdown after frontmatter.
  - Required `Document` fields parse from frontmatter.
  - **Cache identity**: repeated `loadFixtures()` calls return the
    same array reference (couldn't spy on `node:fs` ESM bindings
    so identity assertion replaces the call-count check).
  - `_resetCacheForTests()` rebuilds.
- [x] Type the return shapes against `Document` from
  `__generated__/model/document.ts`.

#### Success Criteria

- `bun run test` runs the new fixture-loader test green.
- `bun run typecheck` passes — every fixture parses to a valid
  `Document` per the generated type.
- The loader is a no-op when `API_MODE` is unset at module load
  (lazy — it only does I/O when its functions are called).

---

### Phase 3: MSW handlers + wrappers + real pagination

Wire the fixture index into MSW request handlers. Use the
orval-generated `*MockHandler` factories (which carry the URL
patterns from openapi.yaml) and override their response builders
with fixture-driven payloads. **Implement real RFC 5988
pagination** — opaque cursor strings + `Link` header — so dev mode
exercises the same code path the live API does.

URL surface from `__generated__/docs/docs.msw.ts`:

| orval factory | URL pattern | Fixture-driven response |
|---|---|---|
| `getListDocsMockHandler` | `*/api/v1/docs` | paginated `await loadFixtures()` slice + `Link` header |
| `getListDocsByTypeMockHandler` | `*/api/v1/:type` | paginated `await byType(params.type)` slice + `Link` header |
| `getGetDocMockHandler` | `*/api/v1/:type/:id` | `await findById(params.type, params.id)` or 7807 ErrNotFound |
| `getSearchDocsMockHandler` | `*/api/v1/search` | paginated substring filter over `await loadFixtures()` |

> **Note on Phase 2's async API.** The fixture loader ended up
> async (`Promise<Document[]>`) so the SSR branch can `await
> import("node:fs")` without dragging `node:*` builtins into the
> client bundle. MSW handler functions are already async (return
> `HttpResponse`), so the cascade is mechanical — every fixture
> access in Phase 3 awaits.

**Cursor format.** The simplest stable cursor is a base64-encoded
opaque integer offset: `cursor = btoa(String(offsetIntoArray))`.
The handler decodes the inbound `?cursor=...` param, slices the
fixture array starting at `offset`, returns the page, and emits a
`Link: <…?cursor=NEXT>; rel="next"` header when more rows remain.
This matches RFC 5988 and what `src/portal/api/pagination.ts`
already parses, so the existing route-side pagination "just works"
in dev mode.

Page size: a `limit` query param (already in
`__generated__/model/limitParameter.ts`) overrides the default
(let's pick **3** so the seed corpus paginates with 6 fixtures).

#### Tasks

- [x] Create `src/portal/api/msw/handlers.ts` — exports
  `handlers: RequestHandler[]`. Uses `http.get` directly (not the
  orval `*MockHandler` factories) because the factories don't
  expose response-header control — needed for the `Link`
  pagination header.
- [x] Implement `paginate<T>(items, searchParams): { page, nextCursor? }`
  helper. Reads `limit` (default 3, max 200) + `cursor` (opaque
  base64-encoded integer offset) from URLSearchParams.
- [x] Set the `Link` header from each list handler when `nextCursor`
  is set. Target path is taken from the inbound URL — no hard-coded
  `/api/v1/...` strings.
- [x] Wire the `ErrNotFound` 7807 envelope (`notFound(detail)`
  helper). Returns a 404 with `Content-Type: application/problem+json`
  and a faker-generated `request_id`.
- [x] Create `src/portal/api/msw/server.ts`:
  - `import { setupServer } from "msw/node"`.
  - Top-level `if (typeof window !== "undefined") throw new Error(...)`.
  - Export `server = setupServer(...handlers)`.
- [x] Create `src/portal/api/msw/browser.ts`:
  - `import { setupWorker } from "msw/browser"`.
  - Top-level `if (typeof window === "undefined") throw new Error(...)`.
  - Export `worker = setupWorker(...handlers)`.
- [x] Faker seeding: `faker.seed(0xdec1a55)` at the top of
  `handlers.ts`. Faker is only used for non-structural filler
  (currently just `request_id` on errors).
- [x] Unit tests at `tests/api/msw/handlers.test.ts` (9 tests):
  - getDoc fixture round-trip.
  - getDoc 7807 ErrNotFound for unknown ids.
  - listDocsByType returns sorted fixtures.
  - listDocsByType 7807 for unknown types.
  - **Pagination round-trip**: traverse 8 fixtures across 3 pages
    via `Link: rel="next"` cursors, no duplicates, no gaps.
  - No `Link` header when result fits in one page.
  - `Link` target path is relative (no hard-coded host).
  - searchDocs substring filter (title / body / id).
  - searchDocs returns full corpus when `q` omitted.

#### Success Criteria

- `bun run test` includes ≥ 6 new tests in `tests/api/msw/`, all
  green.
- `bun run typecheck` passes.
- `bun run lint` passes.
- Importing `server.ts` in a browser context throws a clear error;
  importing `browser.ts` in node throws a clear error.
- Pagination test traverses all fixtures across multiple pages with
  no duplicates and no gaps.

---

### Phase 4: Unify `tests/api/*` against the shared fixtures

Today `tests/api/server.ts` exposes `mockGetDoc` / `mockListDocs`
helpers that wrap the orval `*MockHandler` factories with bespoke
per-test data. After Phases 1–3 we have a single fixture corpus
that's a better source of truth — migrate the integration tests to
read from it. Keep `mockProblem(...)` for explicit error-path
injection (those tests are *intentionally* off-corpus).

This phase is invasive: it touches every existing
`tests/api/*.test.ts(x)` file. Do it in one focused pass so the
diff stays reviewable.

#### Tasks

- [x] Refactor `tests/api/server.ts`:
  - Drop `mockGetDoc` / `mockListDocs`.
  - Re-export the Phase 3 `handlers` array (or wrap a
    `setupMswServer()` helper that mounts them).
  - Keep `mockProblem(status, problem?)` for error-path tests.
  - Keep `setupMswLifecycle(server)` (already shared).
- [x] Migrate `tests/api/getDoc.test.tsx`:
  - Replace `mockGetDoc(...)` with the default fixture-backed
    handler. Pick a fixture ID present in the corpus.
- [x] Migrate `tests/api/docPage.test.ts`:
  - Happy path → fixture-backed.
  - 404 / 500 paths → keep `mockProblem(404)` / `mockProblem(500)`
    with `server.use(...)` overrides.
- [x] Migrate `tests/api/docPageRender.test.tsx`:
  - Same pattern as above; assert that the rendered title /
    body / Badge match the fixture frontmatter / body / status.
- [x] Migrate `tests/api/indexRoute.test.ts`:
  - Cursor / Link-header tests now use the *real* paginated
    handler from Phase 3 — no per-test mock data.
- [x] Migrate `tests/api/indexRouteRender.test.tsx`:
  - Card grid renders cards whose IDs / titles match fixture
    frontmatter.

#### Success Criteria

- `bun run test` — 17 existing tests stay green; no test was
  silently weakened (each one still asserts something specific
  about loader behaviour or render output, not just "any payload").
- The string `mockGetDoc` / `mockListDocs` no longer appears
  anywhere under `tests/`.
- Fixture frontmatter changes propagate to test assertions
  (verify by tweaking a title in one fixture and confirming the
  matching test fails — then revert).

---

### Phase 5: Conditional MSW boot (`entry.client.tsx` + SSR setup)

This phase makes the dev server actually use the handlers. RR7
framework mode auto-generates `entry.{client,server}.tsx`. We only
override the **client** entry — the server side gets a side-effect
import in `root.tsx` that calls `server.listen()` at module load.

The flag is split: `VITE_API_MODE=msw` for `import.meta.env` (client),
`API_MODE=msw` for `process.env` (server). The `dev:msw` script sets
both. PLAN-0001 documents the split and the rationale.

`mockServiceWorker.js` is generated by `bunx msw init public/ --save`
and **committed** — MSW's worker version is baked in.

#### Tasks

- [x] `bunx msw init public/ --save` to scaffold `mockServiceWorker.js`.
  Confirm the command also writes `package.json msw.workerDirectory`
  — keep that key.
- [x] Verify `public/` is served by RR7 framework mode at the site
  root. If RR7 needs an opt-in (e.g., a `publicDir` field in
  `react-router.config.ts` or `vite.config.ts`), add it. Smoke
  via `curl http://localhost:5173/mockServiceWorker.js` once the
  dev server is up. _(Vite default `publicDir = "public"` covers it.)_
- [x] Create `src/portal/api/msw/setup.ts` — the side-effect SSR
  boot module:
  ```ts
  if (typeof window === "undefined" && process.env.API_MODE === "msw") {
    const { server } = await import("./server");
    server.listen({ onUnhandledRequest: "bypass" });
  }
  ```
  Top-level await is fine (this file is loaded server-side as ESM).
  No-op on the browser side — the worker is started in
  `entry.client.tsx` instead.

  _Implementation note (2026-04-28): the production build needs the
  branch fully DCE'd or the dynamic `import("./server")` pulls
  `msw/node` and the fixture loader into a `build/server/assets/*.js`
  chunk. Vite's `import.meta.env.SSR` (false on client) and
  `import.meta.env.DEV` (false on prod build) are both literal-replaced
  at build time — combine them with the runtime
  `process.env.API_MODE === "msw"` check to make the branch fully
  dead in any non-dev SSR build._
- [x] In `src/root.tsx`, add a side-effect import: `import "./portal/api/msw/setup";`
  near the top of the imports (above `tokens.css` is fine — the
  side effect runs at module load, before any loader does).
- [x] Create `src/entry.client.tsx`:
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
      hydrateRoot(
        document,
        <StrictMode><HydratedRouter /></StrictMode>,
      );
    });
  });
  ```
- [x] Add `process.env.API_MODE` and `import.meta.env.VITE_API_MODE`
  to the type augmentation file (`src/env.d.ts` or whatever RR7
  generates) so `tsc --noEmit` doesn't whine about unknown env vars.
- [x] Confirm dev tree-shakes MSW out when the flag is unset:
  - `just build && grep -q "msw" build/server/index.js` → no match.
  - `just build && grep -rq "msw" build/client/assets/` → no match.

#### Success Criteria

- `bun run dev:msw` boots without error; visiting
  `http://localhost:5173/` SSR-renders the directory grid populated
  from fixtures.
- `bun run dev` (no flag) still SSR-renders against `RFC_API_URL`.
- `mockServiceWorker.js` is reachable at site root; no console
  warnings about an unregistered worker.
- Production build succeeds and the artefacts contain no MSW or
  faker code (grep clean).
- `bun run typecheck`, `bun run lint`, `bun run test` exit 0.

---

### Phase 6: Operator surface (script, recipe, docs)

Make `dev:msw` discoverable. Mostly file-level edits.

#### Tasks

- [x] `package.json`: add `"dev:msw": "API_MODE=msw VITE_API_MODE=msw react-router dev"`.
- [x] `justfile`: add a `dev-msw` recipe (just doesn't accept `:`
  in recipe names; alias as `dev-msw`).
  ```just
  # Run the dev server with MSW handlers backing the API surface.
  # No rfc-api / Postgres / GitHub webhook required. See IMPL-0002.
  dev-msw:
      bun run dev:msw
  ```
- [x] `.env.example`: add `API_MODE=msw` and `VITE_API_MODE=msw`
  with a comment explaining the script sets these for you.
- [x] `README.md`: add a "Local development without rfc-api"
  section that:
  - Calls out the trade-off (fast iteration vs no contract
    verification).
  - Shows `just dev-msw` as the entry point.
  - Points at PLAN-0001 + IMPL-0002 for the why.
- [x] `CLAUDE.md`: one-line pointer in the "Tooling" section so
  future Claude sessions know about the flag.

#### Success Criteria

- `just --list` shows `dev-msw`.
- `bun run` shows `dev:msw`.
- `cat .env.example | grep API_MODE` returns both lines.
- `README.md` has a heading containing `MSW` or
  `local development without rfc-api`.

---

### Phase 7: Verification + PR-2 test plan refresh

End-to-end smoke. Replays PLAN-0001 §Verification verbatim plus the
PR #2 test plan items now that they're runnable.

#### Tasks

- [x] Run the verification block from PLAN-0001 §Verification.
  _(2026-04-28: `just dev-msw` boots cleanly, `curl /` returns 200
  with all 8 fixture cards + `ds-badge` markup, `curl /rfc/RFC-0001`
  returns 200 with the fixture title/author/body, `curl /rfc/NOPE-9999`
  returns 404 with the portal not-found surface and a 7807 `request_id`.
  `curl /mockServiceWorker.js` returns the worker script. `just build`
  artefacts contain no `msw` / `setupServer` / `setupWorker` / `faker`
  references except the static `mockServiceWorker.js` worker file.)_
- [x] Walk PR #2's previously-unchecked manual smoke items via
  `just dev-msw`:
  - `/` shows the directory grid; click a doc → renders title +
    `<Badge>` + body. _(curl-smoked above.)_
  - **Pagination works** — clicking next/prev advances cursor pages
    (now meaningful because Phase 3 implements real pagination).
    _(`tests/api/msw/handlers.test.ts` round-trips every fixture
    across pages with no duplicates or gaps.)_
  - `/rfc/NOPE-9999` (any unknown ID) → portal 404 surface.
    _(curl-smoked above.)_
  - `<ThemeToggle>` flips `data-theme`; persists to
    `localStorage["design-system:theme"]` — covered by
    `<ThemeToggle>` unit tests; unaffected by Phase 5 wiring.
- [ ] Visual A/B vs. Phase-5 commit `18ebe99` (pre-promotion) — if
  cheap (worktree on a side port). If not, eyeball against the
  design-system mockup HTML. _(Skipped — visual A/B is a manual
  step the loop can't perform; defer to PR review.)_
- [x] Refresh PR #2's body to check off the newly-runnable items.
  _(2026-04-30: PR #2 title updated to cover both IMPL-0001 +
  IMPL-0002, body rewritten to walk through the IMPL-0002 phases
  and check off the dev:msw-runnable smoke items. The live-rfc-api
  smokes and visual A/B remain unchecked — they require the live
  stack.)_
- [x] Merge `feat/api-mode-msw` → `feat/design-0001` (no-ff so the
  branch boundary stays in history). _(2026-04-30: merge commit
  `0cb9c60` on `feat/design-0001`; pushed via HTTPS once the user
  authorised it. `just check` 36/36 green on the merged tip.)_

#### Success Criteria

- Every PLAN-0001 verification curl command exits 0 and grep-matches
  expected content.
- Every previously-unchecked PR #2 manual-smoke item is now checked.
- `feat/design-0001` after merge: `just check && just build` both
  exit 0.
- PR #2 CI is green after the merge-back.

---

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `tests/examples/docs/<type>/<id>.md` (≥ 6) | Create | Fixture tree (Phase 1). |
| `tests/examples/docs/README.md` | Create | Pointer to PLAN-0001 / IMPL-0002. |
| `src/portal/api/msw/fixtures.ts` | Create | Loader (Phase 2). |
| `src/portal/api/msw/handlers.ts` | Create | MSW handlers + cursor pagination (Phase 3). |
| `src/portal/api/msw/browser.ts` | Create | `setupWorker` wrapper (Phase 3). |
| `src/portal/api/msw/server.ts` | Create | `setupServer` wrapper (Phase 3). |
| `src/portal/api/msw/setup.ts` | Create | Side-effect SSR boot — imported by `root.tsx` (Phase 5). |
| `tests/api/msw/fixtures.test.ts` | Create | Loader unit tests (Phase 2). |
| `tests/api/msw/handlers.test.ts` | Create | Handler integration tests incl. pagination round-trip (Phase 3). |
| `tests/api/server.ts` | Modify | Drop `mockGetDoc` / `mockListDocs`; re-export Phase 3 `handlers`; keep `mockProblem` (Phase 4). |
| `tests/api/getDoc.test.tsx` | Modify | Use fixture-backed handler (Phase 4). |
| `tests/api/docPage.test.ts` | Modify | Happy path → fixtures; error paths keep `mockProblem` (Phase 4). |
| `tests/api/docPageRender.test.tsx` | Modify | Assert against fixture frontmatter / body (Phase 4). |
| `tests/api/indexRoute.test.ts` | Modify | Real paginated handler — no per-test mock data (Phase 4). |
| `tests/api/indexRouteRender.test.tsx` | Modify | Card grid asserts against fixtures (Phase 4). |
| `src/entry.client.tsx` | Create | RR7 client entry override (Phase 5). |
| `src/root.tsx` | Modify | Side-effect import of `./portal/api/msw/setup` (Phase 5). |
| `public/mockServiceWorker.js` | Create | MSW worker scaffold via `bunx msw init` (Phase 5). |
| `package.json` | Modify | Add `"dev:msw"` script; add `yaml` to deps; possibly `msw.workerDirectory` from `bunx msw init`. |
| `react-router.config.ts` | Modify (maybe) | If `publicDir` opt-in needed for `mockServiceWorker.js` (verify Phase 5). |
| `src/env.d.ts` | Create / Modify | Augment env vars for typecheck (Phase 5). |
| `justfile` | Modify | Add `dev-msw` recipe (Phase 6). |
| `.env.example` | Modify | Document `API_MODE` / `VITE_API_MODE` (Phase 6). |
| `README.md` | Modify | "Local development without rfc-api" section (Phase 6). |
| `CLAUDE.md` | Modify | One-line pointer (Phase 6). |
| PR #2 body | Modify | Test-plan refresh (Phase 7). |

**Files explicitly NOT changed:**

- `src/entry.server.tsx` — we deliberately do not override this
  (Resolved Q6). The SSR boot is a side-effect import in
  `root.tsx`.
- `orval.config.ts` — `mock: true` stays on; we still consume the
  `*MockHandler` factories (Resolved Q7).

## Testing Plan

- **Phase 1** (data-only): `just check && just build` still exit 0.
- **Phase 2** (loader): unit test in `tests/api/msw/fixtures.test.ts`
  asserting load count, by-id lookup, by-type bucket, cache.
- **Phase 3** (handlers): integration test in
  `tests/api/msw/handlers.test.ts` spinning `setupServer(...handlers)`
  and asserting each URL returns the correct fixture / 7807 envelope.
  Includes a pagination round-trip test that follows
  `Link: rel="next"` cursors to traverse the full corpus without
  duplicates or gaps.
- **Phase 4** (test migration): the existing 17-test suite stays
  green after migration; `mockGetDoc` / `mockListDocs` are gone.
  Spot-check by tweaking a fixture title and confirming a test
  fails before reverting.
- **Phase 5** (wiring): manual `bun run dev:msw` smoke + grep
  assertion that prod bundle is MSW-clean.
- **Phase 6** (docs): smoke that `just --list` and `bun run` show
  the new entry points.
- **Phase 7** (e2e): walk every check from PLAN-0001 §Verification
  and PR #2's manual items.

The new tests live under `tests/api/msw/` so they're co-located
with the existing `tests/api/` integration tests but visibly
separated from the loader/handler-style tests in the parent dir.

## Dependencies

- **Hard:**
  - `msw@^2.13.6` (already in `devDependencies` — stays there per
    Resolved Q1).
  - `@faker-js/faker@^10.4.0` (already in `devDependencies` — stays
    there per Resolved Q1).
  - `yaml` (new — adding to `dependencies` per Resolved Q3).
  - `bunx msw init public/ --save` — one-time scaffold of
    `mockServiceWorker.js`.
- **Soft / blocking:**
  - PLAN-0001 (committed on `feat/design-0001` as `7511824`).
- **Independent of:**
  - rfc-api / Postgres / GitHub webhook — explicit non-dependency
    (the whole point).
  - DESIGN-0002 (Markdown rendering pipeline) — fixtures will exercise
    it once it lands, but this IMPL doesn't block on it.

## Resolved

Each was an Open Question on the first draft of this IMPL; resolved
on review per the "make it work correctly now" framing —
hand-rolled / now-only options were rejected in favour of the more
durable correct options.

- ~~**Q1 — Where do `msw` + `@faker-js/faker` live?**~~
  **Stay in `devDependencies`.** They're tree-shaken from the
  production build by the `MODE === "development"` early-return
  gate, and `devDependencies` is the semantically correct category
  for dev-only tooling. The original PLAN-0001 instinct (move to
  `dependencies`) was an over-correction. No reason to ship MSW
  / faker code paths to anyone running `bun install --production`.
- ~~**Q2 — Pagination semantics for the listDocs handler.**~~
  **Implement real RFC 5988 pagination with opaque cursor strings.**
  Why: dev mode exercising the same code path as the live API
  catches `Link`-header parser regressions in dev — not just CI —
  and means clicking next/prev in `dev:msw` actually advances. The
  ~30 lines of cursor-handling code we write now is paid back the
  first time pagination breaks.
- ~~**Q3 — Frontmatter YAML parser.**~~
  **`yaml` package, added to `dependencies`.** Modern, MIT,
  well-maintained, full YAML 1.2. Hand-rolled parsers are the
  exact "make it work now" anti-pattern this framing rejected.
- ~~**Q4 — Fixture-share between `tests/api/*` and MSW handlers?**~~
  **Unify around the shared fixture tree (Phase 4).** The bespoke
  `mockGetDoc` / `mockListDocs` helpers were a pre-fixture-corpus
  workaround. With Phases 1–3 done, one source of doc truth is
  the correct shape. Targeted error-path overrides
  (`mockProblem(404)` etc.) stay — those tests are intentionally
  off-corpus and should remain that way.
- ~~**Q5 — `mockServiceWorker.js` location for RR7.**~~
  **Verify during Phase 5; not a design choice.** `public/` is the
  canonical MSW location and RR7 framework mode + Vite serves
  `public/*` at site root by default. If a `publicDir` opt-in is
  required, the Phase 5 task captures that.
- ~~**Q6 — `entry.server.tsx` streaming entry vs thinner approach?**~~
  **No `entry.server.tsx` override — use a side-effect SSR boot
  module imported by `src/root.tsx`.** Avoids owning ~30 lines of
  RR7 boilerplate that drifts when RR7 updates. `setupServer.listen()`
  patches Node's global `fetch` interceptors at module load, so any
  later `fetch` call from any loader is intercepted — no need to
  intercept earlier in the SSR pipeline.
- ~~**Q7 — Trim unused orval `*ResponseMock` factories?**~~
  **Leave as-is.** They're regenerated artefacts; trimming would
  require disabling `mock: true` in `orval.config.ts`, which would
  also kill the `*MockHandler` factories Phase 3 depends on.

## Open Questions

-

## References

- [PLAN-0001 — Add API_MODE=msw local dev mode for rfc-site](../plan/0001-add-apimodemsw-local-dev-mode-for-rfc-site.md) — the parent plan.
- [IMPL-0001 §Phase 3 — Open Question resolution](0001-bootstrap-portal-scaffold-per-design-0001.md#phase-3) — the escape-hatch this IMPL exercises.
- [DESIGN-0001 — Portal architecture and ds-candidates promotion model](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md) — the portal/api boundary the MSW layer slots into.
- [ADR-0002 — Adopt portal frontend stack](../adr/0002-adopt-portal-frontend-stack.md) — RR7 + Vite + Bun stack assumptions.
- [Integration reference §Local development](../integration/rfc-api-reference.md#local-development) — the alternative "live rfc-api" path that `dev:msw` complements.
- [`api/openapi.yaml`](../../api/openapi.yaml) — the contract `Document` / `DocumentType` come from.
- [`src/portal/api/__generated__/docs/docs.msw.ts`](../../src/portal/api/__generated__/docs/docs.msw.ts) — the orval-emitted handler factories Phase 3 wraps. *(Generated; gitignored — regenerate via `just gen-api`.)*
- [`src/portal/api/pagination.ts`](../../src/portal/api/pagination.ts) — the consumer-side `Link` header parser Phase 3 has to interop with.
- [MSW docs — Browser integration](https://mswjs.io/docs/integrations/browser).
- [MSW docs — Node.js integration](https://mswjs.io/docs/integrations/node).
- [Vite docs — `import.meta.glob`](https://vite.dev/guide/features#glob-import).
- [RFC 5988 — Web Linking](https://datatracker.ietf.org/doc/html/rfc5988).
- [Oxide `rfd-site`](https://github.com/oxidecomputer/rfd-site) — precedent for MSW-backed dev mode.
