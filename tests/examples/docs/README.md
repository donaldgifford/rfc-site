# `tests/examples/docs/`

Hand-curated fixture tree for the `API_MODE=msw` local dev mode. See
[PLAN-0001](../../../docs/plan/0001-add-apimodemsw-local-dev-mode-for-rfc-site.md)
and [IMPL-0002](../../../docs/impl/0002-wire-up-apimodemsw-local-dev-mode.md).

The MSW handlers under `src/portal/api/msw/` read this tree at
startup to back the API surface during `bun run dev:msw`.

**Do not import from these files outside `src/portal/api/msw/`** —
they are dev/test fixtures, not real documentation.
