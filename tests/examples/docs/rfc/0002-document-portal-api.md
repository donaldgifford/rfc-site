---
id: RFC-0002
type: rfc
title: "Document portal API surface contract"
status: accepted
authors:
  - name: "Avery Architect"
    handle: "averyarch"
created_at: 2025-11-02T14:00:00Z
updated_at: 2026-01-20T10:15:00Z
labels:
  - api
  - contract
source:
  repo: "donaldgifford/rfc-site"
  path: "tests/examples/docs/rfc/0002-document-portal-api.md"
  commit: "cafef00d"
---

# Document portal API surface contract

## Summary

The portal consumes `rfc-api` exclusively through the OpenAPI 3.1
contract published at `api/openapi.yaml`. Every request and response
is generated; hand-written types are forbidden.

## Endpoints

- `GET /api/v1/docs` — cross-type list with cursor pagination.
- `GET /api/v1/{type}` — per-type list.
- `GET /api/v1/{type}/{id}` — single document fetch.
- `GET /api/v1/search` — substring search across all types.

## Error envelope

Errors follow [RFC 7807](https://datatracker.ietf.org/doc/html/rfc7807):

```json
{
  "type": "https://errors.example.com/not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "No document with id RFC-9999",
  "request_id": "01HXYZ..."
}
```

## Pagination

Cursor-based per [RFC 5988](https://datatracker.ietf.org/doc/html/rfc5988).
Clients should not interpret cursor values — they are opaque tokens.
