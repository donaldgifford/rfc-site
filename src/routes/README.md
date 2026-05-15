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
- **Reusable view components**: `src/components/<View>/` — flat layout, one directory per view per RFC-0001 + DESIGN-0003. No `portal/` / `ds-candidates/` subfolders.
