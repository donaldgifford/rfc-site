import type { Root } from "mdast";
import { visit } from "unist-util-visit";

/**
 * remark plugin that lifts mdast `code.meta` (the text after the language
 * in a fenced code block) onto the resulting hast `<code metastring="…">`.
 *
 * Markdown source:
 *
 *   ```go internal/ingest/parse.go
 *   …
 *   ```
 *
 * becomes `<pre><code metastring="internal/ingest/parse.go" class="language-go">…</code></pre>`.
 *
 * `@shikijs/rehype` reads the `metastring` property in its PreHandler and
 * surfaces it as `this.options.meta.__raw` inside transformers, which is
 * where the Shiki transformer in `pipeline.ts` picks it up and attaches
 * `data-caption` to `<pre>`.
 *
 * Without this hop the meta string is dropped at the mdast → hast
 * boundary (`mdast-util-to-hast` doesn't propagate it by default).
 */
export function captureCodeMeta() {
  return (tree: Root): void => {
    visit(tree, "code", (node) => {
      const meta = node.meta?.trim();
      if (meta === undefined || meta.length === 0) return;
      node.data ??= {};
      const data = node.data as { hProperties?: Record<string, unknown> };
      data.hProperties ??= {};
      data.hProperties.metastring = meta;
    });
  };
}
