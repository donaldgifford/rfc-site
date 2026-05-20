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

export async function hydrateMermaid(): Promise<void> {
  if (typeof document === "undefined") return;

  const blocks = Array.from(document.querySelectorAll<HTMLPreElement>(MERMAID_SELECTOR));
  if (blocks.length === 0) return;

  let mermaid: typeof MermaidModule;
  try {
    const mod = await import("mermaid");
    mermaid = mod.default;
  } catch (err) {
    console.error("[mermaid-hydrate] failed to load mermaid:", err);
    return;
  }

  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    securityLevel: "strict",
    themeVariables: mermaidThemeFromTokens(),
  });

  for (const block of blocks) {
    const source = block.textContent.trim();
    if (source.length === 0) {
      block.removeAttribute("data-mermaid-source");
      continue;
    }
    try {
      const id = `mermaid-${Math.random().toString(36).slice(2, 10)}`;
      const { svg } = await mermaid.render(id, source);
      block.innerHTML = svg;
      block.classList.add("mermaid-diagram");
      block.removeAttribute("data-mermaid-source");
    } catch (err) {
      console.error("[mermaid-hydrate] render failed:", err);
      // Leave the source text in place so the diagram code is still
      // visible. The retry path is a route change — `data-mermaid-source`
      // stays on the element so a future hydrate call can try again.
    }
  }
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

  const bgBase = read("--bg-base", "#0c1017");
  const bgRaised = read("--bg-raised", "#121722");
  const bgElevated = read("--bg-elevated", "#181e2b");
  const borderStrong = read("--border-strong", "#34405a");
  const fgPrimary = read("--fg-primary", "#e8ebf0");
  const fgSecondary = read("--fg-secondary", "#afb6c2");
  const fgTertiary = read("--fg-tertiary", "#7a8396");
  const fontMono = read("--font-mono", "monospace");

  // mermaid's `base` theme derives many colours from `primaryColor` when
  // we don't override them — that's how we ended up with bright accent-
  // blue borders + arrows + text in the prior pass. Set every flowchart-
  // relevant slot explicitly so the rendered diagram matches mockup
  // §1157-1167: dark fills, visible-but-quiet borders, light text,
  // muted (not accent) line colour.
  return {
    primaryColor: bgElevated,
    primaryBorderColor: borderStrong,
    primaryTextColor: fgPrimary,
    secondaryColor: bgRaised,
    secondaryBorderColor: borderStrong,
    secondaryTextColor: fgPrimary,
    tertiaryColor: bgBase,
    tertiaryBorderColor: borderStrong,
    tertiaryTextColor: fgPrimary,
    // Flowchart-specific aliases — some mermaid versions read these
    // rather than the primary slots above.
    mainBkg: bgElevated,
    nodeBorder: borderStrong,
    nodeTextColor: fgPrimary,
    // Lines + arrows: muted grey, not the bright accent.
    lineColor: fgTertiary,
    defaultLinkColor: fgTertiary,
    arrowheadColor: fgTertiary,
    // Edge labels: readable mono on the page bg.
    edgeLabelBackground: bgBase,
    labelTextColor: fgSecondary,
    // Subgraph cluster.
    clusterBkg: bgRaised,
    clusterBorder: borderStrong,
    titleColor: fgPrimary,
    fontFamily: fontMono,
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
    secondaryTextColor: "#e8ebf0",
    tertiaryColor: "#0c1017",
    tertiaryBorderColor: "#34405a",
    tertiaryTextColor: "#e8ebf0",
    mainBkg: "#181e2b",
    nodeBorder: "#34405a",
    nodeTextColor: "#e8ebf0",
    lineColor: "#7a8396",
    defaultLinkColor: "#7a8396",
    arrowheadColor: "#7a8396",
    edgeLabelBackground: "#0c1017",
    labelTextColor: "#afb6c2",
    clusterBkg: "#121722",
    clusterBorder: "#34405a",
    titleColor: "#e8ebf0",
    fontFamily: "monospace",
    fontSize: "13px",
  };
}
