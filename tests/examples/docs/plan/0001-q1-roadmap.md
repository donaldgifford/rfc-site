---
id: PLAN-0001
type: plan
title: "Q1 portal roadmap"
status: proposed
authors:
  - name: "Riley Reviewer"
    handle: "rileyrev"
created_at: 2026-01-05T10:00:00Z
updated_at: 2026-01-12T14:00:00Z
labels:
  - roadmap
source:
  repo: "donaldgifford/rfc-site"
  path: "tests/examples/docs/plan/0001-q1-roadmap.md"
  commit: "0123beef"
---

# Q1 portal roadmap

## Objective

Ship the rfc-site portal MVP in Q1: directory grid, doc detail page,
search, and the first promoted design-system primitive.

## Milestones

- **Jan**: Tooling + framework scaffold landed.
- **Feb**: API integration + first pages.
- **Mar**: First ds-candidate authored, ready for promotion.
- **Apr**: Promotion lands; manual verification gating closure.

## Risks

- Webhook ingest timeline slips → blocks live-stack smoke.
- design-system bundler gap (CSS Modules) → resolved via INV-0001.
