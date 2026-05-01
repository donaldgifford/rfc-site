# `src/portal/markdown/`

Renders `Document.body` (raw GFM Markdown returned by `rfc-api`) to
sanitized HTML in the SSR pass. Implements
[DESIGN-0002](../../../docs/design/0002-markdown-rendering-pipeline.md);
landed iteratively per
[IMPL-0003](../../../docs/impl/0003-wire-up-the-markdown-rendering-pipeline-per-design-0002.md).

## Public API

- `<DocumentView document={Document} />` — page-level renderer wired
  into `src/routes/$type.$id.tsx`.
- `<Snippet html={string} fallbackTerms={string[]} />` — narrow
  pipeline for `SearchResult.snippet` HTML; consumed by `/search`.

## Internal layout

- `pipeline.ts` — module-level singleton unified processor (parse → gfm
  → strip-docz-boilerplate → rehype → slug → autolink → shiki →
  mermaid-marker → sanitize).
- `components/` — react-markdown overrides (`<Anchor>`, `<Code>`,
  `<MermaidBlock>`).
- `plugins/` — custom remark / rehype plugins.
- `styles.css` — prose styling. Tokens only — see
  [CLAUDE.md §Hard rules](../../../CLAUDE.md#hard-rules-anti-patterns-to-refuse).
