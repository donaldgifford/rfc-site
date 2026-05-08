import type { HTMLAttributes, ReactElement, ReactNode } from "react";
import { isValidElement, type ReactNode as RN } from "react";

import { MermaidBlock } from "./MermaidBlock";

interface PreProps extends HTMLAttributes<HTMLPreElement> {
  "data-mermaid-source"?: string;
  children?: ReactNode;
}

/**
 * Recursively extract the visible text content of a React node tree —
 * used to recover the mermaid source from the children of a tagged
 * `<pre data-mermaid-source>` block, since the source was kept as
 * the inner text by the Phase 3 plugin.
 */
function extractText(node: RN): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) {
    const props = (node as ReactElement<{ children?: ReactNode }>).props;
    return extractText(props.children);
  }
  return "";
}

/**
 * Markdown `<pre>` override.
 *
 * Routes mermaid blocks (tagged with `data-mermaid-source` by the Phase 3
 * `mermaid-marker` plugin) to `<MermaidBlock>` for client-side hydration.
 * All other code blocks pass through to a plain `<pre>` so the Shiki
 * highlight markup renders unchanged.
 *
 * The wrapper shape is intentionally pre-fragmented to leave room for a
 * future copy button without re-jiggering callers (DESIGN-0002 Resolved Q3).
 */
export function Pre({ children, ...rest }: PreProps) {
  // react-markdown passes `data-mermaid-source` as a string prop; the
  // attribute presence is the marker, so any defined value qualifies.
  if (rest["data-mermaid-source"] !== undefined) {
    return <MermaidBlock source={extractText(children).trim()}>{children}</MermaidBlock>;
  }
  return <pre {...rest}>{children}</pre>;
}
