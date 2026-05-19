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
    void hydrateMermaid();
  }, [bodyHtml]);

  return (
    <article
      ref={articleRef}
      className="markdown-body"
      dangerouslySetInnerHTML={{ __html: bodyHtml }}
    />
  );
}
