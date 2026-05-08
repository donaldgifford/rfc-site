import type { Element } from "hast";
import type { PluggableList } from "unified";

import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeShiki from "@shikijs/rehype";
import rehypeSanitize, { defaultSchema, type Options as SanitizeOptions } from "rehype-sanitize";

import mermaidMarker from "./plugins/mermaid-marker";
import normalizeHastProperties from "./plugins/normalize-hast-properties";
import stripDoczBoilerplate from "./plugins/strip-docz-boilerplate";

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
// `strip-docz-boilerplate` runs before `remark-rehype` (it operates on mdast)
// to drop tooling artefacts (markdownlint comments + auto-TOC blocks).
export const remarkPlugins: PluggableList = [remarkGfm, stripDoczBoilerplate];

// Plugins consumed by `react-markdown`'s `rehypePlugins` prop.
// Order is load-bearing:
//   slug → autolink (so the anchor sees the id)
//   → mermaid-marker (tags `language-mermaid` blocks before Shiki, so Shiki
//     doesn't touch them)
//   → shiki (syntax highlighting for everything else)
//   → normalize-hast-properties (Shiki emits raw HTML attr names; convert
//     back to hast camelCase so `rehype-sanitize` recognises them)
//   → sanitize (last line of defence).
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
  mermaidMarker,
  [
    rehypeShiki,
    {
      themes: { light: "github-light", dark: "github-dark" },
    },
  ],
  normalizeHastProperties,
  [rehypeSanitize, sanitizeSchema],
];
