import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Kbd.module.css";

interface KbdProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
}

/**
 * Keycap-style indicator. Mockup §242-257 — `.kbd` rule.
 *
 * Visual: monospace 10px, 18px min-height, 2px-bottom-border keycap shadow,
 * mid-grey `--bg-elevated` surface. Used inline for shortcut hints
 * (`<Kbd>⌘</Kbd><Kbd>K</Kbd>`).
 */
export function Kbd({ children, className, ...rest }: KbdProps) {
  return (
    <span className={[styles.kbd, className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </span>
  );
}
