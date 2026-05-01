import { createContext, useContext, useMemo } from "react";
import ReactMarkdown from "react-markdown";

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

  return (
    <LinksContext.Provider value={links}>
      <article className="markdown-body">
        <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
          {document.body ?? ""}
        </ReactMarkdown>
      </article>
    </LinksContext.Provider>
  );
}
