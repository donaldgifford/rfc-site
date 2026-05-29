import type { Element, ElementContent, Root } from "hast";
import { visit, SKIP } from "unist-util-visit";

/**
 * rehype plugin that wraps each `<pre data-language="…">` in the mockup's
 * `.codeblock` + `.codeblock-header` structure (mockup §930-973):
 *
 *   <div class="codeblock">
 *     <div class="codeblock-header">
 *       <span class="lang">go</span>
 *       <span class="caption">internal/ingest/parse.go</span>  ← optional
 *     </div>
 *     <pre data-language="go" data-caption="…">…</pre>
 *   </div>
 *
 * Skips:
 *   - `<pre data-language="mermaid">` — mermaid blocks own their container
 *     (`pre[data-mermaid-source]`) and bypass the codeblock chrome.
 *   - `<pre>` without `data-language` — plain-text fences and inline
 *     refugees stay as bare `<pre>`.
 *
 * Runs after the Shiki transformer (which sets `data-language` and, when a
 * code-fence meta string is present, `data-caption`) and before
 * `normalize-hast-properties` / `rehype-sanitize`.
 */
export default function wrapCodeblock() {
  return (tree: Root): void => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "pre") return;
      if (parent === undefined || index === undefined) return;
      const lang = readStringProperty(node.properties.dataLanguage);
      if (lang === null) return;
      if (lang === "mermaid") return;
      // Already wrapped (idempotent guard): the parent is a div.codeblock.
      if (
        parent.type === "element" &&
        parent.tagName === "div" &&
        hasClassName(parent.properties.className, "codeblock")
      ) {
        return;
      }
      const caption = readStringProperty(node.properties.dataCaption);
      const headerChildren: ElementContent[] = [
        {
          type: "element",
          tagName: "span",
          properties: { className: ["lang"] },
          children: [{ type: "text", value: lang }],
        },
      ];
      if (caption !== null) {
        headerChildren.push({
          type: "element",
          tagName: "span",
          properties: { className: ["caption"] },
          children: [{ type: "text", value: caption }],
        });
      }
      const wrapper: Element = {
        type: "element",
        tagName: "div",
        properties: { className: ["codeblock"] },
        children: [
          {
            type: "element",
            tagName: "div",
            properties: { className: ["codeblock-header"] },
            children: headerChildren,
          },
          node,
        ],
      };
      parent.children[index] = wrapper;
      return [SKIP, index];
    });
  };
}

function readStringProperty(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function hasClassName(value: unknown, target: string): boolean {
  if (typeof value === "string") return value.split(/\s+/).includes(target);
  if (Array.isArray(value)) return value.some((v) => v === target);
  return false;
}
