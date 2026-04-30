---
id: INV-0001
type: inv
title: "Evaluate search backends for the doc corpus"
status: draft
authors:
  - name: "Avery Architect"
    handle: "averyarch"
created_at: 2026-02-18T13:00:00Z
updated_at: 2026-02-25T09:00:00Z
labels:
  - search
  - investigation
source:
  repo: "donaldgifford/rfc-site"
  path: "tests/examples/docs/inv/0001-evaluate-search-backends.md"
  commit: "5ea2c4ed"
---

# Evaluate search backends for the doc corpus

## Question

Can we power `/api/v1/search` with Postgres full-text alone, or do we
need a dedicated search engine (Elasticsearch / Meilisearch)?

## Approach

Benchmark against a 10k-doc synthetic corpus:

1. Ingest 10k randomly-generated Markdown docs.
2. Measure `tsvector` + `GIN` index build time.
3. Run 50 representative queries; record p50 / p99 latency.
4. Compare against Meilisearch with the same corpus.

## Provisional findings

- Postgres p50 ≈ 12ms, p99 ≈ 87ms (acceptable).
- Index size ≈ 18MB for 10k docs (also fine).
- Tradeoff: typo tolerance is weaker than Meilisearch.

## Recommendation (provisional)

Stick with Postgres full-text for v1; revisit when corpus crosses
50k docs or typo-tolerance becomes a recurring complaint.
