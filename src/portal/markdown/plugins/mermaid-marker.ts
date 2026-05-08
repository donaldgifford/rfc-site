import type { Plugin } from "unified";
import type { Element, Root } from "hast";
import { visit } from "unist-util-visit";

// Tags ` ```mermaid ` fenced code blocks for client-side hydration.
//
// After `remark-rehype` (which emits `<pre><code class="language-mermaid">`)
// and BEFORE `@shikijs/rehype` (so shiki doesn't try to syntax-highlight the
// diagram source — mermaid isn't a known shiki language anyway, but being
// explicit avoids future surprises).
//
// The transform:
//   - Adds `dataMermaidSource: ""` on the `<pre>` so `<MermaidBlock>` (Phase 4)
//     can find it via `pre[data-mermaid-source]`.
//   - Removes the `language-mermaid` className from the inner `<code>` so
//     no downstream plugin treats it as a highlightable block.
//
// The diagram source text is kept as the `<pre>`'s child text — that's the
// SSR-visible fallback (search engines / no-JS clients see the diagram code).

function isCodeWithLanguageMermaid(node: Element | undefined): node is Element {
  if (node?.tagName !== "code") return false;
  const classes = node.properties.className;
  if (!Array.isArray(classes)) return false;
  return classes.includes("language-mermaid");
}

const mermaidMarker: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "pre") return;
      const child = node.children.find((c): c is Element => c.type === "element");
      if (!isCodeWithLanguageMermaid(child)) return;

      node.properties.dataMermaidSource = "";

      const classes = child.properties.className;
      if (Array.isArray(classes)) {
        child.properties = {
          ...child.properties,
          className: classes.filter((c) => c !== "language-mermaid"),
        };
      }
    });
  };
};

export default mermaidMarker;
