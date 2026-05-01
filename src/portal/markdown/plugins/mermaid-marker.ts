// Phase 1 stub. Phase 3 implements the rehype plugin:
//   - Walks the hast (after `remark-rehype`, before `@shikijs/rehype` so
//     shiki doesn't try to highlight the diagram source).
//   - Finds `<pre><code class="language-mermaid">` blocks.
//   - Replaces them with `<pre data-mermaid-source="<source>">` so
//     `<MermaidBlock>` can pick them up for client-side hydration.
//   - Sanitizer allowlist (Phase 3) permits `data-mermaid-source` on `<pre>`.
// See docs/design/0002-markdown-rendering-pipeline.md §Plugin chain.
export {};
