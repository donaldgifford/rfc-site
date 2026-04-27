---
id: ADR-0001
title: "Consume rfc-api via its published OpenAPI contract"
status: Proposed
author: Donald Gifford
created: 2026-04-26
---
<!-- markdownlint-disable-file MD025 MD041 -->

# 0001. Consume rfc-api via its published OpenAPI contract

<!--toc:start-->
- [Status](#status)
- [Context](#context)
- [Decision](#decision)
  - [What rfc-site needs to know about the shape](#what-rfc-site-needs-to-know-about-the-shape)
  - [Resolved (post-initial-draft)](#resolved-post-initial-draft)
  - [Non-decisions (still deferred)](#non-decisions-still-deferred)
- [Consequences](#consequences)
  - [Positive](#positive)
  - [Negative](#negative)
  - [Neutral](#neutral)
- [Alternatives Considered](#alternatives-considered)
- [References](#references)
<!--toc:end-->

## Status

Proposed.

> Originally drafted in `donaldgifford/rfc-api` at `docs/scratch/rfc-site-adr-consume-rfc-api-via-openapi.md` while this repo did not yet exist. Migrated here on creation per the staging note in that file.

## Context

`rfc-site` is the SSR web frontend for the Markdown Portal ([rfc-api RFC-0002](https://github.com/donaldgifford/rfc-api/blob/main/docs/rfc/0002-rfc-site-web-frontend-for-the-markdown-portal.md)). Its sole runtime dependency is `rfc-api` — a Go service that serves Markdown documents + cross-type search + discussion over HTTP. `rfc-api` lives in a separate repository ([github.com/donaldgifford/rfc-api](https://github.com/donaldgifford/rfc-api)), ships independently (own semver, own Helm chart, own Deployment), and publishes a hand-authored OpenAPI 3.1 spec as the source of truth for every consumer.

`rfc-site` needs to:

1. Fetch documents by type + id, including the raw Markdown body.
2. Paginate cross-type directory views and per-type lists.
3. Call cross-type search and render highlight snippets.
4. Fetch per-document sub-resources (authors, links, discussion).
5. Pass the user's bearer token through to `rfc-api` (post Phase 4).
6. Do all of the above without touching Postgres, Meilisearch, or GitHub directly.

The question is how tightly to couple the frontend client code to the backend shape.

## Decision

**`rfc-site` consumes `rfc-api` exclusively through the [`api/openapi.yaml`](https://github.com/donaldgifford/rfc-api/blob/main/api/openapi.yaml) contract published by the `rfc-api` repo.** A vendored copy of the spec lives at [`api/openapi.yaml`](../../api/openapi.yaml) in this repo. Concretely:

1. **Vendor the spec.** Copy `api/openapi.yaml` from a pinned `rfc-api` release tag into `rfc-site` at build time (or a submodule / flake input — pick one in Phase 1). Do *not* hand-translate types. The vendored copy currently lives at [`api/openapi.yaml`](../../api/openapi.yaml); the long-term sync mechanism is deferred.
2. **Generate a typed TS client** from the vendored spec using `openapi-ts` (or equivalent — see deferred decisions). The generator runs as part of `rfc-site`'s build; the generated output is gitignored and regenerated on CI + locally. Upgrading the pinned `rfc-api` version is a one-line bump + regenerate + commit.
3. **No hand-written request/response types** for anything `rfc-api` owns. Extending the contract — new endpoint, new field — is an `rfc-api` PR, not an `rfc-site` PR.
4. **Contract drift is a CI failure.** `rfc-site` CI runs the generator on every push and fails if the generated output diverges from the committed types stub (or, if a test build is cheap, from the last successful build). A spec change in `rfc-api` shouldn't silently land in a `rfc-site` release without a visible PR diff.

### What rfc-site needs to know about the shape

| Concern | Shape |
|--------|-------|
| **Base URL** | Injected at deploy time (`RFC_API_URL` or similar). Main port only — `/api/v1/*`. Never call `:8081/*` (admin port, ops-only). |
| **Versioning** | All paths prefixed `/api/v1/`. A breaking change is `/api/v2/` and a parallel surface; `v1` stays live through deprecation. |
| **Document id in URLs** | Numeric. `/api/v1/rfc/1` not `/api/v1/rfc/RFC-0001`. |
| **Canonical display id** | `{PREFIX}-{zero-padded-4}`, e.g. `RFC-0001`, `ADR-0042`. Appears in payloads as `id` + `display_id`. |
| **List endpoints** | Bare JSON arrays (never `null`). Total in `X-Total-Count`; next/prev cursors in RFC 8288 `Link` header. Cursor is an opaque base64 string — treat as a blob, don't parse it. |
| **Body field** | `body` is raw Markdown. `rfc-site` server-renders it. `rfc-api` never returns HTML. |
| **Error envelope** | `application/problem+json` (RFC 7807). Shape: `{type, title, status, detail, instance}`. Human-readable detail; UI can show it verbatim or map by `title`. |
| **Sub-resources** | `/api/v1/{type}/{id}/authors`, `/links`, `/discussion`. Each returns the shape declared in the spec — don't assume they're cached joins of the parent. |
| **Search** | `GET /api/v1/search?q=...&type=...&limit=...&cursor=...`. Response includes highlight snippets + `matched_terms`. Cursor is opaque (internally base64 offset; may change — don't rely on it). |
| **Webhook endpoint** | `POST /api/v1/webhooks/github` — for GitHub only. `rfc-site` never calls it. |
| **CORS** | `rfc-api` enforces an allow-list via `RFC_API_CORS_ORIGINS`. SSR requests from the `rfc-site` server don't need CORS (server-to-server), but any browser-side direct call (future admin UI, preview widget, etc.) requires `rfc-site`'s public origin to be added to that env var in both dev and prod. |
| **Auth (Phase 1–3)** | None. Internal network only. No `Authorization` header needed. |
| **Auth (Phase 4, OIDC)** | `rfc-site` completes the OIDC authz-code flow against Keycloak/Okta and forwards the access token to `rfc-api` as `Authorization: Bearer <jwt>`. `rfc-api` validates the JWT against the IdP's JWKS. No session sharing beyond the bearer. |
| **Tracing** | `rfc-api` accepts W3C `traceparent` headers on every request and joins the trace. `rfc-site` should propagate its SSR span. |

### Resolved (post-initial-draft)

- **OpenAPI generator: `orval`.** Picked over `@hey-api/openapi-ts` and `openapi-typescript`+`openapi-fetch` because it auto-generates TanStack Query hooks (saving the hand-written hook layer that Oxide's `rfd-site` writes manually) and includes MSW handler generation for component tests. Investigation note: Oxide's own [`@oxide/openapi-gen-ts`](https://github.com/oxidecomputer/oxide.ts) is *Dropshot-specific* — its README says *"unlikely to handle [non-Dropshot specs] well … we recommend forking"* — so Oxide's tooling does not generalize to `rfc-api`'s hand-authored Go spec. The Oxide *approach* (typed client + TanStack Query) still informs us; the *tooling* does not. Ratified alongside React Router v7 + TanStack Query in [ADR-0002](./0002-adopt-portal-frontend-stack.md).

### Non-decisions (still deferred)

- **Caching strategy.** Per-pod in-memory vs Redis vs plain HTTP caching. rfc-api RFC-0002 Open Question #5.
- **Vendoring mechanism.** Git submodule vs scripted copy-on-tag vs `npm`-packaged spec. Pick in Phase 1; all reversible.

## Consequences

### Positive

- **Breaking-change visibility:** a field rename or param deletion surfaces as a generated-type diff in an `rfc-site` PR, not as a runtime 400.
- **Single source of truth:** MCP clients, `rfc-site`, and any future consumer all negotiate the same surface. Departures from the spec are bugs in `rfc-api`.
- **Parallel development:** frontend contributors can stub against the spec before the matching endpoint ships, and `rfc-api` contract tests (`rfc-api/test/contract/`) already prove the server matches the spec.

### Negative

- **`rfc-site` is coupled to `rfc-api`'s release cadence for new fields.** If the frontend needs a new field, it's an `rfc-api` PR first, then a `rfc-site` bump. Acceptable: this is the point of "one canonical surface."
- **Generator output is large and regenerates on every dep bump.** Mitigation: gitignore the output, commit a small types stub for IDE ergonomics, let CI catch drift.

### Neutral

- **If the spec is wrong** (missing an endpoint the server actually serves, or vice versa), `rfc-api`'s contract tests will catch it before merge. `rfc-site` inherits that guarantee for free.

## Alternatives Considered

- **Hand-written fetch wrappers and types.** Simpler upfront, no generator in the build. Rejected: every `rfc-api` field rename or new endpoint becomes a manual translation step on this side, and runtime 400s replace compile-time errors. Defeats the whole point of having an OpenAPI spec.
- **Publish the generated client as a package** (à la Oxide's `@oxide/rfd.ts`). Reasonable, but only pays off when there's a second consumer. With one consumer (`rfc-site`), generating in-tree from the vendored spec is simpler. Reconsider when a second TS consumer appears.
- **Switch to a different transport** (GraphQL, gRPC-web, tRPC). Out of scope — `rfc-api` is REST + OpenAPI by decision, and we are not redesigning the backend to suit the frontend.

## References

In this repo:

- [`api/openapi.yaml`](../../api/openapi.yaml) — vendored copy of the spec this ADR binds us to. See [`api/README.md`](../../api/README.md) for the (TBD) sync mechanism.
- [Integration reference — `docs/integration/rfc-api-reference.md`](../integration/rfc-api-reference.md) — companion cookbook to this ADR: sample payloads, error-sentinel mapping, the Markdown contract, and local-stack runbook.
- [DESIGN-0001 — Portal architecture and ds-candidates promotion model](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md) — portal view-layer architecture; this ADR is the API-consumption half.
- [Archived build guide — `docs/archive/0001-rfc-site-build-guide.md`](../archive/0001-rfc-site-build-guide.md) — original portal source material that established `data fetching` and `API clients` as portal-only concerns (motivating this ADR). Frozen snapshot, not authoritative.

In `donaldgifford/rfc-api`:

- [rfc-api RFC-0002 — rfc-site web frontend for the Markdown Portal](https://github.com/donaldgifford/rfc-api/blob/main/docs/rfc/0002-rfc-site-web-frontend-for-the-markdown-portal.md) — `rfc-site` scope and phases.
- [rfc-api `api/openapi.yaml`](https://github.com/donaldgifford/rfc-api/blob/main/api/openapi.yaml) — upstream spec; the file under `api/` in this repo is a vendored snapshot of this.
- [rfc-api DESIGN-0001 — HTTP server (Go `net/http`) structure](https://github.com/donaldgifford/rfc-api/blob/main/docs/design/0001-rfc-api-http-server-go-net-http-structure.md) — middleware chain and error envelope rationale.
- [rfc-api DESIGN-0002 — DocumentType extensibility for multiple content types](https://github.com/donaldgifford/rfc-api/blob/main/docs/design/0002-documenttype-extensibility-for-multiple-content-types.md) — the "type is a parameter, not a package name" rule that makes `/api/v1/{type}` work.

External:

- [Oxide `rfd-site`](https://github.com/oxidecomputer/rfd-site) — prior art and reference implementation: React 19 + React Router v7 + Vite + TanStack Query + a generated TS client from an OpenAPI spec.

Related ADRs:

- [ADR-0002 — Adopt React 19 + React Router v7 + TanStack Query + orval as the portal stack](./0002-adopt-portal-frontend-stack.md) — ratifies the full stack including the `orval` decision recorded above in §Resolved post-initial-draft.
