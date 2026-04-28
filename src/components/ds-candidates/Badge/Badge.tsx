/**
 * `<Badge>` — ds-candidate (Phase 5 of IMPL-0001).
 *
 * **Promotion readiness (DESIGN-0001 §The `ds-candidates/` contract):**
 *
 * - Used in 2+ places: `<DocCard>` directory cells + `<DocPage>` header.
 * - API stable: `status` string union sourced from `api/openapi.yaml`'s
 *   `DocumentType.statuses`. `size` is added for forward-compat (sm /
 *   md) with sm as the default to match the directory-card density.
 * - Zero portal deps: no imports from `portal/`, `routes/`, `pages/`,
 *   the orval client, TanStack Query, or app state. Pure design-system
 *   primitives + tokens only.
 *
 * Shape conforms to the design-system primitive contract:
 *
 * - `forwardRef` so consumers can pin focus / measure layout.
 * - String-union props (`status`, `size`), never `isPrimary`-style booleans.
 * - Native `<span>` prop pass-through (`...rest`) so `data-*`, `aria-*`,
 *   `id`, `onClick`, etc. work without per-prop opt-in.
 * - `className` merges (clsx) — never replaces.
 * - `data-status` / `data-size` attributes drive the CSS variant rules
 *   so consumers can also target them in their own stylesheets if
 *   needed without prop-coupling.
 */

import { forwardRef, type ComponentPropsWithoutRef } from "react";
import clsx from "clsx";
import styles from "./Badge.module.css";

export const BADGE_STATUSES = [
  "draft",
  "proposed",
  "accepted",
  "rejected",
  "superseded",
  "abandoned",
] as const;

export type BadgeStatus = (typeof BADGE_STATUSES)[number];
export type BadgeSize = "sm" | "md";

export interface BadgeProps extends ComponentPropsWithoutRef<"span"> {
  /**
   * Document status. The string union mirrors `DocumentType.statuses`
   * from `api/openapi.yaml`. The component normalises the input
   * (lowercases, hyphenates whitespace) before matching tokens, so
   * passing the API's mixed-case `"Accepted"` works as well.
   */
  status: BadgeStatus | (string & {});
  /**
   * Visual density. Defaults to `"sm"` to match the rfc-portal-mockup
   * directory cards. Use `"md"` for hero / detail-page placements.
   */
  size?: BadgeSize;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { status, size = "sm", className, children, ...rest },
  ref,
) {
  const variant = normalise(status);
  return (
    <span
      ref={ref}
      data-status={variant}
      data-size={size}
      className={clsx(styles.badge, className)}
      {...rest}
    >
      {children ?? humanise(status)}
    </span>
  );
});

function normalise(status: string): string {
  return status.toLowerCase().trim().replace(/\s+/g, "-");
}

function humanise(status: string): string {
  if (status.length === 0) return status;
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}
