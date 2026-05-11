import { forwardRef, type ComponentPropsWithoutRef } from "react";
import clsx from "clsx";

import styles from "./Kbd.module.css";

export type KbdSize = "sm" | "md";

export interface KbdProps extends Omit<ComponentPropsWithoutRef<"kbd">, "size"> {
  /**
   * Density. Defaults to `"sm"` — the typical placement is in a
   * trailing slot inside `<Input>` or a search-footer hint where space
   * is tight.
   */
  size?: KbdSize;
}

export const Kbd = forwardRef<HTMLElement, KbdProps>(function Kbd(
  { size = "sm", className, ...rest },
  ref,
) {
  return <kbd ref={ref} data-size={size} className={clsx(styles.root, className)} {...rest} />;
});
