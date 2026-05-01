# rfc-site

SSR web frontend for [`rfc-api`](https://github.com/donaldgifford/rfc-api) and the first real consumer of [`@donaldgifford/design-system`](https://github.com/donaldgifford/design-system).

For the canonical specs, see:

- [DESIGN-0001 — Portal architecture and `ds-candidates/` promotion model](docs/design/0001-portal-architecture-and-ds-candidates-promotion-model.md)
- [DESIGN-0002 — Markdown rendering pipeline](docs/design/0002-markdown-rendering-pipeline.md)
- [ADR-0001 — Consume rfc-api via its OpenAPI contract](docs/adr/0001-consume-rfc-api-via-its-published-openapi-contract.md)
- [ADR-0002 — Adopt React 19 + RR7 + TanStack Query + orval](docs/adr/0002-adopt-portal-frontend-stack.md)
- [Integration reference (cookbook for rfc-api)](docs/integration/rfc-api-reference.md)

The build plan being executed is [IMPL-0001](docs/impl/0001-bootstrap-portal-scaffold-per-design-0001.md).

## Local setup

### Prerequisites

- [`mise`](https://mise.jdx.dev/) for tool versioning. After cloning:
  ```sh
  mise install
  ```
  This pulls Bun (runtime + package manager) and Node (kept for tool compat).

### GitHub Packages auth

`@donaldgifford/design-system` is published to GitHub Packages, not the public npm registry. To install it locally you need a `NPM_TOKEN` environment variable set to a GitHub Personal Access Token with the `read:packages` scope.

```sh
# Add to your shell rc (zsh / bash). Replace <pat> with your token.
export NPM_TOKEN=<pat>
```

In CI, when the workflow runs under the same `donaldgifford` GitHub owner, you can pass the auto-provided token: `NPM_TOKEN: ${{ secrets.GITHUB_TOKEN }}`.

### Install

```sh
bun install
```

This resolves dependencies including `@donaldgifford/design-system` from GitHub Packages (via the `bunfig.toml` scope mapping).

### Scripts

| Script | What it does |
|---|---|
| `bun run dev` | `react-router dev` — Vite dev server with SSR + HMR |
| `bun run build` | `react-router build` — production server + client bundles into `build/` |
| `bun run start` | `react-router-serve` — serves the built app |
| `bun run typegen` | `react-router typegen` — regenerates `.react-router/types/` route types |
| `bun run typecheck` | `react-router typegen && tsc --noEmit` — strict TS check |
| `bun run lint` | ESLint v9 flat config |
| `bun run lint:fix` | ESLint with `--fix` |
| `bun run format` | Prettier write |
| `bun run format:check` | Prettier check (no write) |
| `bun run test` | vitest single run |
| `bun run test:watch` | vitest in watch mode |
| `bun run gen-api` | orval — regenerate the rfc-api TS client from `api/openapi.yaml` (Phase 3 — not yet wired) |
| `bun run dev:msw` | Dev server backed by MSW handlers + checked-in fixtures — see [Local development without rfc-api](#local-development-without-rfc-api) |

A `justfile` mirrors every script as a recipe (`just dev`, `just check`, `just dev-msw`, …); `just --list` shows the full menu. The composite `just check` runs `typecheck` → `lint` → `format-check` → `test` for CI parity.

## Local development without rfc-api

The default `bun run dev` flow expects [`rfc-api`](https://github.com/donaldgifford/rfc-api) running with Postgres + the GitHub-webhook ingest pipeline backing it. That stack is heavy when your change is a portal-side UI tweak. The `dev:msw` flow avoids it entirely:

```sh
just dev-msw       # or: bun run dev:msw
```

What this does:

- Sets `API_MODE=msw` (server side) and `VITE_API_MODE=msw` (client side) so the boot modules in `src/portal/api/msw/setup.ts` (SSR) and `src/entry.client.tsx` (browser) start the MSW handlers before any loader resolves.
- Routes every `GET /api/v1/...` request against the **shared fixture handlers** in `src/portal/api/msw/handlers.ts`, backed by the hand-curated fixture tree at [`tests/examples/docs/<type>/*.md`](tests/examples/docs/) (eight fixtures across `rfc/adr/design/impl/plan/inv` types, ID pattern `^[A-Z]+-[0-9]+$`).
- Implements real RFC 5988 cursor pagination + RFC 7807 problem responses, so the route loaders exercise the same code paths they would against `rfc-api`.

Trade-offs:

- ✅ Zero external dependencies — boot the dev server, hit `http://localhost:5173/`, see real-shaped data.
- ✅ Reproducible payloads (fixtures are checked in; `faker` is seeded deterministically for the few non-structural fields).
- ❌ No live-API contract verification — the orval drift check still relies on the vendored `api/openapi.yaml`. Run `bun run dev` against a live `rfc-api` before merging anything that touches the API surface.

The full design lives in [PLAN-0001](docs/plan/0001-add-apimodemsw-local-dev-mode-for-rfc-site.md) and [IMPL-0002](docs/impl/0002-wire-up-apimodemsw-local-dev-mode.md). The same handlers back the integration tests (`tests/api/*.test.ts(x)`), so a fixture tweak that breaks rendering shows up in CI.

## Architecture in one paragraph

Build the portal with components inline, then **promote** stabilized components into `@donaldgifford/design-system` once they're used in 2+ places, have a stable API, and don't depend on portal-only concerns. The load-bearing convention is `src/components/ds-candidates/` — components there must be shaped exactly like they would be in the design system so promotion is `cp -r` (plus a single `git mv` for the colocated test). Portal-only code (routing, page layouts, Markdown rendering, API client, data fetching) lives under `src/components/portal/`, `src/pages/`, `src/routes/` and is **never promoted**. Tokens come from `@donaldgifford/design-system/tokens.css` (imported once at the entry); theme switching uses `useTheme` from `@donaldgifford/design-system/theme`. See [DESIGN-0001](docs/design/0001-portal-architecture-and-ds-candidates-promotion-model.md) for the full contract.

## API integration

`rfc-site` consumes `rfc-api` exclusively through the OpenAPI contract vendored at [`api/openapi.yaml`](api/openapi.yaml). The TypeScript client is generated by `orval` (Phase 3 — not yet wired) and never hand-written. See [ADR-0001](docs/adr/0001-consume-rfc-api-via-its-published-openapi-contract.md).

For local dev you'll need rfc-api running too — `RFC_API_URL=http://localhost:8080` by default, configurable via env. See the [integration reference](docs/integration/rfc-api-reference.md#local-development) for the full stack-up runbook.
