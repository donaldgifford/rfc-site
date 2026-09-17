import type { ElementContent, Root } from "hast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

import { apiHrefToPortalRoute } from "../../api/docId";
import type { Link as DocLink } from "../../api/__generated__/model";

const EXTERNAL_PROTOCOL = /^https?:\/\//i;

interface FileData {
  documentLinks?: readonly DocLink[];
}

/**
 * Server-side replacement for `<Anchor>`'s runtime resolution (IMPL-0006 Phase 1).
 *
 * Walks the hast tree and rewrites every `<a href>`:
 *
 *   1. Hash-only (`#section`) → leave alone (in-page navigation).
 *   2. Match against `documentLinks[].target` then `documentLinks[].href`.
 *      On match, rewrite `href` to `apiHrefToPortalRoute(link.href)` and
 *      add `data-cross-doc="1"` so the client-side click delegation
 *      (Phase 4 `cross-doc-nav.ts`) can intercept and route via RR7.
 *   3. External `http(s)://` URL that didn't match → add
 *      `target="_blank"` + `rel="noopener noreferrer"`.
 *   4. Unmatched internal-looking href → replace the `<a>` element with
 *      `<span data-broken-link>` carrying the original children + a
 *      `title="Unresolved link: <href>"`. Matches the `<Anchor>`
 *      component's fall-through semantics.
 *
 * The document's `links[]` array is provided via `file.data.documentLinks`:
 *
 * ```ts
 * await pipeline.process({ value: doc.body, data: { documentLinks: doc.links ?? [] } });
 * ```
 *
 * Must run AFTER the rehype core chain (slug / autolink / shiki / normalize)
 * and BEFORE rehype-sanitize, so the rewritten attributes survive the
 * sanitize pass — `data-cross-doc` and `target`/`rel` need to be in the
 * sanitize schema's permitted attribute list.
 */
export const resolveAnchorLinks: Plugin<[], Root> = function () {
  return (tree, file) => {
    const data = file.data as FileData;
    const documentLinks = data.documentLinks ?? [];

    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "a") return;
      const href = node.properties.href;
      if (typeof href !== "string") return;

      // 1. Hash-only — in-page anchor. Skip.
      if (href.startsWith("#")) return;

      // 2. Cross-doc match (target preferred, href fallback — per IMPL-0003 §Resolved 4).
      const resolved = findLink(documentLinks, href);
      if (resolved) {
        const portalRoute = apiHrefToPortalRoute(resolved.href);
        if (portalRoute !== null) {
          node.properties = {
            ...node.properties,
            href: portalRoute,
            dataCrossDoc: "1",
          };
          return;
        }
      }

      // 3. External — open in new tab, opener-safe.
      if (EXTERNAL_PROTOCOL.test(href)) {
        node.properties = {
          ...node.properties,
          target: "_blank",
          rel: "noopener noreferrer",
        };
        return;
      }

      // 4. Unmatched internal-looking — render inertly as a broken-link span.
      if (parent !== undefined && typeof index === "number") {
        const replacement: ElementContent = {
          type: "element",
          tagName: "span",
          properties: {
            dataBrokenLink: "",
            title: `Unresolved link: ${href}`,
          },
          children: node.children,
        };
        parent.children[index] = replacement;
      }
    });
  };
};

function findLink(links: readonly DocLink[], href: string): DocLink | undefined {
  for (const link of links) {
    if (link.target === href) return link;
  }
  for (const link of links) {
    if (link.href === href) return link;
  }
  return undefined;
}
