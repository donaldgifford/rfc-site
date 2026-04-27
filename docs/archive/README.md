# Archived docs

Frozen snapshots of source material that has since been migrated into
docz-managed documents under `docs/{adr,rfc,design,impl,plan,investigation}/`.

## What lives here

Files in this directory:

- Are **historical records**, not authoritative documents.
- Are **not** indexed by `docz update` and have no `id:` frontmatter.
- Should **not** be linked to from other docs in this repo — link to the
  canonical, migrated version instead. If a stale link points here, fix it.
- Should not be edited. If the content is wrong, fix it in the canonical
  doc.

## Why keep them at all

Provenance. Each archived file shows what the migrated doc looked like when
it was first lifted in — useful when reviewing whether the canonical version
has drifted from the original intent, or for tracing which decisions came in
from another repo.

## Index

| Archived file | Canonical version(s) |
|---|---|
| [`rfc-site-adr-consume-rfc-api-via-openapi.md`](./rfc-site-adr-consume-rfc-api-via-openapi.md) | [ADR-0001 — Consume rfc-api via its published OpenAPI contract](../adr/0001-consume-rfc-api-via-its-published-openapi-contract.md) |
| [`0001-rfc-site-build-guide.md`](./0001-rfc-site-build-guide.md) | [DESIGN-0001 — Portal architecture and ds-candidates promotion model](../design/0001-portal-architecture-and-ds-candidates-promotion-model.md) (primary), with operational steps to be lifted into a future `IMPL-0001` |

### Provenance notes

**`rfc-site-adr-consume-rfc-api-via-openapi.md`** — originally drafted in
`donaldgifford/rfc-api` at `docs/scratch/rfc-site-adr-consume-rfc-api-via-openapi.md`,
with the staging note: *"When the `rfc-site` repo is created, move this file
to its `docs/adr/0001-*.md`."* That migration is complete — the file here is
the unmodified snapshot.

**`0001-rfc-site-build-guide.md`** — originally lived at the root of this repo
as the "primary spec" for greenfield portal scaffolding. Self-titled "RFC-Site
Build Guide (IMPL-0001 Phase 6, greenfield)" — i.e. it was an artifact of the
design-system repo's IMPL-0001 implementation plan, brought here for
reference. Its architectural content has been formalized in DESIGN-0001; its
concrete operational steps (install commands, scaffolding sequence) will be
lifted into an `IMPL-0001` plan in this repo when one is created. Its
References section uses paths that resolved only in the design-system repo
where the file originated, so links there will be dead from this archive
location — that's expected; treat it as historical.
