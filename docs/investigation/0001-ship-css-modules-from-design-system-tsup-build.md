---
id: INV-0001
title: "Ship CSS Modules from design-system tsup build"
status: Resolved
author: Donald Gifford
created: 2026-04-28
---
<!-- markdownlint-disable-file MD025 MD041 -->

# INV 0001: Ship CSS Modules from design-system tsup build

**Status:** Resolved (2026-04-28) — adopted **option 3** (drop CSS Modules
for `<Badge>`, ship prefixed global classes via side-effect CSS import).
**Author:** Donald Gifford
**Date:** 2026-04-28

<!--toc:start-->
- [Question](#question)
- [Hypothesis](#hypothesis)
- [Context](#context)
- [Approach](#approach)
- [Environment](#environment)
- [Findings](#findings)
- [Conclusion](#conclusion)
- [Recommendation](#recommendation)
- [References](#references)
<!--toc:end-->

## Question

Can `@donaldgifford/design-system`'s current tsup build emit CSS Modules
in a form that consumers can use, so primitives like `<Badge>` (Phase 5
ds-candidate, Phase 6 first promotion target) can ship per
[design-system DESIGN-0002 §Styling internals][design-system-design-0002]
without changing the bundler?

Concretely: when a primitive does `import styles from "./Badge.module.css"`,
does the published `dist/index.js` resolve `styles.badge` to a scoped
class name at runtime, and does `dist/index.css` contain the matching
scoped rule?

## Hypothesis

tsup's default config does **not** compile CSS Modules. The published
JS will contain `var Badge_default = {}` (an empty object), so
`styles.badge` is `undefined` at runtime and the primitive renders
without its base styles. esbuild — tsup's underlying bundler — has a
`local-css` loader (since 0.21) that scopes class names, so the fix is
either to wire that loader through tsup, or to switch bundlers.

## Context

Phase 6 of [IMPL-0001](../impl/0001-bootstrap-portal-scaffold-per-design-0001.md)
promotes `<Badge>` from rfc-site's `ds-candidates/` into design-system's
`src/primitives/Badge/`. The promotion failed local validation when
the design-system build pipeline turned out to silently drop the
CSS Module class map.

**Triggered by:** [IMPL-0001 §Phase 6][impl-phase-6] — first ds-candidate
promotion. Surfaced during the local cherry-pick onto
`donaldgifford/design-system@feat/promote-badge`.

## Approach

1. Branch design-system at `feat/promote-badge`; copy
   `Badge.{tsx,module.css,test.tsx}` + `index.ts` from rfc-site
   (test moved to `tests/primitives/Badge.test.tsx`); add
   `clsx`; re-export from `src/index.ts`.
2. Add `src/types/css-modules.d.ts` with the ambient declaration
   so `tsc --noEmit` can type the CSS Module import (rfc-site gets
   this for free via `vite/client`).
3. Run `pnpm build` and inspect `dist/index.js` + `dist/index.css`
   to see whether class names are scoped and whether the JS
   resolves them at runtime.
4. Try wiring esbuild's `local-css` loader via `tsup.config.ts`
   `loader: { ".module.css": "local-css" }` and re-run.

## Environment

| Component | Version / Value |
|-----------|-----------------|
| design-system branch | `feat/promote-badge` (off `main` @ `36f4357`) |
| `tsup` | 8.5.1 |
| `esbuild` (transitive) | 0.27.7 |
| Node | 22.22.2 (mise-pinned) |
| `pnpm` | 10.33.2 |

## Findings

### Observation 1 — DTS build needs an ambient declaration

Without `src/types/css-modules.d.ts`, `tsc --noEmit` fails:

```
src/primitives/Badge/Badge.tsx(28,20): error TS2307:
  Cannot find module './Badge.module.css' or its
  corresponding type declarations.
```

Adding the ambient declaration unblocks the DTS step. **This is a
small, mergeable change independent of the bundler decision.**

### Observation 2 — tsup emits CSS but not the JS class map

After `pnpm build`, `dist/index.js` contains:

```js
// src/primitives/Badge/Badge.module.css
var Badge_default = {};
// ...
className: clsx(Badge_default.badge, className),
```

`Badge_default` is an empty object — `styles.badge` resolves to
`undefined` at runtime. The primitive renders with only the
consumer-supplied `className` (no base styles).

`dist/index.css` is emitted with the rules:

```css
/* src/primitives/Badge/Badge.module.css */
.badge {
  display: inline-flex;
  /* ... */
}
.badge[data-size=sm] { /* ... */ }
```

Class name is unscoped (`.badge`, not `.Badge_badge_xxxxx`). Two
primitives that both used `.title` or `.button` would collide.

### Observation 3 — `loader: { ".module.css": "local-css" }` doesn't take effect

Setting esbuild's `local-css` loader in `tsup.config.ts`:

```ts
loader: {
  ".module.css": "local-css",
}
```

did **not** change the output — `dist/index.js` still has
`var Badge_default = {}` and `dist/index.css` still has the unscoped
class names. tsup ships its own `.css` plugin that intercepts the
file before esbuild's loader resolution can apply, so this knob
isn't reachable via the tsup config alone.

## Conclusion

**Answer: No.** The current tsup build cannot ship usable CSS Modules.
DESIGN-0002's `<Component>.module.css` co-location pattern is correct
in spirit, but the published artefact wires up an empty class map at
runtime so primitives render without their base styles.

## Recommendation

Three options, ordered by estimated effort:

1. **Switch design-system's bundler to Vite library mode.** Vite has
   first-class CSS Modules support (`*.module.css` → scoped JS class map
   + emitted CSS) and matches what consumers (rfc-site is on Vite) use.
   Trade-off: design-system gains a bundler that's heavier than tsup,
   but the diff is small and the dual-format ESM+CJS+DTS surface is
   well-supported (`vite-plugin-dts` + `vite build --watch` for dev).
   *Recommended first move.*

2. **Pre-compile CSS Modules with a custom script** before tsup runs.
   Use `postcss` + `postcss-modules` to transform each
   `*.module.css` into a scoped CSS file plus a JSON map; rewrite the
   imports during a build prelude. Less invasive than (1), but adds
   maintenance surface and bespoke tooling.

3. **Drop CSS Modules for primitives** and use prefixed global classes
   (`.ds-badge`, `.ds-badge--sm`). This requires editing DESIGN-0002 and
   re-shaping the Phase 5 candidate API (no more `styles.badge`
   pattern). Smallest tooling delta, largest spec / contract delta.

Independently of the bundler decision, the
`src/types/css-modules.d.ts` ambient declaration (Observation 1) is a
no-cost win — land it now so future primitives don't trip the same
DTS error.

This INV blocks the design-system half of [IMPL-0001 §Phase
6][impl-phase-6]. The rfc-site side (`bun update`, swap imports,
delete the `ds-candidate`) cannot proceed until a published
`@donaldgifford/design-system@0.x.0` ships a working `<Badge>`.

## Decision (2026-04-28)

**Adopted option 3** — drop CSS Modules for `<Badge>`, ship prefixed
global classes via a side-effect CSS import.

**Rationale.** Option 3 unblocks Phase 6 with the smallest reversible
delta. Options 1 (Vite library-mode) and 2 (custom postcss-modules
prelude) are both larger surgery on a single-primitive promotion: the
former retunes the entire bundler, the latter adds bespoke build
tooling. The contract delta from option 3 is also smaller than feared
— DESIGN-0002 documents `*.module.css` as the *internal* shape of the
primitive, not part of the consumer-facing API. Consumers still call
`<Badge status="accepted" />`; the only change is that the class
applied internally is `ds-badge` (a stable, prefixed, public class)
rather than a hashed CSS-Module class.

**Concrete shape (now landed in design-system `feat/promote-badge`):**

- `src/primitives/Badge/Badge.tsx` does `import "./Badge.css"` (side
  effect; no class-map binding) and `clsx("ds-badge", className)`.
- `src/primitives/Badge/Badge.css` defines `.ds-badge` plus
  `[data-status="…"]` / `[data-size="…"]` attribute-selector variants.
  Tokens-only (`var(--*)`).
- `dist/index.css` (verified locally) contains the literal `.ds-badge`
  selectors. `dist/index.js` contains the literal string in the
  `clsx(...)` call. The runtime mismatch from Finding 4 is gone.
- `src/types/css-modules.d.ts` was deleted (no `*.module.css` imports
  remain in design-system source). It can be re-introduced cheaply if
  options 1 or 2 are revisited later.

**Why this is reversible.** If we later want CSS Modules back (e.g.,
to avoid the `.ds-` namespace constraint), we can pursue option 1 or
2 incrementally — the public API of `<Badge>` (`status`, `size`,
`className` merge, `forwardRef`, native span pass-through) is
identical between the two shapes, so a future bundler swap doesn't
change anything consumers depend on.

**Follow-ups deliberately not done in this INV:**

- Editing DESIGN-0002. The doc describes the internal styling
  approach as `*.module.css` co-location; that's still aspirational
  for primitives that don't have the `tsup` constraint (e.g.,
  internal-only utilities). When primitive #2 lands and the bundler
  decision becomes real, DESIGN-0002 should be updated then. For
  now the option-3 deviation is documented here.
- A sibling INV / RFC for choosing the long-run bundler. Defer until
  a second primitive forces the decision; one data point isn't enough.

## References

- [IMPL-0001 §Phase 6](../impl/0001-bootstrap-portal-scaffold-per-design-0001.md#phase-6-first-promotion)
- [design-system DESIGN-0002 §Styling internals][design-system-design-0002]
- [esbuild release notes — `local-css` loader (0.21)](https://esbuild.github.io/api/#loader)
- [tsup CSS handling source](https://github.com/egoist/tsup) (intercepts `.css` before esbuild loader resolution)
- WIP branch: `donaldgifford/design-system@feat/promote-badge` (uncommitted at the time of writing — pickup with `git switch feat/promote-badge`)

[design-system-design-0002]: https://github.com/donaldgifford/design-system/blob/main/docs/design/0002-primitive-component-api-conventions.md
[impl-phase-6]: ../impl/0001-bootstrap-portal-scaffold-per-design-0001.md#phase-6-first-promotion
