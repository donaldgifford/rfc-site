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
  return {
    primaryColor: read("--bg-raised", "#1a1d28"),
    primaryTextColor: read("--fg-primary", "#e0e6ed"),
    primaryBorderColor: read("--border-hairline", "#2a2f3a"),
    lineColor: read("--accent", "#7aa2f7"),
    secondaryColor: read("--bg-elevated", "#161922"),
    tertiaryColor: read("--bg-base", "#0b0e0d"),
    fontFamily: read("--font-mono", "monospace"),
    fontSize: "13px",
  };
}

function defaultMermaidTheme(): Record<string, string> {
  return {
    primaryColor: "#1a1d28",
    primaryTextColor: "#e0e6ed",
    primaryBorderColor: "#2a2f3a",
    lineColor: "#7aa2f7",
    secondaryColor: "#161922",
    tertiaryColor: "#0b0e0d",
    fontFamily: "monospace",
    fontSize: "13px",
  };
}
