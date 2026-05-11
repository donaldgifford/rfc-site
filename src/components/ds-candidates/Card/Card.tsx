import { forwardRef, type ComponentPropsWithoutRef, type ElementType } from "react";
import { Slot } from "@radix-ui/react-slot";
import clsx from "clsx";

import styles from "./Card.module.css";

export type CardVariant = "flat" | "elevated";
export type CardPadding = "sm" | "md" | "lg";

export interface CardProps extends ComponentPropsWithoutRef<"div"> {
  /**
   * Visual variant. `"flat"` (default) renders a hairline border and
   * raised background; `"elevated"` adds `--shadow-sm` for stacked
   * chrome / popover-like surfaces.
   */
  variant?: CardVariant;
  /** Internal padding. Defaults to `"md"`. */
  padding?: CardPadding;
  /**
   * When `true`, render via Radix Slot so the consumer's child element
   * (`<section>`, `<article>`, `<Link>`) inherits the card's styling
   * + attributes. Pre-cleared per CLAUDE.md Hard rules.
   */
  asChild?: boolean;
}

const CardRoot = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = "flat", padding = "md", asChild = false, className, ...rest },
  ref,
) {
  const Comp: ElementType = asChild ? Slot : "div";

  return (
    <Comp
      ref={ref}
      data-variant={variant}
      data-padding={padding}
      className={clsx(styles.root, className)}
      {...rest}
    />
  );
});

/* ── Sub-components — Card.Header / Card.Body / Card.Footer ──────── */

export type CardSectionProps = ComponentPropsWithoutRef<"div">;

const CardHeader = forwardRef<HTMLDivElement, CardSectionProps>(function CardHeader(
  { className, ...rest },
  ref,
) {
  return <div ref={ref} className={clsx(styles.header, className)} {...rest} />;
});

const CardBody = forwardRef<HTMLDivElement, CardSectionProps>(function CardBody(
  { className, ...rest },
  ref,
) {
  return <div ref={ref} className={clsx(styles.body, className)} {...rest} />;
});

const CardFooter = forwardRef<HTMLDivElement, CardSectionProps>(function CardFooter(
  { className, ...rest },
  ref,
) {
  return <div ref={ref} className={clsx(styles.footer, className)} {...rest} />;
});

/**
 * `<Card>` — composable elevated surface for portal chrome.
 *
 * Dot-notation sub-components (`Card.Header` / `Card.Body` /
 * `Card.Footer`) are attached statically so TypeScript surfaces them
 * via consumer's imported `Card`. The standalone `CardHeader` /
 * `CardBody` / `CardFooter` exports below are equivalent and enable
 * destructured imports for tree-shaking-sensitive call-sites.
 */
export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Body: CardBody,
  Footer: CardFooter,
});

export { CardHeader, CardBody, CardFooter };
