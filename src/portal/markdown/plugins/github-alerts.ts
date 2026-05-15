import { visit } from "unist-util-visit";
import type { Plugin } from "unified";
import type { Blockquote, Paragraph, Root, Text } from "mdast";

const ALERT_RE = /^\[!(NOTE|WARNING|TIP|CAUTION|IMPORTANT)\]\s*\n?/i;

type AlertKind = "note" | "warning" | "tip" | "caution";

/**
 * GitHub-Flavored Alerts → admonition divs.
 *
 * Lifts the
 *
 *   > [!NOTE]
 *   > Body text
 *
 * blockquote-with-alert-marker syntax into a hast `<div class="admonition note">`
 * via mdast `data.hName` + `data.hProperties`, and prepends an
 * `<span class="adm-label">Note</span>`. Variants: note / warning / tip /
 * caution. `[!IMPORTANT]` is normalised to `note` since the mockup doesn't
 * have a dedicated visual for it.
 *
 * Mockup §1052-1154 carries the visual contract.
 *
 * The sanitize schema in `pipeline.ts` is extended to permit:
 *   - `<div class="admonition (note|warning|tip|caution)">`
 *   - `<span class="adm-label">`
 */
export const remarkGithubAlerts: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, "blockquote", (node: Blockquote) => {
      const first: Paragraph | undefined =
        node.children[0]?.type === "paragraph" ? node.children[0] : undefined;
      if (!first) return;
      const firstText: Text | undefined =
        first.children[0]?.type === "text" ? first.children[0] : undefined;
      if (!firstText) return;

      const text = firstText.value;
      const match = ALERT_RE.exec(text);
      if (!match) return;

      const rawKind = match[1]?.toLowerCase() ?? "note";
      const kind: AlertKind = rawKind === "important" ? "note" : (rawKind as AlertKind);

      // Strip the marker from the leading text node. If the text becomes
      // empty, drop the now-empty paragraph child.
      const remainder = text.slice(match[0].length);
      if (remainder.length > 0) {
        firstText.value = remainder;
      } else {
        const restChildren = first.children.slice(1);
        if (restChildren.length === 0) {
          // Remove the empty leading paragraph entirely.
          node.children.shift();
        } else {
          first.children = restChildren;
        }
      }

      // Prepend the label as a paragraph with a single `<span>`.
      const labelParagraph: Paragraph = {
        type: "paragraph",
        children: [
          {
            type: "text",
            value: kindLabel(kind),
          },
        ],
        data: {
          hName: "span",
          hProperties: { className: ["adm-label"] },
        },
      };
      node.children.unshift(labelParagraph);

      node.data = {
        ...node.data,
        hName: "div",
        hProperties: {
          className: ["admonition", kind],
        },
      };
    });
  };
};

function kindLabel(kind: AlertKind): string {
  switch (kind) {
    case "note":
      return "Note";
    case "warning":
      return "Warning";
    case "tip":
      return "Tip";
    case "caution":
      return "Caution";
  }
}
