---
id: ADR-0001
type: adr
title: "Use PostgreSQL for primary storage"
status: accepted
authors:
  - name: "Avery Architect"
    handle: "averyarch"
created_at: 2025-09-12T08:30:00Z
updated_at: 2025-09-15T16:45:00Z
labels:
  - storage
  - infrastructure
source:
  repo: "donaldgifford/rfc-api"
  path: "tests/examples/docs/adr/0001-use-postgres-for-storage.md"
  commit: "f00dface"
---

# Use PostgreSQL for primary storage

## Context

`rfc-api` needs durable storage for the document corpus, full-text
search across bodies, and JSON columns for `extensions` /
`discussion` payloads.

## Decision

PostgreSQL 16 — full-text search via `tsvector` + `GIN`, JSONB for
extensions, pg_trgm for fuzzy match.

## Consequences

- Single backing store; no need to sync with Elasticsearch.
- Operationally heavier than SQLite for tiny deployments.
- We commit to a Postgres-shaped schema; switching engines later
  would be a migration project, not a config flip.
