import type { Element } from "hast";
import type { PluggableList } from "unified";
import type { ShikiTransformer } from "shiki";

import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeShiki from "@shikijs/rehype";
import rehypeSanitize, { defaultSchema, type Options as SanitizeOptions } from "rehype-sanitize";

import { captureCodeMeta } from "./plugins/capture-code-meta";
import { remarkGithubAlerts } from "./plugins/github-alerts";
import mermaidMarker from "./plugins/mermaid-marker";
import normalizeHastProperties from "./plugins/normalize-hast-properties";
import stripDoczBoilerplate from "./plugins/strip-docz-boilerplate";
import wrapCodeblock from "./plugins/wrap-codeblock";

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
//   - `dataMermaidSource` on <pre> (set by mermaid-marker plugin)
//   - `dataCrossDoc` on <a>, `dataBrokenLink` + `title` on <span>
//     (set by resolve-anchor-links — IMPL-0006 Phase 1)
//   - `target` + `rel` on <a> (set by resolve-anchor-links for external links)
//   - <mark> for search-snippet rendering
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
    "*": [...defaultStarAttrs, "className", "id", "title"],
    a: [...aAttrsMergedClassName, "ariaHidden", "target", "rel", "dataCrossDoc"],
    code: [...defaultCodeAttrs, "style", "dataLanguage", "tabIndex"],
    pre: ["className", "tabIndex", "style", "dataLanguage", "dataCaption", "dataMermaidSource"],
    span: ["className", "style", "dataBrokenLink"],
    // GFM alerts → admonition div (remark-github-alerts plugin).
    div: ["className"],
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

// Map every color the `tokyo-night` Shiki theme emits onto a mockup
// `--code-*` CSS variable, so the rendered output uses CSS variables
// rather than baked-in hex codes. `var(--code-fg)` is the safety net —
// any color not in the table falls back to the default foreground, which
// keeps the IMPL-0006 §Phase 2 success criterion ("zero inline hex
// colors") satisfied even if a future Shiki / theme update introduces
// new hexes.
//
// Buckets:
//   keyword  — control flow, storage modifiers, struct/return/etc.
//   function — entities & function names
//   string   — string literals + escape sequences
//   number   — numeric literals + booleans
//   type     — type names + supports
//   punct    — operators, structural punctuation
//   key      — markup-style anchors: tag names, hash anchors
//   comment  — comments + muted scopes (multiple tokyo-night shades)
//   fg / value — default foreground variants
const HEX_TO_CODE_VAR: Record<string, string> = {
  // keyword / control / storage / modifier  (purple family)
  "#bb9af7": "var(--code-keyword)",
  "#9d7cd8": "var(--code-keyword)",
  "#b267e6": "var(--code-keyword)",
  "#ba3c97": "var(--code-keyword)",
  // function / entity                       (blue family)
  "#7aa2f7": "var(--code-function)",
  "#6d91de": "var(--code-function)",
  "#6183bb": "var(--code-function)",
  "#9abdf5": "var(--code-function)",
  "#61bdf2": "var(--code-function)",
  // string / regex / escape                 (green family)
  "#9ece6a": "var(--code-string)",
  "#b4f9f8": "var(--code-string)",
  // number / constant / literal             (orange + yellow family)
  "#ff9e64": "var(--code-number)",
  "#e0af68": "var(--code-number)",
  "#ffdb69": "var(--code-number)",
  // type / namespace / support              (teal family)
  "#73daca": "var(--code-type)",
  "#41a6b5": "var(--code-type)",
  "#449dab": "var(--code-type)",
  "#7dcfff": "var(--code-type)",
  "#0db9d7": "var(--code-type)",
  // punctuation / operator                  (cyan family)
  "#89ddff": "var(--code-punct)",
  // markup keys / tags / hashes / regex     (red/pink family)
  "#f7768e": "var(--code-key)",
  "#fc7b7b": "var(--code-key)",
  "#ff5370": "var(--code-key)",
  "#de5971": "var(--code-key)",
  "#db4b4b": "var(--code-key)",
  "#914c54": "var(--code-key)",
  // comments + muted/disabled (multiple shades)
  "#565f89": "var(--code-comment)",
  "#4e5579": "var(--code-comment)",
  "#51597d": "var(--code-comment)",
  "#5a638c": "var(--code-comment)",
  "#646e9c": "var(--code-comment)",
  "#747ca1": "var(--code-comment)",
  "#9aa5ce": "var(--code-comment)",
  // default foreground variants
  "#c0caf5": "var(--code-value)",
  "#c0cefc": "var(--code-value)",
};

// Shiki transformer (IMPL-0006 Phase 2):
//
//   1. Strip the `<pre>`'s inline `background-color` / `color`. Our CSS
//      drives both via `--code-bg` / `--code-fg`, so the inline style
//      is a baked dark-mode color we don't want.
//   2. Replace every `color:#XXX` on a token `<span>` with the
//      corresponding `var(--code-*)` reference. Unknown hexes fall
//      back to `var(--code-fg)`.
//   3. Copy the Shiki `lang` option onto the `<pre>` as
//      `data-language="<lang>"` so the language-badge CSS selector
//      (`pre[data-language]::before`) matches.
//   4. Skip mermaid blocks — `mermaid-marker` already gave them a
//      `data-mermaid-source` marker; they shouldn't get a Shiki
//      treatment.
const HEX_COLOR = /(?:^|;)\s*color\s*:\s*(#[0-9a-fA-F]{3,8})/g;
const HEX_BACKGROUND = /(?:^|;)\s*background-color\s*:\s*#[0-9a-fA-F]{3,8}\s*;?/g;

const codeColorsToCssVariables: ShikiTransformer = {
  name: "rfc-site:tokens-to-css-variables",
  pre(node) {
    // Drop inline background + color from the <pre>; CSS owns these.
    const style = readString(node.properties.style);
    if (style !== null) {
      const stripped = style.replace(HEX_BACKGROUND, "").replace(HEX_COLOR, "").trim();
      if (stripped.length === 0) {
        delete node.properties.style;
      } else {
        node.properties.style = stripped.replace(/^;\s*/, "");
      }
    }
    // Annotate the <pre> with the source language so CSS can render
    // a language badge (mockup §812-823). Hast canonicalises
    // `dataLanguage` → `data-language` on stringify; the sanitize
    // schema already permits this property on <pre>.
    const lang = readString(this.options.lang);
    if (lang !== null && lang !== "text" && lang !== "plain") {
      node.properties.dataLanguage = lang;
    }
    // Code-fence meta string → caption shown in the codeblock header
    // (mockup §930-973). `wrap-codeblock` picks this up after Shiki to
    // build the `<div class="codeblock-header">` chrome.
    const metaRaw = readMetaRaw(this.options.meta);
    if (metaRaw !== null) {
      node.properties.dataCaption = metaRaw;
    }
  },
  span(node) {
    const style = readString(node.properties.style);
    if (style === null) return;
    const swapped = style.replace(HEX_COLOR, (match, hex: string) => {
      const replacement = HEX_TO_CODE_VAR[hex.toLowerCase()] ?? "var(--code-fg)";
      return match.replace(hex, replacement);
    });
    if (swapped !== style) {
      node.properties.style = swapped;
    }
  },
};

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readMetaRaw(meta: unknown): string | null {
  if (meta === null || typeof meta !== "object") return null;
  const raw = (meta as { __raw?: unknown }).__raw;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Plugins consumed by `react-markdown`'s `remarkPlugins` prop.
// `remark-parse` / `remark-rehype` are owned by react-markdown itself.
// `strip-docz-boilerplate` runs before `remark-rehype` (it operates on mdast)
// to drop tooling artefacts (markdownlint comments + auto-TOC blocks).
// `remark-github-alerts` runs after GFM so the blockquote tokens exist.
export const remarkPlugins: PluggableList = [
  remarkGfm,
  stripDoczBoilerplate,
  remarkGithubAlerts,
  captureCodeMeta,
];

// Rehype plugin chain split across two exports so callers that need to
// insert their own pass (e.g. `renderMarkdown.ts` injecting a hast
// `<a>`-rewrite plugin before sanitize) can compose them with a custom
// middle. The combined `rehypePlugins` export below preserves the
// chain shape react-markdown consumed before the split.
//
// Order within `rehypePluginsCore` is load-bearing:
//   slug → autolink (so the anchor sees the id)
//   → mermaid-marker (tags `language-mermaid` blocks before Shiki, so Shiki
//     doesn't touch them)
//   → shiki (syntax highlighting for everything else)
//   → normalize-hast-properties (Shiki emits raw HTML attr names; convert
//     back to hast camelCase so `rehype-sanitize` recognises them)
//
// `rehypeSanitizePlugin` is the LAST line of defence and must always
// run last in any chain that uses these exports.
export const rehypePluginsCore: PluggableList = [
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
      // Single dark theme — RFC-0001 hard-coded `data-theme="dark"`.
      // tokyo-night ships the palette family our `--code-*` tokens
      // were authored from (mockup §49-61); the transformer below
      // rewrites every emitted color to a CSS variable.
      theme: "tokyo-night",
      transformers: [codeColorsToCssVariables],
    },
  ],
  wrapCodeblock,
  normalizeHastProperties,
];

export const rehypeSanitizePlugin: PluggableList = [[rehypeSanitize, sanitizeSchema]];

// Combined chain — preserves the shape react-markdown's `<MarkdownHooks>`
// has consumed since DESIGN-0002. Kept stable so the existing
// `<DocumentView>` client-side path stays unchanged while IMPL-0006
// Phase 1 builds the server-side render path alongside it.
export const rehypePlugins: PluggableList = [...rehypePluginsCore, ...rehypeSanitizePlugin];
