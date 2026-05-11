import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import clsx from "clsx";

import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "icon";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * When `true`, render via Radix Slot so the consumer's child element
   * (typically RR7's `<Link>`) inherits the button's styling +
   * behaviour. Pre-cleared per CLAUDE.md Hard rules — `@radix-ui/react-slot`
   * is the single sanctioned Radix dep.
   */
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", asChild = false, className, type, disabled, ...rest },
  ref,
) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={ref}
      data-variant={variant}
      data-size={size}
      // Slot forwards `disabled` to its child; for an actual <button>
      // we still want the native attribute so form submissions and
      // click handlers short-circuit correctly.
      {...(asChild ? {} : { type: type ?? "button", disabled })}
      aria-disabled={disabled === true ? true : undefined}
      className={clsx(styles.root, className)}
      {...rest}
    />
  );
});
