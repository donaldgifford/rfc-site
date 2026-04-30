---
id: IMPL-0001
type: impl
title: "Bootstrap the portal scaffold"
status: accepted
authors:
  - name: "Sam Author"
    handle: "samauthor"
created_at: 2026-04-21T09:00:00Z
updated_at: 2026-04-29T13:35:00Z
labels:
  - scaffold
  - milestone
source:
  repo: "donaldgifford/rfc-site"
  path: "tests/examples/docs/impl/0001-bootstrap-portal.md"
  commit: "b00b1e5"
---

# Bootstrap the portal scaffold

## Phases

1. Tooling baseline (TS, ESLint, Prettier, vitest).
2. Framework scaffold (RR7 + Vite + design system).
3. API integration (orval + TanStack Query + MSW).
4. First pages render against rfc-api.
5. First ds-candidate (`<Badge>`).
6. First promotion to `@donaldgifford/design-system`.

## Status

All six phases shipped on `feat/design-0001`. Phase 6 promoted
`<Badge>` to `@donaldgifford/design-system@0.2.0`. The `dev:msw`
follow-up (PLAN-0001 / IMPL-0002) unblocks the remaining manual
smoke checks.
