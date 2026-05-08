/**
 * Helpers for the canonical / URL forms of a `Document.id`.
 *
 * Per the OpenAPI contract (`api/openapi.yaml` parameter `DocID`), the
 * URL `:id` segment matches `^[0-9]+$` (e.g. `"0001"`), and rfc-api
 * reconstructs the canonical id (`"RFC-0001"`) server-side via
 * `<TYPE_UPPER>-<id>`. The portal therefore must send the bare
 * numeric form when calling rfc-api, even though `Document.id` in the
 * response payload is the canonical form.
 *
 * Display surfaces (breadcrumb, dateline, card chrome) keep using the
 * canonical id verbatim — only the URL-building call sites strip the
 * prefix.
 */

/**
 * Extract the URL-path form of a canonical document id (`"RFC-0001"`
 * → `"0001"`). Returns the input unchanged when no `-` is present so
 * malformed ids fall through to a 404 at the route loader rather than
 * being silently corrupted here.
 */
export function urlIdFromCanonical(canonicalId: string): string {
  const dash = canonicalId.indexOf("-");
  if (dash === -1 || dash === canonicalId.length - 1) {
    return canonicalId;
  }
  return canonicalId.slice(dash + 1);
}

/**
 * Reconstruct the canonical id from a (type, urlId) pair, mirroring
 * rfc-api's `docid.Canonical`. Used by the MSW dev-mode handlers so
 * fixture lookups match the same key the portal uses for display.
 */
export function canonicalFromUrl(type: string, urlId: string): string {
  return `${type.toUpperCase()}-${urlId}`;
}

/**
 * Translate an `rfc-api` getDoc URL (`Link.href` shape, e.g.
 * `/api/v1/rfc/0001`) to its portal route counterpart (`/rfc/0001`).
 *
 * Returns `null` when the input doesn't match the expected
 * `/api/v1/<type>/<urlId>` pattern. The portal's `<Anchor>` component
 * (DESIGN-0002 §Cross-document link resolution, IMPL-0003 Phase 4)
 * uses this to resolve anchor `href`s that come from `Document.links[]`
 * into RR7 `<Link to={...}>` targets.
 *
 * Pairs symmetrically with `urlIdFromCanonical` / `canonicalFromUrl`
 * — see the module docstring for the contract rationale.
 */
export function apiHrefToPortalRoute(apiHref: string): string | null {
  const match = /^\/api\/v1\/([^/?#]+)\/([^/?#]+)(?:[/?#]|$)/.exec(apiHref);
  if (!match) return null;
  const type = match[1];
  const urlId = match[2];
  if (type === undefined || urlId === undefined) return null;
  return `/${type}/${urlId}`;
}
