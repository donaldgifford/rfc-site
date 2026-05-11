import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import clsx from "clsx";

import styles from "./Input.module.css";

export type InputSize = "sm" | "md";

export interface InputProps extends Omit<ComponentPropsWithoutRef<"input">, "size" | "prefix"> {
  /**
   * Density. Defaults to `"md"`. Use `"sm"` in dense table toolbars,
   * `"md"` for hero search inputs.
   */
  size?: InputSize;
  /** Optional leading slot — typically an SVG icon. */
  prefix?: ReactNode;
  /** Optional trailing slot — typically a `<Kbd>` hint or affordance. */
  suffix?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = "md", prefix, suffix, className, type, disabled, ...rest },
  ref,
) {
  return (
    <span
      data-size={size}
      data-disabled={disabled === true ? true : undefined}
      className={clsx(styles.root, className)}
    >
      {prefix === undefined ? null : (
        <span className={styles.slot} data-slot="prefix" aria-hidden="true">
          {prefix}
        </span>
      )}
      <input
        ref={ref}
        type={type ?? "text"}
        disabled={disabled}
        className={styles.input}
        {...rest}
      />
      {suffix === undefined ? null : (
        <span className={styles.slot} data-slot="suffix" aria-hidden="true">
          {suffix}
        </span>
      )}
    </span>
  );
});
