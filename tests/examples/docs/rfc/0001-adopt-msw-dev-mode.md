---
id: RFC-0001
type: rfc
title: "Adopt MSW-backed dev mode for the portal"
status: proposed
authors:
  - name: "Sam Author"
    handle: "samauthor"
  - name: "Riley Reviewer"
    handle: "rileyrev"
created_at: 2026-01-15T09:00:00Z
updated_at: 2026-02-03T11:30:00Z
labels:
  - tooling
  - dx
source:
  repo: "donaldgifford/rfc-site"
  path: "tests/examples/docs/rfc/0001-adopt-msw-dev-mode.md"
  commit: "deadbeef"
---

# Adopt MSW-backed dev mode for the portal

## Motivation

Iterating on the portal currently requires `rfc-api`, Postgres, and the
GitHub-webhook ingest pipeline to be running locally. That setup is
heavy for a contributor whose change is purely UI-side.

## Proposal

Wire an `API_MODE=msw` flag into the dev server that, when set, boots
[MSW](https://mswjs.io/) handlers backed by a hand-curated fixture
tree at `tests/examples/docs/`. Dev mode then resolves all API
requests against the fixtures.

```ts
// Conceptually:
if (process.env.API_MODE === "msw") {
  setupServer(...handlers).listen({ onUnhandledRequest: "bypass" });
}
```

Trade-offs:

- ✅ Zero-dependency local iteration.
- ✅ Reproducible payloads (fixture corpus is checked in).
- ❌ No live-API contract verification — that still needs `bun run dev`.

## Alternatives considered

- A staging `rfc-api` deployment shared across contributors.
- Vite middleware mocks instead of MSW.
