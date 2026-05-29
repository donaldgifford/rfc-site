/**
 * Brand identity per top-level route.
 *
 * The topbar logo + label adapts to whichever section the user is in,
 * so the chrome reinforces their location instead of being static.
 * Colors reuse existing status / accent tokens so the palette stays
 * consistent with the rest of the surface.
 *
 * - Directory + RFC reading + search → rfcs scope (R, --accent)
 * - /api    → api docs scope          (A, --status-draft / amber)
 * - /mcp    → mcp setup scope         (M, --status-superseded / purple)
 *
 * Doc routes (/$type/$id) read the id portion into the sub-label so the
 * brand reads "rfcs / 0001" while you're on RFC 0001. Other content
 * types keep the same colour family — the mark stays R and the name
 * stays "rfcs" because rfc-api treats all doc types as siblings under
 * the same umbrella.
 */
export interface Brand {
  mark: string;
  color: string;
  name: string;
  sub: string;
}

const RFCS: Pick<Brand, "mark" | "color" | "name"> = {
  mark: "R",
  color: "var(--accent)",
  name: "rfcs",
};

export function deriveBrand(pathname: string): Brand {
  if (pathname === "/" || pathname === "") {
    return { ...RFCS, sub: "directory" };
  }
  if (pathname.startsWith("/search")) {
    return { ...RFCS, sub: "search" };
  }
  if (pathname.startsWith("/api")) {
    return { mark: "A", color: "var(--status-draft)", name: "api", sub: "reference" };
  }
  if (pathname.startsWith("/mcp")) {
    return { mark: "M", color: "var(--status-superseded)", name: "mcps", sub: "setup" };
  }
  // /$type/$id — pull the id into the sub label.
  const docMatch = /^\/([a-z]+)\/([^/]+)/.exec(pathname);
  if (docMatch !== null) {
    const id = docMatch[2] ?? "";
    return { ...RFCS, sub: id };
  }
  return { ...RFCS, sub: "portal" };
}
