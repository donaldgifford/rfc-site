---
id: IMPL-0001
title: "Bootstrap portal scaffold per DESIGN-0001"
status: Draft
author: Donald Gifford
created: 2026-04-27
---
<!-- markdownlint-disable-file MD025 MD041 -->

# IMPL 0001: Bootstrap portal scaffold per DESIGN-0001

**Status:** Draft
**Author:** Donald Gifford
**Date:** 2026-04-27

<!--toc:start-->
- [Objective](#objective)
- [Scope](#scope)
  - [In Scope](#in-scope)
  - [Out of Scope](#out-of-scope)
- [Implementation Phases](#implementation-phases)
  - [Phase 1: Tooling baseline](#phase-1-tooling-baseline)
    - [Tasks](#tasks)
    - [Success Criteria](#success-criteria)
  - [Phase 2: Framework scaffold + design-system wired](#phase-2-framework-scaffold--design-system-wired)
    - [Tasks](#tasks-1)
    - [Success Criteria](#success-criteria-1)
  - [Phase 3: API integration scaffold](#phase-3-api-integration-scaffold)
    - [Tasks](#tasks-2)
    - [Success Criteria](#success-criteria-2)
  - [Phase 4: First page renders against rfc-api](#phase-4-first-page-renders-against-rfc-api)
    - [Tasks](#tasks-3)
    - [Success Criteria](#success-criteria-3)
  - [Phase 5: First ds-candidate](#phase-5-first-ds-candidate)
    - [Tasks](#tasks-4)
    - [Success Criteria](#success-criteria-4)
  - [Phase 6: First promotion](#phase-6-first-promotion)
    - [Tasks (in donaldgifford/design-system)](#tasks-in-donaldgifforddesign-system)
    - [Tasks (in this repo, rfc-site)](#tasks-in-this-repo-rfc-site)
    - [Success Criteria](#success-criteria-5)
- [Open Questions](#open-questions)
  - [Phase 1](#phase-1)
  - [Phase 2](#phase-2)
  - [Phase 3](#phase-3)
  - [Phase 4](#phase-4)
  - [Phase 5](#phase-5)
  - [Phase 6](#phase-6)
  - [Cross-cutting](#cross-cutting)
- [File Changes](#file-changes)
- [Testing Plan](#testing-plan)
- [Dependencies](#dependencies)
- [References](#references)
<!--toc:end-->

## Objective

Stand up the `rfc-site` portal from greenfield to "first real RFC page rendered against `rfc-api` with a promoted primitive." Each phase translates a single bullet from [DESIGN-0001 §Migration / Rollout Plan](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md#migration--rollout-plan) into a concrete, checkable task list with explicit success criteria.

**Implements:** [DESIGN-0001](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md), with cross-references to [ADR-0001](../adr/0001-consume-rfc-api-via-its-published-openapi-contract.md), [ADR-0002](../adr/0002-adopt-portal-frontend-stack.md), and [DESIGN-0002](../design/0002-markdown-rendering-pipeline.md) where their decisions feed implementation steps.

## Scope

### In Scope

- Tooling reconciliation (`mise.toml`, `package.json`, TypeScript, ESLint v9, Prettier, vitest).
- React 19 + React Router v7 + Vite + Bun toolchain stand-up.
- GitHub Packages auth and design-system install + token / theme wiring.
- OpenAPI client generation via `orval` against the vendored `api/openapi.yaml`.
- TanStack Query provider setup.
- One real page rendering a `Document` from `rfc-api` (raw body for now — full Markdown rendering is DESIGN-0002 territory).
- One `ds-candidate` extracted, used in 2+ places, and promoted into `@donaldgifford/design-system`.

### Out of Scope

- Full Markdown rendering pipeline (DESIGN-0002 IMPL — separate doc).
- Search UI (rfc-api `/api/v1/search` integration beyond a smoke test).
- Authentication (rfc-api Phase 4 OIDC — out of scope here).
- Production deployment (Helm chart, container build, ingress).
- The vendoring sync mechanism for `api/openapi.yaml` (ADR-0001 deferred decision; resolve when manual sync becomes painful).
- Caching strategy (per-pod / Redis / HTTP) — rfc-api RFC-0002 open question.

## Implementation Phases

Each phase builds on the previous. A phase is complete when all tasks are checked and the success criteria are met. Phases 1–3 are setup; Phase 4 is the first usable feature; Phases 5–6 validate the promotion model.

---

### Phase 1: Tooling baseline

Reconcile `mise.toml` with the build guide's runtime commitment and stand up a TypeScript / vitest / ESLint / Prettier baseline mirroring the design-system repo, so the project compiles and lints with no source code yet. This phase produces no runnable app — just a working toolchain.

#### Tasks

- [x] Add `bun = "latest"` to `mise.toml`; remove `pnpm = "10.33.2"`. Decide whether to keep `node = "22"` for tool compat (see Open Questions). *(node kept; bun 1.3.11 resolved by `latest`.)*
- [x] `mise install`; verify `bun --version`, `mise current`. *(bun 1.3.11, node 22.22.2.)*
- [ ] Initialize `package.json`: `bun init -y`, then trim to `{ name, version, type: "module", scripts, devDependencies }`. Set `"type": "module"`.
- [ ] Add `tsconfig.json` mirroring [`donaldgifford/design-system`](https://github.com/donaldgifford/design-system/blob/main/tsconfig.json): `strict: true`, `target: ES2022`, `moduleResolution: bundler`, `jsx: react-jsx`, `lib: ["ES2022", "DOM", "DOM.Iterable"]`, plus paths/aliases as needed.
- [ ] Add ESLint v9 flat config (`eslint.config.js`) mirroring the design-system repo's ruleset (typescript-eslint, react, react-hooks, jsx-a11y).
- [ ] Add `.prettierrc.json` with `{ printWidth: 100, semi: true, singleQuote: false, trailingComma: "all" }`.
- [ ] Add `.prettierignore` (at minimum: `dist`, `coverage`, `node_modules`, `**/__generated__`).
- [ ] Add `vitest.config.ts` with jsdom environment + `@testing-library/react` setup.
- [ ] Add a single trivial smoke test (`tests/smoke.test.ts`: `expect(1).toBe(1)`) so vitest has something to find. (Will be removed once real tests exist.)
- [ ] Add `package.json` scripts: `dev`, `build`, `start`, `lint`, `lint:fix`, `format`, `format:check`, `typecheck`, `test`, `test:watch`. Some will be no-ops or stubs until later phases fill them in.
- [ ] Update `.gitignore` for `dist/`, `coverage/`, `*.tsbuildinfo` (already covered) and `src/portal/api/__generated__/` (Phase 3 prep).
- [ ] Commit: "phase 1: tooling baseline".

#### Success Criteria

- `mise install` exits 0; `bun --version` prints a version.
- `bun install` exits 0 with empty/dev-only deps.
- `bun run typecheck` exits 0.
- `bun run lint` exits 0.
- `bun run format:check` exits 0.
- `bun run test` exits 0 with the smoke test passing.
- `cat .gitignore` shows the new entries.
- The repo can be cloned fresh and the above commands all succeed in order.

---

### Phase 2: Framework scaffold + design-system wired

Stand up the runnable React Router v7 + Vite + React 19 SSR app skeleton with GitHub Packages auth and the design system installed and wired (tokens.css imported once at the entry, `useTheme` hook in use). At end of phase: `bun run dev` opens a placeholder page styled with design-system tokens, with a working dark↔light toggle.

#### Tasks

- [ ] Add `bunfig.toml` with the `[install.scopes]` block for `@donaldgifford` per [archived build guide §2](../archive/0001-rfc-site-build-guide.md). Do **not** also add `.npmrc` (resolved in DESIGN-0001).
- [ ] Document `NPM_TOKEN` requirement and shell-export instructions in a top-level `README.md` section. Note that CI under the same GitHub owner can use `secrets.GITHUB_TOKEN`.
- [ ] `bun add react@^19 react-dom@^19`.
- [ ] `bun add react-router @react-router/node @react-router/serve @react-router/fs-routes`.
- [ ] `bun add -d @react-router/dev vite @vitejs/plugin-react`.
- [ ] Create `vite.config.ts` with `@react-router/dev/vite` plugin.
- [ ] Create `react-router.config.ts` with `ssr: true` and the Vite plugin's defaults. (Decide on framework mode vs library mode — see Open Questions.)
- [ ] Create the directory layout per DESIGN-0001:
  - `src/main.tsx` (or RR7's equivalent entry)
  - `src/components/ds-candidates/` with a `README.md` pointing at DESIGN-0001 §The `ds-candidates/` contract
  - `src/components/portal/` with a `README.md` summarizing what belongs there
  - `src/pages/` (empty for now)
  - `src/routes/` (RR7 file-system routes; create `_index.tsx` placeholder)
  - `src/styles/` (empty; reserve for portal-local CSS only — never tokens)
- [ ] `bun add @donaldgifford/design-system@0.1.0` (no caret per [archived build guide §3](../archive/0001-rfc-site-build-guide.md)).
- [ ] `import "@donaldgifford/design-system/tokens.css";` at the top of the app entry — exactly once.
- [ ] Set `<html data-theme="dark">` in `index.html` per [DESIGN-0001 §Resolved](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md#resolved-during-initial-review).
- [ ] Build a `<ThemeToggle>` component in `src/components/portal/` that uses `useTheme` from `@donaldgifford/design-system/theme`. Render it on the placeholder index route.
- [ ] Implement a placeholder index route (`src/routes/_index.tsx`) that renders an `<h1>` with a tokens-backed heading style, the theme toggle, and some token-styled content (e.g., a card with `var(--color-bg-raised)`).
- [ ] Confirm the `Anti-patterns` section of DESIGN-0001 is respected: no Tailwind, no CSS-in-JS runtime, no `style={}` for non-dynamic values, no manual `data-theme` mutation outside `useTheme`.
- [ ] Commit: "phase 2: framework scaffold + design-system wired".

#### Success Criteria

- `bun install` succeeds with `@donaldgifford/design-system@0.1.0` resolved from GitHub Packages (verify in `bun.lock` / `package-lock.json`).
- `bun run dev` starts the Vite dev server with no errors or warnings.
- The placeholder page renders at `localhost:<port>`. `body` background uses a design-system token color (visible diff vs unstyled HTML).
- View source confirms `<html data-theme="dark">` set on first paint.
- `<ThemeToggle>` flips the page between light and dark; `localStorage["design-system:theme"]` reflects the choice; refreshing preserves it.
- `bun run build` produces a `dist/` (or RR7-equivalent) without errors.
- `bun run start` (production server) serves the same page.
- `bun run typecheck`, `bun run lint`, `bun run test` all still exit 0.
- No `any` types in non-generated code (lint enforced).

---

### Phase 3: API integration scaffold

Wire up the OpenAPI-driven client (`orval`) and TanStack Query so SSR routes can call rfc-api with full type safety. At end of phase: a typed hook fetches a `Document` (against a local rfc-api or MSW handlers) and the result is correctly typed end-to-end.

#### Tasks

- [ ] `bun add -d orval`.
- [ ] `bun add @tanstack/react-query`.
- [ ] Decide HTTP transport (`fetch` vs `axios`) — see Open Questions.
- [ ] Create `orval.config.ts` pointing at `api/openapi.yaml`, output dir `src/portal/api/__generated__/`, mode `react-query`, target HTTP transport per the decision above.
- [ ] Add `bun run gen-api` script that runs `orval`.
- [ ] Run `gen-api`; commit the config but **not** the generated output (per [ADR-0001](../adr/0001-consume-rfc-api-via-its-published-openapi-contract.md)).
- [ ] Verify the generated dir is in `.gitignore`.
- [ ] Configure ESLint and Prettier to ignore `src/portal/api/__generated__/`.
- [ ] Add a CI step (or pre-commit / pre-push hook) that re-runs `gen-api` and fails if the working tree has any diff in the generated dir — this is the contract-drift check from ADR-0001.
- [ ] Add `RFC_API_URL` env-var reading in a small `src/portal/api/config.ts` module. Default to `http://localhost:8080` for dev. Provide `.env.example` documenting it.
- [ ] Wrap the app in `<QueryClientProvider client={queryClient}>` in the entry / root route.
- [ ] Configure the orval-generated client to use `RFC_API_URL` as the base URL.
- [ ] Decide on a dev-mode mock strategy (orval's MSW handlers? Live rfc-api dependency?) — see Open Questions.
- [ ] Add an MSW + vitest smoke test that calls one generated hook and asserts the payload type.
- [ ] Commit: "phase 3: api integration scaffold (orval + tanstack query)".

#### Success Criteria

- `bun run gen-api` produces types and TanStack Query hooks for every endpoint in `api/openapi.yaml`. (`getDoc`, `listDocs`, `searchDocs`, etc.)
- `bun run typecheck` passes against the generated code.
- The smoke test (Phase 1's `tests/smoke.test.ts`) is replaced or supplemented by a generated-hook test that mounts a `<QueryClientProvider>` and calls a generated query hook against an MSW mock.
- `bun run lint` ignores `__generated__/`; `bun run format:check` ignores it too.
- The CI drift check runs locally and fails if you hand-edit a generated file.
- `RFC_API_URL` is read at runtime and falls back cleanly.

---

### Phase 4: First page renders against rfc-api

Wire one real route in the portal that fetches a `Document` from rfc-api and renders it. Markdown body is rendered as a `<pre>` block in this phase — proper rendering is DESIGN-0002 IMPL territory and tracked separately.

#### Tasks

- [ ] Stand up a local rfc-api per the [integration reference](../integration/rfc-api-reference.md#local-development) (`mise install`, `make compose-up`, `go run ./cmd/rfc-api serve`). Seed at least one document.
- [ ] Add an RR7 file-system route at `src/routes/$type.$id.tsx` (per RR7 conventions for params).
- [ ] In the route loader / component, call the orval-generated `getDoc` hook (or use a route loader for SSR-critical data) to fetch the document.
- [ ] Render `Document.title` as an `<h1>`, `Document.status` as a status pill (inline portal styling for now — extracted to a `<Badge>` candidate in Phase 5), `Document.body` inside a `<pre>` block. Include `Document.created_at` and `Document.updated_at` as a small dateline. Visual reference: [mockup §"02 · RFC Page"](https://github.com/donaldgifford/design-system/blob/main/rfc-portal-mockup_15.html).
- [ ] Handle the `application/problem+json` (RFC 7807) error envelope per the [integration reference §Error contract](../integration/rfc-api-reference.md#error-contract). At minimum: route an `ErrNotFound` to a portal 404 page; route everything else to a generic error page that surfaces the `request_id`.
- [ ] Handle loading state with a skeleton shape that won't shift layout when content arrives.
- [ ] Add an index route at `/` showing the cross-type list (`/api/v1/docs`) — **rendered as a card grid mirroring the "01 · Directory" view** in the [HTML mockup](https://github.com/donaldgifford/design-system/blob/main/rfc-portal-mockup_15.html) — paginated via the `Link` header per the integration reference.
- [ ] Each card links to `/$type/$id`. Card surfaces: display id, title, status pill, authors, date.
- [ ] Smoke-test in the browser: visit `/`, click a doc, see the doc page; visit `/rfc/9999`, see the 404 page.
- [ ] Commit: "phase 4: first doc page renders against rfc-api".

#### Success Criteria

- With local rfc-api running, `bun run dev` shows real document data at `/$type/$id` (e.g., `/rfc/1`).
- The cross-type list at `/` shows ≥1 doc and pagination works (clicking next/prev advances via the rfc-api `Link` header cursor).
- A 404 from rfc-api renders a portal 404 page (not a stack trace) and surfaces `request_id`.
- A 500 from rfc-api renders a generic error page that surfaces `request_id`.
- Network panel shows requests hitting `RFC_API_URL`.
- No console errors or warnings on the happy path.
- `bun run typecheck`, `bun run lint`, `bun run test` all still pass.
- The page renders the same markup with JS disabled (validates SSR — RR7 should handle this by default).

---

### Phase 5: First ds-candidate

Extract one primitive from the Phase 4 pages into `ds-candidates/`, shaped per DESIGN-0001's contract, used in 2+ places to satisfy the readiness checklist.

#### Tasks

- [ ] First candidate is **`<Badge>`** for `Document.status` pills (used in both the directory cards and the RFC-page header per the mockup; see Open Questions §Phase 5). Props shape: `status: "Draft" | "Proposed" | "Accepted" | "Rejected" | "Superseded" | "Abandoned"` (string union from `api/openapi.yaml` `DocumentType.statuses`), plus the standard `forwardRef` + native `<span>` prop pass-through.
- [ ] Implement under `src/components/ds-candidates/<Component>/` per the contract:
  - `<Component>.tsx` with `forwardRef`, named export, native DOM prop pass-through, string-union variant/size/status props.
  - `<Component>.module.css` co-located, references `var(--*)` design-system tokens only — never hard-coded colors / spacings.
  - `index.ts` re-exporting the named component and its prop types.
  - `<Component>.test.tsx` colocated (per [DESIGN-0001 §Resolved](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md#resolved-during-initial-review)). Cover render, ref forwarding, className merge, prop pass-through.
- [ ] Replace the inline / portal-styled usages from Phase 4 with the new candidate. Confirm ≥2 use sites.
- [ ] Confirm the candidate imports nothing from `portal/`, `pages/`, `routes/`, or app state — and no API client / TanStack Query / orval imports.
- [ ] Validate visually: pages render identically before and after the swap (or strictly better — no regressions).
- [ ] Run lint, typecheck, test, build — all green.
- [ ] Document the readiness state of the candidate (used in 2+ places ✓; API stable ✓; no portal deps ✓) in a comment block at the top of `<Component>.tsx` or in `index.ts`.
- [ ] Commit: "phase 5: first ds-candidate (`<Component>`)".

#### Success Criteria

- The candidate exists at `src/components/ds-candidates/<Component>/` with the four files (`.tsx`, `.module.css`, `index.ts`, `.test.tsx`).
- The candidate is used in ≥2 places in the portal.
- Visual rendering is identical to (or strictly improved over) the pre-extraction Phase 4 page.
- `bun run test` includes ≥1 test from the new candidate, all passing.
- `bun run lint` reports no violations against the candidate.
- The candidate has zero imports from `portal/`, `pages/`, `routes/`, or app state (grep-validated).
- The candidate uses only `var(--*)` tokens for color / spacing / typography — no hard-coded values (grep-validated).

---

### Phase 6: First promotion

Promote the Phase 5 candidate into `@donaldgifford/design-system`. This phase spans two repos.

#### Tasks (in `donaldgifford/design-system`)

- [ ] Branch off `main`: `git switch -c feat/promote-<component>`.
- [ ] `cp -r` the candidate folder from this repo into `src/primitives/<Component>/` (excluding the `.test.tsx`).
- [ ] `git mv` (or copy + delete) the test file from this repo's `ds-candidates/<Component>/<Component>.test.tsx` into `tests/primitives/<Component>.test.tsx`. Adjust the import path inside the test if needed.
- [ ] Update `src/index.ts` to re-export the primitive and its prop types.
- [ ] Run `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` — all green.
- [ ] Add a changeset (`pnpm changeset` → minor for new primitive, with a one-line description).
- [ ] Open PR; merge.
- [ ] Wait for the release workflow's "Version Packages" PR; merge that too.
- [ ] Confirm `@donaldgifford/design-system@0.x.0` is published to GitHub Packages.

#### Tasks (in this repo, `rfc-site`)

- [ ] `bun update @donaldgifford/design-system` to the new published version.
- [ ] Replace the imports of `<Component>` from `src/components/ds-candidates/<Component>` with imports from `@donaldgifford/design-system`.
- [ ] Delete `src/components/ds-candidates/<Component>/` (component, css, index, test).
- [ ] Run `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build` — all green.
- [ ] Visual verification in dev: pages render identically before/after the swap.
- [ ] Commit: "phase 6: promote `<Component>` to design-system".

#### Success Criteria

- A `0.x.0` version of `@donaldgifford/design-system` is published to GitHub Packages and shows the new primitive in `dist/`.
- This repo no longer contains `src/components/ds-candidates/<Component>/`.
- All import sites for `<Component>` resolve to `@donaldgifford/design-system`.
- Pages render identically before and after the swap (visual diff or screenshot test if available; manual smoke check otherwise).
- `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build` all exit 0 after the swap.
- The promotion workflow is documented enough (in this IMPL or a follow-up doc) that the second promotion is mechanical.

---

## Open Questions

All resolved during initial review. Recorded here with the rationale so the resolutions are traceable.

### Phase 1

- ~~**Keep `node = "22"` in `mise.toml`?**~~ **Yes, keep `node = 22`.** Some tools (eslint plugins, vitest, etc.) historically expect `node` on PATH. Cost of keeping it is low; drop it later once every tool is confirmed to run natively under Bun.
- ~~**`tsconfig.json` — copy verbatim from design-system or adapt?**~~ **Mirror the strictness flags + `lib` exactly; adapt the build/emit settings to RR7's expectations.** Concretely: copy `strict`, `noUncheckedIndexedAccess`, `lib`, `target`, `moduleResolution`, etc. from design-system; replace its library-shaped `declaration: true` / `outDir` settings with RR7's app-shaped ones.
- ~~**ESLint config — drop any primitive-specific rules?**~~ **Yes, drop primitive-only rules; keep the typescript-eslint / react / react-hooks / jsx-a11y core.** During Phase 1, inspect `donaldgifford/design-system/eslint.config.js`, copy the core ruleset, and drop rules whose only purpose is enforcing primitive conventions (e.g., `import/no-default-export` if the design-system uses it for primitive enforcement) — those don't apply to portal-local code.
- ~~**Phase 1 smoke test — keep or delete?**~~ **Delete-and-replace at Phase 3** when the first generated-hook tests come in. Smoke test exists only to validate the vitest config.

### Phase 2

- ~~**RR7 framework or library mode?**~~ **Framework mode.** Matches Oxide's `rfd-site`; minimizes the surface we own.
- ~~**App shell location?**~~ **Route layout at `src/routes/_layout.tsx`** for chrome that wraps multiple pages (idiomatic for RR7 nested layouts). `src/components/portal/` stays reserved for re-usable portal sub-components consumed by routes/pages.
- ~~**Route naming convention?**~~ **Pin to React Router v7.x latest at scaffold time** and document the chosen convention in `src/routes/README.md` so future contributors don't have to derive it.

### Phase 3

- ~~**orval HTTP transport — `fetch` or `axios`?**~~ **`fetch`.** Zero deps, matches the modern web platform; TanStack Query provides the retry/dedup that `axios` interceptors are usually used for. Reconsider only if we hit a real `fetch` limitation.
- ~~**Dev-mode mock strategy?**~~ **Require local rfc-api running for `bun run dev`** for v1. Revisit (e.g., add an `API_MODE=msw` mode à la Oxide's `console`) only if frontend-side iteration becomes hampered.
- ~~**Drift-check mechanism?**~~ **Re-run `bun run gen-api` in CI and `git diff --exit-code` the generated dir.** Simplest, no committed generated code, exact-match check. orval output is deterministic; if we hit non-determinism, switch strategy.
- ~~**TanStack Query default options?**~~ **`staleTime: 5 * 60 * 1000` (5 min), `refetchOnWindowFocus: false`, `retry: 1`.** Sensible v1 defaults for a docs portal where content changes slowly; revisit per-query as needed.

### Phase 4

- ~~**Markdown rendering placeholder OK?**~~ **Yes — render `Document.body` inside `<pre>` for Phase 4.** Full rendering is DESIGN-0002 IMPL territory, tracked separately. Keeps each IMPL focused.
- ~~**Index route layout — list, table, or card grid?**~~ **Card grid mirroring the mockup's "01 · Directory" view** ([`donaldgifford/design-system/rfc-portal-mockup_15.html`](https://github.com/donaldgifford/design-system/blob/main/rfc-portal-mockup_15.html)). The mockup is the reference for visual structure across Phases 4–5.
- ~~**404 / 500 page design — portal-local or candidates?**~~ **Portal-local.** Promote later only if the same shape is reused beyond error states.
- ~~**Loading skeleton shape — promote to `<Skeleton>` candidate?**~~ **Inline skeletons in Phase 4; promote `<Skeleton>` only if 2+ shapes converge on the same primitive.** Don't manufacture promotability.

### Phase 5

- ~~**Which candidate first?**~~ **`<Badge>` for `Document.status` pills.** The mockup has status pills in *both* the directory rows (`pc-status` class) and the RFC-page header — that's the clearest 2+ usage. Status palette in the mockup matches DocumentType statuses from `api/openapi.yaml` (Draft / Proposed / Accepted / Rejected / Superseded / Abandoned), which gives the candidate's `status` prop a closed string-union.
- ~~**Test colocation + vitest discovery?**~~ **Confirmed during Phase 1.** vitest's default `include` pattern (`**/*.{test,spec}.?(c|m)[jt]s?(x)`) picks up colocated `Component.test.tsx` automatically. No config change needed.
- ~~**Visual regression testing?**~~ **Defer** until after Phase 6. First promotion is small enough to verify by eye + screenshot. Reconsider after the second promotion if visual diffs become a real concern.

### Phase 6

- ~~**Strict 2-week stability rule for the *first* promotion?**~~ **Relax for the first promotion.** Greenfield + one consumer = essentially zero churn risk. Honor strictly from the second promotion onwards.
- ~~**Phase 6 in this IMPL or split into IMPL-0002 in design-system?**~~ **Keep here.** Splitting adds overhead without clarity. The design-system-side tasks fit on a one-page checklist; this IMPL is a single thread end-to-end.
- ~~**Visual verification — manual or screenshot-diff?**~~ **Manual eyeball + a screenshot for the PR description** for the first promotion. Per Phase 5 resolution.

### Cross-cutting

- ~~**CI provider + pipeline shape?**~~ **GitHub Actions, partial in Phase 1, expanded each phase.** Phase 1 lands lint + typecheck + test workflow; Phase 3 adds the orval drift check; Phase 4 adds a build smoke check.
- ~~**README.md expansion?**~~ **Expand after Phase 2** so it can document `NPM_TOKEN`, `bun run dev`, and the local rfc-api dependency for Phase 4.
- ~~**Storybook?**~~ **Defer for v1.** Useful for primitive development but not necessary while we're consuming primitives from the design-system package and only authoring a few candidates here.
- ~~**stylelint?**~~ **Mirror the design-system's answer during Phase 1.** If they don't run it, we don't either; if they do, copy the config.

## File Changes

| File | Action | Phase | Description |
|------|--------|-------|-------------|
| `mise.toml` | Modify | 1 | Add `bun`; remove `pnpm`; possibly drop `node`. |
| `package.json` | Create | 1 | `name`, `version`, `type: module`, `scripts`, `devDependencies`. |
| `tsconfig.json` | Create | 1 | TS strict, ES2022, bundler resolution; mirror design-system. |
| `eslint.config.js` | Create | 1 | ESLint v9 flat config; mirror design-system. |
| `.prettierrc.json` | Create | 1 | 100-col, semi, double quotes, trailing commas. |
| `.prettierignore` | Create | 1 | Ignore `dist`, `coverage`, `node_modules`, `__generated__`. |
| `vitest.config.ts` | Create | 1 | jsdom env + `@testing-library/react` setup. |
| `tests/smoke.test.ts` | Create | 1 | Trivial smoke test; deleted in Phase 3. |
| `.gitignore` | Modify | 1, 3 | Add `__generated__/` (Phase 3); already covers `dist/`, `coverage/`. |
| `bunfig.toml` | Create | 2 | GitHub Packages auth for `@donaldgifford` scope. |
| `README.md` | Modify | 2 | Document `NPM_TOKEN` requirement; basic dev instructions. |
| `vite.config.ts` | Create | 2 | RR7 + React 19 + Vite. |
| `react-router.config.ts` | Create | 2 | RR7 framework-mode config. |
| `index.html` | Create | 2 | Sets `<html data-theme="dark">`. |
| `src/main.tsx` (or RR7 entry) | Create | 2 | Imports `tokens.css` once; mounts the app. |
| `src/components/{ds-candidates,portal}/README.md` | Create | 2 | Pointer at DESIGN-0001 §contract. |
| `src/components/portal/ThemeToggle/` | Create | 2 | Uses `useTheme`. |
| `src/routes/_index.tsx` | Create | 2 | Placeholder, replaced in Phase 4. |
| `src/routes/_layout.tsx` | Create | 2 | App shell (header, theme toggle). |
| `orval.config.ts` | Create | 3 | Points at `api/openapi.yaml`; output to `__generated__/`. |
| `src/portal/api/__generated__/` | Create (gitignored) | 3 | orval output. |
| `src/portal/api/config.ts` | Create | 3 | `RFC_API_URL` env handling. |
| `.env.example` | Create | 3 | `RFC_API_URL=http://localhost:8080`. |
| `src/portal/api/queryClient.ts` | Create | 3 | TanStack Query client + provider setup. |
| `src/routes/$type.$id.tsx` | Create | 4 | Per-document page. |
| `src/routes/_index.tsx` | Modify | 4 | Cross-type list. |
| `src/routes/404.tsx` (or equivalent) | Create | 4 | RFC 7807 → portal 404. |
| `src/routes/error.tsx` (or equivalent) | Create | 4 | Generic error surface; shows `request_id`. |
| `src/components/ds-candidates/<Component>/` | Create | 5 | First candidate. |
| `src/components/ds-candidates/<Component>/` | Delete | 6 | After promotion. |

## Testing Plan

- **Phase 1:** Smoke test (`tests/smoke.test.ts`) verifies vitest config is correct.
- **Phase 2:** `<ThemeToggle>` test (toggle flips `data-theme`, persists in localStorage).
- **Phase 3:** Generated-hook test using MSW handlers; asserts payload type and that the generator hook composes with `<QueryClientProvider>`.
- **Phase 4:** Route-level integration test: render `$type.$id.tsx` with MSW handlers, assert title / status / body present; assert 404 path renders the portal 404 page.
- **Phase 5:** Candidate component test: render, ref forwarding, className merge, prop pass-through, no-op against a token-only stylesheet (mock `tokens.css` if needed).
- **Phase 6:** No new tests in this repo; verify that the existing tests still pass after the swap to the published primitive.
- **Cross-cutting:** No e2e (Playwright) tests in IMPL-0001; defer until search / auth / multi-page flows justify them.

## Dependencies

- **`api/openapi.yaml`** — already vendored (Phase 3 reads it).
- **Local rfc-api** — required for Phase 4. Per the [integration reference](../integration/rfc-api-reference.md#local-development): `make compose-up` (Postgres + Meilisearch) + `go run ./cmd/rfc-api serve`. Phase 4 success depends on a seeded corpus — either point the worker at a real GitHub repo (`RFC_API_WORKER_SOURCE_REPOS`) or dogfood against `donaldgifford/rfc-api` itself.
- **`@donaldgifford/design-system@0.1.0`** — required for Phase 2. Already published to GitHub Packages.
- **GitHub PAT with `read:packages`** — required for `bun install` in Phase 2 (and CI).
- **Phase 6 depends on a successful design-system release** — the release workflow + GitHub Packages publish must be working in that repo.

## References

- [DESIGN-0001 — Portal architecture and ds-candidates promotion model](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md) — the design this IMPL implements.
- [ADR-0001 — Consume rfc-api via its published OpenAPI contract](../adr/0001-consume-rfc-api-via-its-published-openapi-contract.md) — the API consumption rules that drive Phase 3.
- [ADR-0002 — Adopt React 19 + React Router v7 + TanStack Query + orval](../adr/0002-adopt-portal-frontend-stack.md) — the stack this IMPL stands up.
- [DESIGN-0002 — Markdown rendering pipeline](../design/0002-markdown-rendering-pipeline.md) — out of scope for this IMPL but Phase 4 hands off to it.
- [Integration reference — `docs/integration/rfc-api-reference.md`](../integration/rfc-api-reference.md) — endpoint cookbook + local-dev runbook for Phase 4.
- [Vendored OpenAPI spec — `api/openapi.yaml`](../../api/openapi.yaml) — the contract Phase 3 generates against.
- [Archived build guide — `docs/archive/0001-rfc-site-build-guide.md`](../archive/0001-rfc-site-build-guide.md) — the operational source for several Phase 1–2 specifics (auth file format, install pinning, etc.).
- [Oxide `rfd-site`](https://github.com/oxidecomputer/rfd-site) — the precedent we copy for RR7 + TanStack Query patterns.
- [donaldgifford/design-system/rfc-portal-mockup_15.html](https://github.com/donaldgifford/design-system/blob/main/rfc-portal-mockup_15.html) — visual reference for the portal's six views (Directory, RFC Page, Search, API, MCP, Frameworks). The mockup uses inline CSS tokens (Tokyo Night code palette + Arctic Wolf cool-blue background); the design-system's `tokens.css` is the canonical source — match the mockup's *structure* and let tokens resolve the colors. Drives Phase 4 layout decisions and the Phase 5 candidate identification (`<Badge>` status pill is visible in the directory cards *and* the RFC page header).
- [donaldgifford/rfc-api#20](https://github.com/donaldgifford/rfc-api/issues/20) — slug-parity contract test (DESIGN-0002 follow-up; not a blocker for this IMPL).
