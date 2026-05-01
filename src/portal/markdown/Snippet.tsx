interface SnippetProps {
  html?: string | undefined;
  fallbackTerms?: readonly string[] | undefined;
}

// Phase 1 stub. Phase 6 wires a narrow rehype-parse → rehype-sanitize
// (allowlist: <em>, <mark>, <strong>, <code>) → rehype-react pipeline,
// with a plain-text fallback over `fallbackTerms` when `html` is unset.
// Phase 7 consumes this in the minimal `/search` route.
export function Snippet(_props: SnippetProps): null {
  return null;
}
