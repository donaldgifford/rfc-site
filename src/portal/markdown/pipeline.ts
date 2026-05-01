import type { Element } from "hast";
import type { PluggableList } from "unified";

import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeShiki from "@shikijs/rehype";
import rehypeSanitize, { defaultSchema, type Options as SanitizeOptions } from "rehype-sanitize";

import normalizeHastProperties from "./plugins/normalize-hast-properties";

const defaultAttrs = defaultSchema.attributes ?? {};
const defaultStarAttrs = defaultAttrs["*"] ?? [];
const defaultATagAttrs = defaultAttrs.a ?? [];
const defaultCodeAttrs = defaultAttrs.code ?? [];
const defaultTagNames = defaultSchema.tagNames ?? [];

// `<a>`'s defaultSchema entry has `["className", "data-footnote-backref"]`.
// Because `findDefinition` picks the FIRST entry by attribute name, a second
// `["className", ...]` entry is ignored — we have to merge into one definition
// to allow both the GFM footnote class and our heading-anchor class.
type PropertyDefinition = NonNullable<SanitizeOptions["attributes"]>[string][number];
const A_CLASSNAME_DEF: PropertyDefinition = [
  "className",
  "data-footnote-backref",
  /^heading-anchor$/,
];
const aAttrsMergedClassName: PropertyDefinition[] = defaultATagAttrs.map((entry) =>
  Array.isArray(entry) && entry[0] === "className" ? A_CLASSNAME_DEF : entry,
);

// Sanitize allowlist that extends rehype-sanitize's GFM-extended defaults
// to permit:
//   - Shiki's inline `style` attributes on <pre>/<code>/<span>
//   - Shiki's `tabIndex`, `class="shiki ..."`, `class="line"` on its output
//   - heading anchor classes on <a> (prepended by rehype-autolink-headings)
//   - `dataMermaidSource` on <pre> (set by Phase 3's mermaid-marker plugin)
//   - <mark> for search-snippet rendering (Phase 6)
//
// `id` is removed from `clobber` so heading IDs render verbatim — they need
// to match `SearchResult.section_slug` references coming from `rfc-api`.
//
// The sanitizer is the LAST line of defence — even though `rfc-api` validates
// markdown at ingest, we must assume the body could be hostile.
export const sanitizeSchema: SanitizeOptions = {
  ...defaultSchema,
  clobber: ["ariaDescribedBy", "ariaLabelledBy", "name"],
  tagNames: [...defaultTagNames, "mark"],
  attributes: {
    ...defaultAttrs,
    "*": [...defaultStarAttrs, "className", "id"],
    a: [...aAttrsMergedClassName, "ariaHidden"],
    code: [...defaultCodeAttrs, "style", "dataLanguage", "tabIndex"],
    pre: ["className", "tabIndex", "style", "dataLanguage", "dataMermaidSource"],
    span: ["className", "style"],
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
  // `@shikijs/rehype` emits `class` / `tabindex` raw attr names — normalise
  // back to hast property names so `rehype-sanitize` recognises them.
  normalizeHastProperties,
  [rehypeSanitize, sanitizeSchema],
];
