import { createContext, Suspense, useContext, useMemo } from "react";
import { MarkdownHooks } from "react-markdown";

import type { Document } from "../api/__generated__/model";
import type { Link as DocLink } from "../api/__generated__/model";
import { remarkPlugins, rehypePlugins } from "./pipeline";

import "./styles.css";

const LinksContext = createContext<readonly DocLink[]>([]);

/**
 * Phase 4 will read this in `<Anchor>` to resolve markdown anchor `href`s
 * against the document's `links[]` array (per DESIGN-0002 §Cross-document
 * link resolution and CLAUDE.md §Hard rules).
 */
export function useDocumentLinks(): readonly DocLink[] {
  return useContext(LinksContext);
}

interface DocumentViewProps {
  document: Document;
}

export function DocumentView({ document }: DocumentViewProps) {
  const links = useMemo(() => document.links ?? [], [document.links]);

  // `@shikijs/rehype` does async work (theme/lang loading), so we use
  // `MarkdownHooks` (React 19 `use()`-backed) and wrap in Suspense so SSR
  // streams the rendered HTML once the highlighter has resolved.
  return (
    <LinksContext.Provider value={links}>
      <article className="markdown-body">
        <Suspense fallback={null}>
          <MarkdownHooks remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
            {document.body ?? ""}
          </MarkdownHooks>
        </Suspense>
      </article>
    </LinksContext.Provider>
  );
}
