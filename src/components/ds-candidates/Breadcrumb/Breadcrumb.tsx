import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ComponentType,
  type ReactNode,
  type Ref,
} from "react";
import { Slot } from "@radix-ui/react-slot";
import clsx from "clsx";

import styles from "./Breadcrumb.module.css";

/* ── Root ────────────────────────────────────────────────────────── */

export interface BreadcrumbProps extends Omit<ComponentPropsWithoutRef<"nav">, "aria-label"> {
  /**
   * Override the default `aria-label`. Defaults to `"Breadcrumb"` per
   * WAI-ARIA Authoring Practices.
   */
  "aria-label"?: string;
  children?: ReactNode;
}

const BreadcrumbRoot = forwardRef<HTMLElement, BreadcrumbProps>(function Breadcrumb(
  { className, children, "aria-label": ariaLabel = "Breadcrumb", ...rest },
  ref,
) {
  return (
    <nav ref={ref} aria-label={ariaLabel} className={clsx(styles.root, className)} {...rest}>
      <ol className={styles.list}>{children}</ol>
    </nav>
  );
});

/* ── Item ────────────────────────────────────────────────────────── */

export interface BreadcrumbItemProps extends Omit<
  ComponentPropsWithoutRef<"a">,
  "href" | "aria-current"
> {
  /**
   * Target URL. Omit on the final / current segment to render as
   * non-clickable text (the WAI-ARIA breadcrumb convention).
   */
  href?: string;
  /**
   * Path-parameter styling — sets `data-param="true"` so the CSS can
   * apply the monospace + accent treatment to `{type}` / `{id}`-style
   * segments per the mockup. The bracket glyphs themselves are passed
   * as children verbatim.
   */
  param?: boolean;
  /**
   * Mark this item as the current page. Sets `aria-current="page"` and
   * forces non-link rendering even if `href` is provided. Defaults to
   * `false`; the more common pattern is omitting `href` on the last
   * item, which has the same effect without the explicit flag.
   */
  current?: boolean;
  /**
   * When `true`, render via Radix Slot so a wrapped consumer element
   * (typically RR7's `<Link>`) inherits the item's styling + props.
   * Only meaningful when `href` is set / the item renders as a link.
   */
  asChild?: boolean;
}

const BreadcrumbItem = forwardRef<HTMLElement, BreadcrumbItemProps>(function BreadcrumbItem(
  { href, param = false, current = false, asChild = false, className, children, ...rest },
  ref,
) {
  const isLink = href !== undefined && !current;
  // The runtime element is `<a>`, `<span>`, or Slot — but the type
  // surface that consumers see (BreadcrumbItemProps extends anchor
  // props, ref is HTMLElement) is uniform. We cast to a generic
  // component type so TypeScript stops trying to narrow ref to one
  // specific HTML element subclass.
  const Comp = (asChild ? Slot : isLink ? "a" : "span") as ComponentType<
    Record<string, unknown> & { ref?: Ref<HTMLElement>; children?: ReactNode }
  >;

  return (
    <li className={styles.item} data-param={param ? "true" : undefined}>
      <Comp
        ref={ref}
        {...(isLink && !asChild ? { href } : {})}
        aria-current={current ? "page" : undefined}
        data-state={current ? "current" : undefined}
        className={clsx(isLink ? styles.link : styles.text, className)}
        {...rest}
      >
        {children}
      </Comp>
    </li>
  );
});

/* ── Public surface ──────────────────────────────────────────────── */

/**
 * `<Breadcrumb>` — accessible navigation breadcrumb trail.
 *
 * Composition follows the Radix-style namespace pattern (`Breadcrumb.Item`).
 * Renders as `<nav aria-label="Breadcrumb"><ol>…</ol></nav>` per the
 * WAI-ARIA Authoring Practices breadcrumb pattern. Separators between
 * items are CSS-only (`::before` glyph on every non-first `<li>`).
 *
 * Path-parameter segments (`{type}`, `{id}`) get a `data-param="true"`
 * hook for the mockup's monospace + accent treatment.
 */
export const Breadcrumb = Object.assign(BreadcrumbRoot, {
  Item: BreadcrumbItem,
});

export { BreadcrumbItem };
