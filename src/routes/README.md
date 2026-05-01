# `routes/`

React Router v7 file-system routes. Discovered via `@react-router/fs-routes` from `src/routes.ts`.

## Convention

We use the v7 flat-file convention from `@react-router/fs-routes`:

| File | URL |
|---|---|
| `_index.tsx` | `/` |
| `about.tsx` | `/about` |
| `$type.$id.tsx` | `/:type/:id` (params) |
| `_layout.tsx` | shared chrome (wraps children) |

See the [React Router v7 docs](https://reactrouter.com/start/framework/routing) for the full convention. Pinned to RR7 7.14.x — bump deliberately.

## Where things live

- **Routes here**: top-level URL → component bindings. Loaders, actions, `meta`, and the page composition belong here.
- **Reusable page chrome**: `src/components/portal/` (e.g., `<ThemeToggle>`, `<SiteHeader>`).
- **Page-specific composites that are too narrow for `portal/`**: `src/pages/<page>/`.

Never import from `src/components/ds-candidates/` directly — those imports are scoped to the candidates themselves and the routes/pages that consume them as drop-in primitives.
