# `portal/`

Portal-only components. **Never promoted** to `@donaldgifford/design-system`.

These components may freely import from:

- `@donaldgifford/design-system` (primitives, hooks, tokens)
- Other `portal/` components
- App state, route loaders, the API client, TanStack Query

What lives here:

- Page-shell pieces (header, footer, theme toggle)
- RFC-portal-specific composites (e.g., `<DocCard>`, `<RfcStatusPill>` if it never generalizes)
- Anything tied to RR7, routing params, the orval client, or domain shapes from `api/openapi.yaml`

If a component starts feeling generic — used twice, no portal deps, stable API — move it to `ds-candidates/` per [DESIGN-0001 §Promotion workflow](../../../docs/design/0001-portal-architecture-and-ds-candidates-promotion-model.md).
