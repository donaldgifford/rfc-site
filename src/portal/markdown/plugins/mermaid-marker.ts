import type { Plugin } from "unified";
import type { Element, Root } from "hast";
import { visit, SKIP } from "unist-util-visit";

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
//   - If the code fence had a meta string (caught earlier by
//     `capture-code-meta` and surfaced as `metastring` on the inner `<code>`),
//     inserts a sibling `<span class="mermaid-caption">…</span>` right after
//     the pre — mockup §1170-1179. Sibling rather than child so the
//     hydration step's `innerHTML = svg` doesn't clobber it, and so the
//     pre-hydration / no-JS view shows the caption too.
//
// The diagram source text is kept as the `<pre>`'s child text — that's the
// SSR-visible fallback (search engines / no-JS clients see the diagram code).

function isCodeWithLanguageMermaid(node: Element | undefined): node is Element {
  if (node?.tagName !== "code") return false;
  const classes = node.properties.className;
  if (!Array.isArray(classes)) return false;
  return classes.includes("language-mermaid");
}

function readCaption(code: Element): string | null {
  const raw = code.properties.metastring;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const mermaidMarker: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, "element", (node, index, parent) => {
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

      const caption = readCaption(child);
      if (caption !== null && parent !== undefined && index !== undefined) {
        const captionNode: Element = {
          type: "element",
          tagName: "span",
          properties: { className: ["mermaid-caption"] },
          children: [{ type: "text", value: caption }],
        };
        parent.children.splice(index + 1, 0, captionNode);
        // Skip past the inserted sibling so visit doesn't re-enter.
        return [SKIP, index + 2];
      }
      return undefined;
    });
  };
};

export default mermaidMarker;
