---
id: DESIGN-0001
type: design
title: "Card grid information density"
status: draft
authors:
  - name: "Dana Designer"
    handle: "danadesigner"
created_at: 2026-03-04T15:00:00Z
updated_at: 2026-03-12T11:00:00Z
labels:
  - ux
  - directory
source:
  repo: "donaldgifford/rfc-site"
  path: "tests/examples/docs/design/0001-card-grid-information-density.md"
  commit: "ace0f00d"
---

# Card grid information density

## Goal

The directory grid at `/` should fit ~12 docs above the fold on a
1440×900 display without sacrificing legibility.

## Layout

Each card shows:

- Type + canonical id (e.g. `RFC-0001`).
- Title (2 lines max, ellipsised).
- `<Badge>` with the document status.
- Updated-at timestamp (relative — "3 days ago").

## Spacing

| Token | Value | Where |
|-------|-------|-------|
| `--space-3` | 12px | Card inner padding |
| `--space-4` | 16px | Card grid gap |
| `--radius-md` | 6px | Card corner |

## Open questions

- Author avatars on cards? Defer until rfc-api emits avatar URLs.
- Hover affordance for keyboard nav? Likely a focus ring; pending
  a11y review.
