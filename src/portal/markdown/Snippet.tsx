import { Fragment, useMemo, type ReactElement } from "react";
import type { Root } from "hast";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { jsx, jsxs } from "react/jsx-runtime";
import rehypeParse from "rehype-parse";
import rehypeSanitize, { type Options as SanitizeOptions } from "rehype-sanitize";
import { unified } from "unified";

interface SnippetProps {
  html?: string | undefined;
  fallbackTerms?: readonly string[] | undefined;
}

// Strict allowlist for `SearchResult.snippet` HTML — only the inline
// formatting tags `rfc-api` is contractually allowed to emit (per
// DESIGN-0002 §Search-snippet rendering). Everything else (links,
// images, blocks, scripts) is stripped.
const SNIPPET_SCHEMA: SanitizeOptions = {
  tagNames: ["em", "strong", "mark", "code"],
  attributes: {},
  protocols: {},
  // No clobber rewriting — the input is fragment HTML with no ids.
  clobber: [],
  clobberPrefix: "",
};

const snippetProcessor = unified()
  .use(rehypeParse, { fragment: true })
  .use(rehypeSanitize, SNIPPET_SCHEMA);

function renderSnippetHtml(html: string): ReactElement {
  const tree: Root = snippetProcessor.runSync(snippetProcessor.parse(html));
  // hast-util-to-jsx-runtime returns `JSX.Element`. Under React 19's
  // automatic JSX runtime, that's structurally a `ReactElement`, but the
  // upstream type uses a `// @ts-ignore` to defer to JSX so TypeScript
  // can't narrow it cleanly. Cast via unknown.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return toJsxRuntime(tree, { Fragment, jsx, jsxs });
}

/**
 * Search-result snippet renderer.
 *
 * Renders trusted-but-sanitized HTML from `SearchResult.snippet` (per the
 * OpenAPI contract, the snippet may contain `<em>` / `<strong>` / `<mark>`
 * / `<code>` for query-term highlights — anything else is unexpected and
 * gets stripped).
 *
 * Falls back to a plain-text rendering of `fallbackTerms` when `html` is
 * unset or empty — handy for a11y tooling, RSS, or any consumer that
 * doesn't want HTML.
 */
export function Snippet({ html, fallbackTerms }: SnippetProps) {
  const rendered = useMemo(() => {
    if (typeof html === "string" && html.length > 0) {
      return renderSnippetHtml(html);
    }
    return null;
  }, [html]);

  if (rendered !== null) {
    return <span className="snippet">{rendered}</span>;
  }

  if (fallbackTerms && fallbackTerms.length > 0) {
    return <span className="snippet snippet--fallback">{fallbackTerms.join(", ")}</span>;
  }

  return null;
}
