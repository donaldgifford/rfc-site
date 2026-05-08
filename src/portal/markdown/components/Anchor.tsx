import type { AnchorHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router";

import { apiHrefToPortalRoute } from "../../api/docId";
import type { Link as DocLink } from "../../api/__generated__/model";
import { useDocumentLinks } from "../DocumentView";

interface AnchorProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href?: string | undefined;
  children?: ReactNode;
}

const EXTERNAL_PROTOCOL = /^https?:\/\//i;

function findLink(links: readonly DocLink[], href: string): DocLink | undefined {
  // Prefer the canonical id form (`target`) over the API URL (`href`) per
  // IMPL-0003 Resolved §4 — `target` is the stable identifier; relative paths
  // get rewritten by `rfc-api`'s ingest into the canonical form.
  for (const link of links) {
    if (link.target === href) return link;
  }
  for (const link of links) {
    if (link.href === href) return link;
  }
  return undefined;
}

/**
 * Markdown anchor override.
 *
 * Resolves cross-document links from the document's `links[]` array (per
 * DESIGN-0002 §Cross-document link resolution and CLAUDE.md §Hard rules).
 *
 * Behaviour:
 *   1. Hash-only anchors (`#section-slug`) → in-page navigation, render `<a>`.
 *   2. Match `href` against `links[].target` then `links[].href` (Resolved §4).
 *      If matched, render an RR7 `<Link>` to the portal route derived from
 *      the link's `href` (API URL).
 *   3. External `http(s)://` URLs that didn't match → `<a target="_blank"
 *      rel="noopener noreferrer">`.
 *   4. Anything else (unmatched internal-looking href) → `<span data-broken-link>`
 *      so it renders inertly + carries a hook for styling.
 */
export function Anchor({ href, children, ...rest }: AnchorProps) {
  const links = useDocumentLinks();

  if (!href) {
    return <a {...rest}>{children}</a>;
  }

  if (href.startsWith("#")) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  }

  const resolved = findLink(links, href);
  if (resolved) {
    const portalRoute = apiHrefToPortalRoute(resolved.href);
    if (portalRoute) {
      return (
        <Link to={portalRoute} {...rest}>
          {children}
        </Link>
      );
    }
  }

  if (EXTERNAL_PROTOCOL.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    );
  }

  return (
    <span data-broken-link="" title={`Unresolved link: ${href}`}>
      {children}
    </span>
  );
}
