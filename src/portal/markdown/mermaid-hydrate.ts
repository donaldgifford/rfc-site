/**
 * Client-side mermaid hydration (IMPL-0006 Phase 3).
 *
 * After the server-side render lands in the DOM via
 * `dangerouslySetInnerHTML`, every `<pre data-mermaid-source>` block
 * carries the diagram source as its text content (set upstream by the
 * `mermaid-marker` rehype plugin). This module finds those placeholders
 * and replaces them with rendered SVG.
 *
 * Design constraints:
 *
 *   - **Lazy import** — `await import("mermaid")` only happens when a
 *     mermaid block is present. The ~700 KB library doesn't ship on
 *     non-mermaid pages.
 *   - **Token-driven theme** — mermaid's `themeVariables` are read from
 *     the current `data-theme="dark"` CSS custom properties, so the
 *     palette stays in lockstep with the rest of the site (mockup
 *     §1157-1167).
 *   - **Idempotent** — `data-mermaid-source` is removed after a
 *     successful render so re-calling the helper after a route change
 *     only touches the new (still-marked) blocks.
 *   - **Failure-tolerant** — render errors `console.error` but keep the
 *     original source text visible, so the reader never sees a blank
 *     box.
 */

import type MermaidModule from "mermaid";

const MERMAID_SELECTOR = "pre[data-mermaid-source]";

// Module-scoped cache of rendered SVG keyed by source text. The
// `<DocumentView>` MutationObserver pattern (and React.StrictMode's
// dev-mode double-mount) cause `hydrateMermaid` to run multiple times
// against the same diagram source. Without a cache each call paid the
// full `mermaid.render` cost, producing a visible flash of the source
// text before the second render landed.
const SVG_CACHE = new Map<string, string>();

function applySvgToBlock(block: HTMLPreElement, svg: string): void {
  block.innerHTML = svg;
  block.classList.add("mermaid-diagram");
  block.removeAttribute("data-mermaid-source");
}

export async function hydrateMermaid(): Promise<void> {
  if (typeof document === "undefined") return;

  const blocks = Array.from(document.querySelectorAll<HTMLPreElement>(MERMAID_SELECTOR));
  if (blocks.length === 0) return;

  // Cache-hit synchronous path: serve any block whose source we've
  // already rendered before this turn yields to mermaid's async
  // import — avoids the flash.
  const pendingBlocks: Array<{ block: HTMLPreElement; source: string }> = [];
  for (const block of blocks) {
    const source = block.textContent.trim();
    if (source.length === 0) {
      block.removeAttribute("data-mermaid-source");
      continue;
    }
    const cached = SVG_CACHE.get(source);
    if (cached !== undefined) {
      applySvgToBlock(block, cached);
      continue;
    }
    pendingBlocks.push({ block, source });
  }
  if (pendingBlocks.length === 0) return;

  let mermaid: typeof MermaidModule;
  try {
    const mod = await import("mermaid");
    mermaid = mod.default;
  } catch (err) {
    console.error("[mermaid-hydrate] failed to load mermaid:", err);
    return;
  }

  // `securityLevel: "loose"` renders the SVG inline. The previous "strict"
  // value wraps the SVG in a sandboxed iframe whose `srcdoc` HTML doesn't
  // surface visibly when assigned to `innerHTML` on a `<pre>`. The mermaid
  // source comes from rfc-api's already-sanitised markdown body, so the
  // extra iframe sandbox doesn't buy us anything.
  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    securityLevel: "loose",
    themeVariables: mermaidThemeFromTokens(),
  });

  for (const { block, source } of pendingBlocks) {
    try {
      const id = `mermaid-${Math.random().toString(36).slice(2, 10)}`;
      const { svg } = await mermaid.render(id, source);
      SVG_CACHE.set(source, svg);
      applySvgToBlock(block, svg);
    } catch (err) {
      console.error("[mermaid-hydrate] render failed:", err);
      // Leave the source text in place so the diagram code is still
      // visible. The retry path is a route change — `data-mermaid-source`
      // stays on the element so a future hydrate call can try again.
    }
  }
}

/** Test-only — flush the SVG cache between runs. */
export function _clearMermaidCache(): void {
  SVG_CACHE.clear();
}

/**
 * Builds the `themeVariables` object for `mermaid.initialize` from the
 * current document's CSS custom properties. Each token has a fallback
 * so SSR/jsdom contexts (where `getComputedStyle` may return empty
 * strings) produce a valid theme.
 *
 * Minimal flowchart-targeted set today — mermaid's full theme variable
 * surface is large; extend here when other diagram types need
 * additional knobs.
 */
export function mermaidThemeFromTokens(): Record<string, string> {
  if (typeof document === "undefined") {
    return defaultMermaidTheme();
  }
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string): string => {
    const value = style.getPropertyValue(name).trim();
    return value.length > 0 ? value : fallback;
  };

  const bgRaised = read("--bg-raised", "#121722");
  const bgElevated = read("--bg-elevated", "#181e2b");
  const borderStrong = read("--border-strong", "#34405a");
  const fgPrimary = read("--fg-primary", "#e8ebf0");
  const fgTertiary = read("--fg-tertiary", "#7a8396");

  // Stick to the documented mermaid v11 theme variables. Earlier we
  // experimented with extras (`nodeTextColor`, `arrowheadColor`,
  // `labelTextColor`, plus passing the full CSS font-mono stack with
  // embedded quotes); that broke `mermaid.render` silently and left
  // the source text visible. Minimal set, ASCII font name.
  //
  // The contrast goal (mockup §1157-1167): dark node fill, visible-but-
  // quiet borders, light text, muted (not accent) arrows. The previous
  // bright-cyan-everywhere rendering came from `lineColor: --accent`
  // plus mermaid deriving `nodeBorder` from `primaryColor` for lack of
  // an explicit override.
  return {
    primaryColor: bgElevated,
    primaryBorderColor: borderStrong,
    primaryTextColor: fgPrimary,
    secondaryColor: bgRaised,
    secondaryBorderColor: borderStrong,
    tertiaryColor: bgRaised,
    tertiaryBorderColor: borderStrong,
    mainBkg: bgElevated,
    nodeBorder: borderStrong,
    lineColor: fgTertiary,
    clusterBkg: bgRaised,
    clusterBorder: borderStrong,
    titleColor: fgPrimary,
    fontFamily: "monospace",
    fontSize: "13px",
  };
}

function defaultMermaidTheme(): Record<string, string> {
  return {
    primaryColor: "#181e2b",
    primaryBorderColor: "#34405a",
    primaryTextColor: "#e8ebf0",
    secondaryColor: "#121722",
    secondaryBorderColor: "#34405a",
    tertiaryColor: "#121722",
    tertiaryBorderColor: "#34405a",
    mainBkg: "#181e2b",
    nodeBorder: "#34405a",
    lineColor: "#7a8396",
    clusterBkg: "#121722",
    clusterBorder: "#34405a",
    titleColor: "#e8ebf0",
    fontFamily: "monospace",
    fontSize: "13px",
  };
}
