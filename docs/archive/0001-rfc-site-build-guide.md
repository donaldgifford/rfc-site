# RFC-Site Build Guide (IMPL-0001 Phase 6, greenfield)

**Status:** active — this is the primary guide for building the
`rfc-site` portal as the first consumer of `@donaldgifford/design-system`.

This document is the **guardrail** for the portal build. Read it before
opening the portal repo and again before you write a `<Button>` from
scratch. It encodes the rollout strategy from RFC-0002, the binding
constraints from ADR-0002 / ADR-0004 / DESIGN-0001 / DESIGN-0002, and
the lessons we want to bake in upfront so we don't walk back into the
inconsistency RFC-0002 was created to solve.

## Goals

- Get the portal rendering RFC pages quickly, using the design system's
  tokens and theme contract from day one.
- Set up the portal so that promoting components into the design
  system is a copy-and-paste, not a rewrite.
- Avoid two parallel token systems, two theme switchers, two `Button`
  implementations, or a creeping Radix Themes / shadcn / Material
  dependency that would silently displace the design system.

## Non-Goals

- This is **not** an IMPL plan for the design system itself. The
  design-system roadmap lives in IMPL-0001 (done) and the future
  IMPL-0002 (primitives — not yet written; written *after* the portal
  has surfaced real component needs).
- This guide does not specify portal features (RFC rendering rules,
  search, auth, etc.). Those belong in the portal's own RFCs.
- This guide does not prescribe routing or Markdown-rendering library
  choices — those are portal-local concerns. It only says you'll need
  to choose one.

## Strategy: portal first, primitives follow

Per **RFC-0002 §Rollout step 2** — *"Iterate on the primitive APIs
with the portal as the live consumer. Breaking changes are cheap while
there is only one consumer."*

The failure mode this avoids: building Button/Heading/Card APIs in the
design system *by anticipation*, shipping `0.2.0`, then discovering
weeks into portal work that half the props are wrong, slot composition
doesn't fit, and the variants don't match real RFC-page needs. We
want primitives shaped by **actual use**, not speculation.

So:

1. Build the portal now with components inline.
2. Once a component has stabilized in the portal, promote it into
   `@donaldgifford/design-system` as part of IMPL-0002.
3. Portal swaps its inline import for the package import.
4. Repeat.

A component is **ready to promote** when:

- It's used in **2+ places** in the portal (use is the validator).
- The API hasn't churned for ~2 weeks of active development.
- You'd push back on adding a new variant/size/state without a
  concrete reason.
- It does not depend on portal-only concerns (routing, page layout,
  data fetching, Markdown rendering).

## Initial setup

### 1. Tooling

- **Runtime:** Bun (latest stable).
- **Language:** TypeScript strict mode (mirror this repo's
  `tsconfig.json` defaults — `target: ES2022`, `moduleResolution: bundler`).
- **Framework:** React 19. The design system's peer dep is
  `^18 || ^19` (optional), so React 19 is the path of least friction.
- **Bundler:** Bun's bundler is fine; Vite is also fine. Either reads
  the `tokens.css` import correctly.
- **Linting / formatting:** ESLint v9 flat config + Prettier (100-col,
  semi, double quotes, trailing commas) — mirror this repo so promoted
  components don't churn on style.
- **Testing:** vitest + jsdom + @testing-library/react. Same stack as
  this repo so promoted tests run as-is.

### 2. GitHub Packages auth

The design system publishes to GitHub Packages. The portal needs
authenticated install.

Add `bunfig.toml` to the portal repo (commit it):

```toml
[install.scopes]
"@donaldgifford" = { token = "$NPM_TOKEN", url = "https://npm.pkg.github.com/" }
```

Bun also reads `.npmrc` for legacy compatibility, so this also works:

```ini
@donaldgifford:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

Pick one — don't commit both.

For local installs, export `NPM_TOKEN` (a GitHub PAT with the
`read:packages` scope) in your shell. For the portal's CI, add
`NPM_TOKEN` as a repo secret. If the portal lives under the same
`donaldgifford` GitHub owner, wire `NPM_TOKEN: ${{ secrets.GITHUB_TOKEN }}`
in the install step's env — the auto-provided token already has
`read:packages`. For repos under a different owner, mint a PAT.

### 3. Install the design system

```bash
bun add @donaldgifford/design-system@0.1.0
```

Pin without a caret for the first install. The first upgrade is a
deliberate decision rather than a passive bump.

### 4. Wire up the tokens stylesheet

Import the stylesheet **once** at the app root. This is what defines
every CSS custom property the rest of your code (and any future
imported primitive) reads:

```tsx
// src/main.tsx (or equivalent entry)
import "@donaldgifford/design-system/tokens.css";
```

After this import, `var(--color-bg-raised)`, `var(--font-size-14)`,
`var(--space-12)` etc. are all globally available. Do not redefine
these in app CSS.

### 5. Wire up `useTheme`

```tsx
import { useTheme } from "@donaldgifford/design-system/theme";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button type="button" onClick={toggleTheme} aria-pressed={theme === "light"}>
      Switch to {theme === "dark" ? "light" : "dark"} mode
    </button>
  );
}
```

The hook handles `data-theme` mutation, `localStorage` persistence
(key `"design-system:theme"`), `prefers-color-scheme` first-load
fallback, and SSR safety. Do not roll your own theme switcher.

### 6. Set the dark default explicitly (optional but recommended)

The stylesheet declares the dark palette under both `:root` and
`:root[data-theme="dark"]`, so consumers who never set `data-theme`
get dark by default. If you want to be explicit:

```html
<html data-theme="dark">
```

## Portal repo layout

```
src/
  components/
    ds-candidates/         ← extract-ready components (see below)
      Button/
        Button.tsx
        Button.module.css
        index.ts
      Heading/
        ...
    portal/                ← portal-only components (page chrome, etc.)
  pages/                   ← route-bound page components
  routes/                  ← router config
  styles/                  ← portal-local CSS only (NEVER tokens)
  main.tsx                 ← entry: imports tokens.css + mounts app
bunfig.toml
package.json
```

The `ds-candidates/` folder is the load-bearing convention. **Every
component in it must be shaped exactly like it would be in the design
system**, so promotion is `cp -r ds-candidates/Button design-system/src/primitives/Button`.
That means:

- One folder per component.
- `Button.tsx` exports the component (`forwardRef`, named export).
- `Button.module.css` co-located, references `var(--color-...)` only.
- `index.ts` re-exports.
- No imports from sibling `portal/` components, `pages/`, `routes/`,
  or app state. If a `ds-candidate` reaches into portal code, it
  doesn't belong in `ds-candidates/` yet.

## Component authoring rules

These mirror **DESIGN-0002** so promoted components don't need a
rewrite. Bake them in from the first component:

- **`forwardRef`** on every component that wraps a DOM element.
- **Native DOM prop pass-through** — spread `...rest` to the underlying
  element so consumers can attach `aria-*`, `data-*`, event handlers,
  etc. without you enumerating them.
- **`className` merges, never replaces.** Use a `cn()` helper or
  `clsx`. Consumers passing `className` should layer on top of your
  styles, not blow them away.
- **`variant` / `size` / `status` as string unions.** Never
  `isPrimary`-style booleans. Bad: `<Button isPrimary isLarge>`.
  Good: `<Button variant="solid" size="md">`.
- **CSS Modules co-located.** No CSS-in-JS runtime, no Tailwind, no
  `style={}` for things that aren't dynamic.
- **No theme branching inside components.** Don't read `theme` from
  `useTheme` and switch styles — the tokens already remap themselves
  when `data-theme` flips. If you find yourself wanting to branch on
  theme inside a component, you're missing a semantic token; add it
  to the design system instead.
- **`asChild` for composition.** When you need a primitive to render
  as a different element (e.g., `<Button asChild><Link to="/x" /></Button>`),
  use `@radix-ui/react-slot`. This is the **single sanctioned Radix
  dependency** per ADR-0002.

## What goes where

### In the design system (eventually, via promotion)

- Visual primitives: Button, Heading, Text, Box, Stack, Flex, Grid,
  Card, Input, Link, Badge, etc.
- Composite primitives that wrap Radix Primitives where interaction
  complexity demands it: Dialog, Popover, Combobox, DropdownMenu,
  Tooltip, etc.
- The Icon primitive (per ADR-0003 — Lucide-backed).
- Tokens, theme contract, contrast helpers (already shipped).

### In the portal only (never promoted)

- Routing config and route components.
- Markdown rendering pipeline.
- Page layouts (RFC index page, single-RFC page, search results, etc.).
- Authentication, data fetching, API clients.
- Anything that says "this is what the rfc-site does" — features, not
  primitives.

If you're unsure whether something belongs in `ds-candidates/` or
`portal/`, ask: **"Would a totally different internal tool — say, a
metrics dashboard — also want this exact component?"** If yes, it's a
candidate. If no, it's portal-local.

## Local development with the design system

When you're iterating on both repos at once (e.g., realizing the
`useTheme` hook is missing a feature you need, or a token is wrong):

```bash
# In design-system repo
bun link
# (or: pnpm link --global)

# In rfc-site repo
bun link @donaldgifford/design-system
```

Now changes in this repo are visible in the portal without a publish.
Remember to:

1. **Run `pnpm build`** in this repo after edits — the portal imports
   from `dist/`, not source.
2. **Add a changeset** in this repo for any user-visible change you
   make during the linked dev session, so it actually ships in the
   next release rather than only working locally.
3. **Unlink before final testing** (`bun unlink @donaldgifford/design-system`,
   then `bun install`) — confirm the portal works against a real
   published version, not your local copy.

## Promotion workflow

When a `ds-candidate` is ready to promote:

1. **In this repo** (`design-system`):
   - Branch off `main`: `git switch -c feat/promote-button`.
   - `cp -r` the component folder from the portal into
     `src/primitives/Button/`.
   - Add tests in `tests/primitives/Button.test.tsx`.
   - Update `src/index.ts` to re-export.
   - Run `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.
   - Add a changeset (`pnpm changeset` → minor for new primitive).
   - Open PR. Merge.
   - The release workflow opens "Version Packages" → merge that →
     `0.x.0` ships to GitHub Packages.

2. **In the portal repo** (`rfc-site`):
   - `bun update @donaldgifford/design-system` to the new version.
   - Replace the `ds-candidates/Button/` import sites with
     `@donaldgifford/design-system` imports.
   - Delete `src/components/ds-candidates/Button/`.
   - Verify pages still render identically.
   - Commit, ship.

3. **In this repo, follow-up:**
   - Open IMPL-0002 if not already open, and check off the promoted
     primitive.

## Don'ts (anti-patterns)

- ❌ **Don't fork the tokens.** The portal must consume tokens from
  the package. Never copy `tokens.css` content into portal CSS.
- ❌ **Don't override design-system CSS variables in portal CSS** to
  "tweak" a color. If a token is wrong, fix it in the design system.
  If you need a new token, add it to the design system.
- ❌ **Don't add Radix Themes, shadcn/ui, Material UI, or any other
  blanket component library** as a portal dependency. ADR-0002 was
  explicit that this design system is the alternative to those — running
  one of them in parallel re-creates exactly the inconsistency we're
  solving. The single sanctioned exception is `@radix-ui/react-slot`
  per DESIGN-0002.
- ❌ **Don't roll your own theme switcher** in the portal. Use
  `useTheme`. If `useTheme` is missing a capability, file an issue
  here and add it.
- ❌ **Don't theme-branch inside components** — `if (theme === "light") …`
  in component code is a bug. The tokens handle that.
- ❌ **Don't skip the changeset** when making changes to the design
  system during linked dev — the change will silently not ship.
- ❌ **Don't promote prematurely.** Use the "ready to promote"
  checklist. A component used once, that's churned three times in a
  week, is not ready.

## References

- [RFC-0002](../rfc/0002-internal-design-system.md) — the design
  system's purpose and rollout strategy. Especially §Rollout.
- [ADR-0001](../adr/0001-distribute-design-system-via-internal-npm-registry-in-a-dedicated-repo.md)
  — distribution model.
- [ADR-0002](../adr/0002-react-tokens-as-primitive-foundation-defer-headless-libraries.md)
  — why we don't take a blanket headless-library dependency. The
  most load-bearing decision in this repo.
- [ADR-0003](../adr/0003-adopt-lucide-as-the-base-icon-set.md) —
  icon-set choice (relevant once an Icon primitive is needed).
- [ADR-0004](../adr/0004-ship-dark-and-light-themes-in-v1-with-a-token-driven-switcher.md)
  — theming strategy, `data-theme`, dark default.
- [DESIGN-0001](../design/0001-design-token-architecture.md) — the
  two-layer token model and naming conventions.
- [DESIGN-0002](../design/0002-primitive-component-api-conventions.md)
  — the primitive API contract that `ds-candidates/` components
  should already match.
- [`0001-portal-cutover-guide.md`](./0001-portal-cutover-guide.md) —
  the brownfield variant of this guide (for an *existing* portal with
  inline tokens being migrated to the package). Useful if a future
  consumer is in that situation; not what rfc-site needs.
