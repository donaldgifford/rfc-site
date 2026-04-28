# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo state

Phases 1 + 2 of [IMPL-0001](docs/impl/0001-bootstrap-portal-scaffold-per-design-0001.md) shipped. The portal SSR-renders a placeholder index route at `/` styled with `@donaldgifford/design-system` tokens; `<html data-theme="dark">` is set on first paint; the `<ThemeToggle>` flips between dark and light and persists via `useTheme` (localStorage key `design-system:theme`).

What's wired:

- React 19 + React Router v7 (framework mode) + Vite, served by `react-router-serve`.
- `src/root.tsx` (Layout + App) and a single `src/routes/_index.tsx` (flat-routes via `@react-router/fs-routes`).
- Design-system consumed via `bun link` against the local `../design-system` checkout (CLAUDE.md §When iterating in parallel) — `package.json` declares it as `link:@donaldgifford/design-system`. Flip back to `0.1.0` once `NPM_TOKEN` (read:packages) is available.
- `<ThemeToggle>` in `src/components/portal/ThemeToggle/` with co-located CSS module + vitest test.
- vitest configured with `resolve.dedupe: ["react", "react-dom"]` and an RTL `cleanup` afterEach hook in `tests/setup.ts`.

What's not wired yet:

- API integration (orval + TanStack Query) — Phase 3.
- Real routes against rfc-api — Phase 4.
- First `ds-candidate` (Badge) — Phase 5.
- First promotion to `@donaldgifford/design-system` — Phase 6.

## Canonical specs (read these first)

The load-bearing set for any non-trivial change:

- **[DESIGN-0001](docs/design/0001-portal-architecture-and-ds-candidates-promotion-model.md)** — portal architecture: the `ds-candidates/` promotion model, component authoring rules, where the API client lives, hard rules. The architectural *why/what* for the view layer.
- **[DESIGN-0002](docs/design/0002-markdown-rendering-pipeline.md)** — Markdown rendering pipeline: parser, plugin chain, sanitization, mermaid hydration, where it lives in `portal/`. The renderer for `Document.body`.
- **[ADR-0001](docs/adr/0001-consume-rfc-api-via-its-published-openapi-contract.md)** — `rfc-site` consumes `rfc-api` exclusively through its OpenAPI contract. Vendor the spec, generate a typed TS client, drift = CI failure.
- **[ADR-0002](docs/adr/0002-adopt-portal-frontend-stack.md)** — frontend stack: React 19 + React Router v7 + TanStack Query + orval + Vite + Bun. The single source of truth for "what does the portal use?".
- **[Integration reference](docs/integration/rfc-api-reference.md)** — the *how* companion to ADR-0001: endpoint payloads, error-sentinel→UI mapping, the Markdown contract (GFM + mermaid + sanitize, no MDX), local-stack runbook.

Also referenced often:

- **[`api/openapi.yaml`](api/openapi.yaml)** — vendored OpenAPI 3.1 spec for `rfc-api`. See `api/README.md`. Sync mechanism is TBD per ADR-0001 Phase 1.
- **[Archived build guide](docs/archive/0001-rfc-site-build-guide.md)** — the original "primary spec" that DESIGN-0001 and ADR-0001 superseded. Frozen snapshot, **not authoritative** — when it disagrees with the canonical specs, the canonical specs win. Useful only for provenance.

## Tooling

- **Runtime + package manager:** Bun (`mise.toml` pins `latest`; currently 1.3.11).
- **Bundler:** Vite 8 (`@react-router/dev/vite` plugin owns dev/build/SSR entry generation in framework mode).
- **Framework + router:** React 19.2.5 + React Router v7.14 (framework mode, `appDirectory: "src"`, `ssr: true`). Routes discovered via `@react-router/fs-routes` from `src/routes.ts` — `ignoredRouteFiles` excludes `**/*.module.css`, `**/*.test.{ts,tsx}`, `**/README.md`. Production server: `@react-router/serve`. Ratified in [ADR-0002](docs/adr/0002-adopt-portal-frontend-stack.md), following Oxide's [`rfd-site`](https://github.com/oxidecomputer/rfd-site) precedent.
- **Data fetching:** TanStack Query (per Oxide stack). OpenAPI client generator: **`orval`** — picked because it auto-generates TanStack Query hooks (Oxide writes those by hand) and ships MSW handler generation. Note: Oxide's own `@oxide/openapi-gen-ts` is Dropshot-only and not portable to our hand-authored spec — see ADR-0001. Both come in Phase 3.
- **Markdown rendering:** `react-markdown` + `remark-gfm` + `@shikijs/rehype` + `rehype-sanitize` + `mermaid` (client-side hydration). See [DESIGN-0002](docs/design/0002-markdown-rendering-pipeline.md) for the full plugin chain. Comes after Phase 4 (separate IMPL doc TBD).
- **Language:** TypeScript ^5.7.2 strict, `target: ES2022`, `moduleResolution: bundler`. `tsconfig.json` mirrors the design-system repo verbatim with all extra strictness (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `isolatedModules`, etc.).
- **Lint/format:** ESLint v9 flat config + Prettier — mirror the design-system repo verbatim so promoted candidates pass lint in both repos with no churn. Versions: eslint ^9.17, typescript-eslint ^8.18, eslint-plugin-react ^7.37, react-hooks ^5.1, jsx-a11y ^6.10.
- **Tests:** vitest ^2.1.8 + jsdom ^25.0.1 + `@testing-library/react` ^16.3.2 + `@testing-library/jest-dom` ^6.9.1 + `@testing-library/user-event` ^14.6.1. `tests/setup.ts` extends expect with jest-dom matchers and registers an `afterEach(cleanup)` so screen queries don't leak between tests. Vitest discovers both `tests/**/*.test.{ts,tsx}` and `src/**/*.test.{ts,tsx}` (the latter for colocated `portal/` and `ds-candidate` tests per DESIGN-0001 §Resolved). `vitest.config.ts` sets `resolve.dedupe: ["react", "react-dom"]` so a `bun link`'d design-system consumes rfc-site's React (otherwise jsdom hits the classic two-React `useState` is null crash).

`mise.toml` reconciled: `bun = "latest"` added, `pnpm = "10.33.2"` removed, `node = "22"` kept for tool compat headroom (drop later when every tool is confirmed Bun-native).

GitHub Packages auth is required to install the design system. Commit `bunfig.toml` (resolved — `.npmrc` is not committed); `NPM_TOKEN` must have `read:packages`. When `NPM_TOKEN` isn't set locally, the design-system can be consumed via `bun link` against `../design-system` (`just ds-build` then `just ds-link`); `package.json` declares the dep as `link:@donaldgifford/design-system` so `bun install` resolves it through the local checkout.

## Task runner (`justfile`)

A `justfile` mirrors `package.json` scripts as recipes. Prefer `just <recipe>` over `bun run x` for the loop. Composite: `just check` runs typecheck → lint → format-check → test (CI parity). Design-system local workflow: `just ds-build`, `just ds-link`, `just ds-unlink`. `just --list` for the full recipe list.

## Architecture: portal-first, primitives follow

Per RFC-0002 §Rollout (in the design-system repo): build the portal with components inline, then **promote** stabilized components into `@donaldgifford/design-system`. Components are not designed in the design system by anticipation.

The load-bearing convention is the `src/components/ds-candidates/` folder. Components there must be **shaped exactly like they would be in the design system** so promotion is `cp -r` (plus a single `git mv` for the colocated test file — see the promotion workflow below). That means:

- One folder per component, with `Component.tsx`, `Component.module.css`, `index.ts`.
- `forwardRef`, named exports, native DOM prop pass-through.
- Imports only design-system tokens (`var(--...)`) and design-system primitives — never sibling `portal/` code, `pages/`, `routes/`, app state, the API client, or TanStack Query.

Portal-only code (routing, page layouts, Markdown rendering, auth, data fetching, RFC-specific features) lives in `src/components/portal/`, `src/pages/`, `src/routes/` — and is **never promoted**.

The OpenAPI-generated client + TanStack Query hooks live under `src/portal/api/` (or similar — under `portal/`, never under `ds-candidates/`). If a candidate needs data, the consuming `portal/` page passes it as props.

The "ready to promote" checklist lives in DESIGN-0001 (§The `ds-candidates/` contract): used 2+ places, API stable ~2 weeks, no portal-only deps.

## Hard rules (anti-patterns to refuse)

From DESIGN-0001 §Anti-patterns and the design-system ADRs. Treat as guardrails, not suggestions:

- **Never fork tokens.** `tokens.css` is consumed via `import "@donaldgifford/design-system/tokens.css"` exactly once at the app entry. Never copy its contents into portal CSS, never override design-system CSS variables in portal CSS.
- **Never add a blanket component library** (Radix Themes, shadcn/ui, MUI, Chakra, etc.). The single sanctioned Radix dependency is `@radix-ui/react-slot` (design-system DESIGN-0002, for `asChild` composition). Adding others re-creates the inconsistency RFC-0002 was solving. Note: Oxide's `rfd-site` uses Tailwind alongside their design system — that is a divergence we deliberately do not follow.
- **Never roll a theme switcher.** Use `useTheme` from `@donaldgifford/design-system/theme`. It handles `data-theme`, localStorage (`design-system:theme`), `prefers-color-scheme`, and SSR safety.
- **Never theme-branch inside components.** `if (theme === "light") …` in component code is a bug — tokens already remap when `data-theme` flips. If branching feels necessary, the missing piece is a semantic token in the design system.
- **No CSS-in-JS runtime, no Tailwind, no `style={}` for non-dynamic values.** CSS Modules, co-located.
- **API shape:** `variant` / `size` / `status` as string unions, never `isPrimary`-style booleans.
- **`className` merges, never replaces** — use `clsx` or a `cn()` helper.
- **Resolve cross-document Markdown links from the doc payload's `links[]` array, not by parsing relative paths in the body.** `rfc-api` does that resolution; doing it again on the client is duplicate work that drifts.
- **Never hand-write request/response types** for anything `rfc-api` owns. Extend the contract upstream in `rfc-api`, then regenerate.

## When iterating on the design system in parallel

If a token, hook, or primitive in `@donaldgifford/design-system` needs a change, `bun link` against the local checkout. Critical: after edits in the design-system repo, **run its build** (the portal imports from `dist/`, not source), **add a changeset** (otherwise the change won't ship), and **unlink before final testing** to confirm against a published version.

## Promotion workflow

When a `ds-candidate` meets the readiness checklist (DESIGN-0001 §The `ds-candidates/` contract):

1. In the design-system repo: `cp -r` the candidate folder to `src/primitives/<Component>/` (excluding the colocated `.test.tsx`), `git mv` the test to `tests/primitives/<Component>.test.tsx` (the design-system repo uses a top-level `tests/` directory mirroring `src/`), update `src/index.ts`, run lint/typecheck/test/build, add a changeset, ship via the release workflow.
2. In this repo: `bun update @donaldgifford/design-system`, swap candidate imports for package imports, delete `ds-candidates/<Component>/`, verify pages render identically.

## Repo layout (current)

```
api/
  openapi.yaml                       ← vendored from rfc-api; sync mechanism TBD
  README.md
docs/
  adr/                               ← docz-managed; ADR-0001 (API contract) and ADR-0002 (stack) are load-bearing
  design/                            ← docz-managed; DESIGN-0001 (portal architecture) and DESIGN-0002 (Markdown pipeline) are load-bearing
  impl/                              ← IMPL-0001 (bootstrap scaffold) — Phases 1-2 done, 3-6 pending
  integration/                       ← non-docz reference docs (rfc-api cookbook)
  archive/                           ← frozen historical source material
src/
  root.tsx                           ← RR7 framework-mode root (Layout + App)
  routes.ts                          ← flatRoutes() with ignoredRouteFiles
  routes/
    _index.tsx                       ← placeholder index route
    _index.module.css
    README.md                        ← documents the flat-routes convention
  components/
    portal/
      ThemeToggle/                   ← first portal component (test colocated)
      README.md                      ← what belongs in portal/
    ds-candidates/
      README.md                      ← promotion contract reminder
  pages/                             ← (empty; reserve for page-specific composites)
  styles/                            ← (empty; portal-local CSS only — never tokens)
tests/
  setup.ts                           ← jest-dom matchers + RTL afterEach(cleanup)
  smoke.test.ts                      ← phase 1 smoke (drop in phase 3)
api/openapi.yaml                     ← vendored
bunfig.toml                          ← @donaldgifford → npm.pkg.github.com
react-router.config.ts               ← appDirectory: "src", ssr: true
vite.config.ts                       ← @react-router/dev plugin
vitest.config.ts                     ← jsdom + dedupe react / react-dom
justfile                             ← task runner (mirrors package.json scripts)
mise.toml                            ← bun = latest, node = 22
.docz.yaml
CLAUDE.md
```

Next doc-level / impl-level work: Phase 3 (orval + TanStack Query + MSW handlers).
