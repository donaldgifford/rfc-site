# `api/` — vendored OpenAPI spec

This directory holds the OpenAPI 3.1 spec for `rfc-api`, vendored into this
repo so the TS client can be generated locally and in CI without the network.

## Source

- **Upstream:** [`donaldgifford/rfc-api` → `api/openapi.yaml`](https://github.com/donaldgifford/rfc-api/blob/main/api/openapi.yaml).
- **Decision:** [ADR-0001 — Consume rfc-api via its published OpenAPI contract](../docs/adr/0001-consume-rfc-api-via-its-published-openapi-contract.md).
- **Cookbook + endpoint shapes:** [docs/integration/rfc-api-reference.md](../docs/integration/rfc-api-reference.md).

## Vendoring mechanism

**TBD.** ADR-0001 leaves this as a Phase 1 deferred decision: git submodule,
scripted copy-on-tag, or `npm`-packaged spec. The current `openapi.yaml` is a
hand-copied snapshot — replace this paragraph (and the file itself) once the
mechanism is picked.

When the mechanism lands, this README should also record the pinned `rfc-api`
release tag so a contributor can reproduce the snapshot.

## Don'ts

- **Don't hand-edit `openapi.yaml`.** It's a vendored copy; edits get clobbered
  on the next sync. If the spec is wrong, fix it upstream in `rfc-api`.
- **Don't commit the generated TS client.** Per ADR-0001, generator output is
  gitignored and regenerated on CI + locally; drift is a CI failure.
