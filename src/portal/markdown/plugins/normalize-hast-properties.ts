import type { Plugin } from "unified";
import type { Root } from "hast";
import { visit } from "unist-util-visit";

// Some hast producers (notably `@shikijs/rehype` v4) emit raw HTML attribute
// names (`class`, `tabindex`, `for`) rather than hast's canonical camelCase
// property names (`className`, `tabIndex`, `htmlFor`). `hast-util-sanitize`
// looks attributes up by property name, so the raw forms get silently
// stripped.
//
// This plugin normalises a small set of well-known attributes back to the
// hast property convention so the sanitize allowlist works as expected.

const normalizeHastProperties: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, "element", (node) => {
      const props = node.properties as Record<string, unknown>;
      if (typeof props.class === "string") {
        props.className = props.class.split(/\s+/).filter(Boolean);
        props.class = undefined;
      }
      if (props.tabindex !== undefined) {
        props.tabIndex = props.tabindex;
        props.tabindex = undefined;
      }
      if (props.for !== undefined) {
        props.htmlFor = props.for;
        props.for = undefined;
      }
    });
  };
};

export default normalizeHastProperties;
