# `ds-candidates/`

Components staged here are **shaped exactly like they would be in `@donaldgifford/design-system`**, so promotion is `cp -r` (plus a single `git mv` for the colocated test).

See [DESIGN-0001 §The `ds-candidates/` contract](../../../docs/design/0001-portal-architecture-and-ds-candidates-promotion-model.md#the-ds-candidates-contract) for the full rules. Summary:

- One folder per component: `Component.tsx`, `Component.module.css`, `index.ts`, `Component.test.tsx` (colocated).
- `forwardRef`, named exports, native DOM prop pass-through.
- `variant` / `size` / `status` props as **string unions**, never `isPrimary`-style booleans.
- `className` merges via `clsx` / `cn()`, never replaces.
- Imports **only** design-system tokens (`var(--*)`) and design-system primitives. Never sibling `portal/`, `pages/`, `routes/`, app state, API client, or TanStack Query.

## Promotion readiness checklist

A candidate is ready to promote when:

1. Used in **2+ places** in the portal.
2. API has been **stable for ~2 weeks** (no churn).
3. **No portal-only deps** (grep-validated — see DESIGN-0001).

Promotion workflow lives in [IMPL-0001 §Phase 6](../../../docs/impl/0001-bootstrap-portal-scaffold-per-design-0001.md#phase-6-first-promotion).
