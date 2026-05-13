# `ds-candidates/`

Components staged here are **shaped exactly like they would be in `@donaldgifford/design-system`**, so promotion is `cp -r` (plus a single `git mv` for the colocated test).

See [DESIGN-0001 §The `ds-candidates/` contract](../../../docs/design/0001-portal-architecture-and-ds-candidates-promotion-model.md#the-ds-candidates-contract) for the full rules and [IMPL-0004](../../../docs/impl/0004-build-rfc-portal-components-per-inv-0002-inventory.md) for the current authoring sweep.

## Authoring checklist

When starting a new candidate, follow this checklist top-to-bottom. The numbered steps map 1:1 to what a reviewer will look for.

### 1. Folder shape

One folder per component, named in PascalCase:

```text
src/components/ds-candidates/<Component>/
├── <Component>.tsx          ← the component
├── <Component>.module.css   ← styles, tokens only
├── <Component>.test.tsx     ← colocated test
└── index.ts                 ← named export(s)
```

### 2. Exports

- **Named exports only** — `export function <Component>` / `export const <Component>`. No default exports.
- **`index.ts`** re-exports the component and any public sub-components (`<Card.Header>`) + types (`<Component>Props`).
- **Type exports** use the `export type` form so `verbatimModuleSyntax` stays happy.

### 3. Ref forwarding

- Wrap with `forwardRef<HTMLElement, Props>` so consumers can attach refs.
- Smoke-test ref forwarding in `<Component>.test.tsx` — pass a `ref` and assert it points at the rendered DOM node.

### 4. Prop pass-through

- Extend `React.ComponentPropsWithoutRef<"tag">` (or `React.HTMLAttributes<HTMLElement>` for polymorphic surfaces) so every native attribute works without explicit listing.
- Custom props (`variant`, `size`, `status`, `asChild`) come **after** the native props in the type intersection.

### 5. Prop API shape

- `variant` / `size` / `status` are **string unions** (`"primary" | "secondary"`), never `isPrimary`-style booleans.
- `asChild?: boolean` for Radix Slot composition when the component needs to delegate rendering to a child (e.g. wrapping `<Link>`). The sanctioned dep is `@radix-ui/react-slot` per [CLAUDE.md §Hard rules](../../../CLAUDE.md#hard-rules-anti-patterns-to-refuse).
- Defaults documented in the prop type via JSDoc.

### 6. `className` merge

- Always merge — use `clsx` from the existing runtime dep. Never replace.
- Pattern: `clsx(styles.root, styles[`variant-${variant}`], className)`.

### 7. CSS Modules — tokens only

- File name: `<Component>.module.css`.
- Use design-system CSS variables (`var(--color-bg)`, `var(--space-4)`, `var(--shadow-sm)`, …). **No raw colors or magic numbers.**
- Never override design-system variables in portal CSS.
- Class names are `camelCase` so the `styles.root` lookup is clean.

### 8. Imports

- Allowed:
  - `react`, `react-dom`.
  - `@donaldgifford/design-system` (tokens / primitives only — no `portal/` types).
  - `@radix-ui/react-slot` for `asChild` composition.
  - `clsx`.
  - Type-only imports from `react-router` (e.g. `import type { LinkProps } from "react-router"`) **only** when needed for prop shape — never runtime imports of `<Link>` itself (a candidate must work without RR7 mounted).
- Forbidden:
  - Sibling `portal/`, `pages/`, `routes/` imports.
  - App state, API client, TanStack Query.
  - Anything under `src/portal/`.

### 9. Test

- Colocated `<Component>.test.tsx` next to the component file.
- Cover (at minimum): renders the right variant/size attributes, ref forwards, native props pass through, `className` merges (not replaces), the primary interaction (click / change / open).
- Use `@testing-library/react` + `@testing-library/user-event` per the repo convention.

### 10. Accessibility baseline

- Focus-visible ring on every interactive element. Use `--color-accent` for the ring.
- Keyboard parity with mouse interactions (Tab / Enter / Space / Esc / arrow keys per the WAI-ARIA pattern that fits the component).
- `aria-*` attrs accepted via prop pass-through; default `aria-*` set where the component knows the role (e.g. `aria-pressed` on toggle buttons).
- Disabled state uses `aria-disabled` in addition to native `disabled` where applicable, and visually distinguishes via tokens.

## Promotion readiness checklist

A candidate is ready to promote when:

1. Used in **2+ places** in the portal.
2. API has been **stable for ~2 weeks** (no churn).
3. **No portal-only deps** (grep-validated — see DESIGN-0001).

Promotion workflow lives in [CLAUDE.md §Promotion workflow](../../../CLAUDE.md#promotion-workflow). The currently active sweep is in [IMPL-0004 §Phase 6](../../../docs/impl/0004-build-rfc-portal-components-per-inv-0002-inventory.md#phase-6-promote-stabilized-primitives-to-donaldgifforddesign-system).
