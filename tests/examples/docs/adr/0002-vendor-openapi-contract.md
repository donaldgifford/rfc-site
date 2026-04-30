---
id: ADR-0002
type: adr
title: "Vendor the OpenAPI contract into rfc-site"
status: accepted
authors:
  - name: "Sam Author"
    handle: "samauthor"
created_at: 2026-01-08T12:00:00Z
updated_at: 2026-01-10T09:00:00Z
labels:
  - api
  - tooling
source:
  repo: "donaldgifford/rfc-site"
  path: "tests/examples/docs/adr/0002-vendor-openapi-contract.md"
  commit: "1eafde4d"
---

# Vendor the OpenAPI contract into rfc-site

## Context

rfc-site needs the rfc-api OpenAPI spec to generate its TypeScript
client. The spec is the canonical contract.

## Decision

Vendor `api/openapi.yaml` into the rfc-site repo. Re-sync via
`scripts/gen-api.sh`. Drift detection runs in CI.

## Consequences

- Type-safe end-to-end; no manual response shape definitions.
- Generated client is gitignored — produced on each install.
- Spec drift is a CI failure, surfacing breakage before merge.
- Cross-repo coordination required when the API breaks.
