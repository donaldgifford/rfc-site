import type { Element } from "hast";
import type { PluggableList } from "unified";

import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeShiki from "@shikijs/rehype";
import rehypeSanitize, { defaultSchema, type Options as SanitizeOptions } from "rehype-sanitize";

const defaultAttrs = defaultSchema.attributes ?? {};
const defaultStarAttrs = defaultAttrs["*"] ?? [];
const defaultATagAttrs = defaultAttrs.a ?? [];
const defaultCodeAttrs = defaultAttrs.code ?? [];
const defaultPreAttrs = defaultAttrs.pre ?? [];
const defaultSpanAttrs = defaultAttrs.span ?? [];
const defaultTagNames = defaultSchema.tagNames ?? [];

// Sanitize allowlist that extends rehype-sanitize's GFM-extended defaults
// to permit:
//   - Shiki's inline `style` attributes on <pre>/<code>/<span>
//   - Shiki's `tabIndex`, `dataLanguage` on <pre>
//   - heading anchor classes on <a> (prepended by rehype-autolink-headings)
//   - `dataMermaidSource` on <pre> (set by Phase 3's mermaid-marker plugin)
//   - <mark> for search-snippet rendering (Phase 6)
//
// The sanitizer is the LAST line of defence — even though `rfc-api` validates
// markdown at ingest, we must assume the body could be hostile.
export const sanitizeSchema: SanitizeOptions = {
  ...defaultSchema,
  tagNames: [...defaultTagNames, "mark"],
  attributes: {
    ...defaultAttrs,
    "*": [...defaultStarAttrs, "className", "id"],
    a: [...defaultATagAttrs, "ariaHidden", ["className", /^heading-anchor$/]],
    code: [...defaultCodeAttrs, "style", "dataLanguage"],
    pre: [...defaultPreAttrs, "tabIndex", "style", "dataLanguage", "dataMermaidSource"],
    span: [...defaultSpanAttrs, "style", "className"],
  },
};

function elementText(node: Element): string {
  let out = "";
  for (const child of node.children) {
    if (child.type === "text") {
      out += child.value;
    } else if (child.type === "element") {
      out += elementText(child);
    }
  }
  return out;
}

// Plugins consumed by `react-markdown`'s `remarkPlugins` prop.
// `remark-parse` / `remark-rehype` are owned by react-markdown itself.
// Phase 3 will splice in `strip-docz-boilerplate` before `remark-rehype`.
export const remarkPlugins: PluggableList = [remarkGfm];

// Plugins consumed by `react-markdown`'s `rehypePlugins` prop.
// Order is load-bearing: slug → autolink (so the anchor sees the id) →
// shiki (syntax highlighting) → sanitize (last). Phase 3 splices
// `mermaid-marker` between `slug` chain and `shiki` so mermaid blocks
// bypass syntax highlighting.
export const rehypePlugins: PluggableList = [
  rehypeSlug,
  [
    rehypeAutolinkHeadings,
    {
      behavior: "prepend" as const,
      properties: (node: Element) => ({
        className: ["heading-anchor"],
        ariaLabel: `Permalink to ${elementText(node).trim()}`,
      }),
    },
  ],
  [
    rehypeShiki,
    {
      themes: { light: "github-light", dark: "github-dark" },
    },
  ],
  [rehypeSanitize, sanitizeSchema],
];
