import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";

import { attachCrossDocClickHandler } from "./cross-doc-nav";
import { hydrateMermaid } from "./mermaid-hydrate";

import "./styles.css";

interface DocumentViewProps {
  bodyHtml: string;
}

/**
 * Server-rendered Markdown body (IMPL-0006 Phase 4).
 *
 * The loader calls `renderMarkdown(doc)` and hands us the resulting HTML
 * string. We inject it via `dangerouslySetInnerHTML` (already sanitized
 * by the pipeline's `rehype-sanitize` step) so the article paints in the
 * initial HTML response — no client-side render flash on hard refresh,
 * which was the original motivation for INV-0004.
 *
 * Two post-mount effects, both keyed on `bodyHtml` so they re-run on
 * route change:
 *
 *   1. Cross-doc click delegation. The pipeline's `resolveAnchorLinks`
 *      plugin tagged cross-doc anchors with `data-cross-doc="1"`; the
 *      delegated handler intercepts those clicks and dispatches via
 *      RR7's `useNavigate` so we don't pay a full-page reload.
 *
 *   2. Mermaid hydration. `pre[data-mermaid-source]` placeholders get
 *      replaced with rendered SVG. Lazy `await import("mermaid")` only
 *      fires on pages that actually contain a mermaid block.
 */
export function DocumentView({ bodyHtml }: DocumentViewProps) {
  const articleRef = useRef<HTMLElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const node = articleRef.current;
    if (node === null) return;
    return attachCrossDocClickHandler(node, navigate);
  }, [bodyHtml, navigate]);

  useEffect(() => {
    const node = articleRef.current;
    if (node === null) return;
    void hydrateMermaid();
    // Self-healing: if React (during hydration commit or a downstream
    // re-render of `dangerouslySetInnerHTML`) recreates the article's
    // children, the `pre[data-mermaid-source]` placeholder comes back —
    // detaching our previously-mutated `<pre>` and leaving the source
    // text visible. Watch for that and re-run `hydrateMermaid` on the
    // freshly-mounted placeholder.
    const observer = new MutationObserver(() => {
      if (node.querySelector("pre[data-mermaid-source]") !== null) {
        void hydrateMermaid();
      }
    });
    observer.observe(node, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
    };
  }, [bodyHtml]);

  return (
    <article
      ref={articleRef}
      className="markdown-body"
      // `suppressHydrationWarning` tells React not to compare or touch this
      // element's children during hydration — load-bearing because
      // `hydrateMermaid` mutates `innerHTML` (replacing the
      // `<pre data-mermaid-source>` placeholder with the rendered SVG).
      // Without this flag React 19 was re-applying `dangerouslySetInnerHTML`
      // on the hydration path and clobbering the SVG injection, producing
      // the "hard refresh shows raw source, SPA nav works" symptom.
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: bodyHtml }}
    />
  );
}
