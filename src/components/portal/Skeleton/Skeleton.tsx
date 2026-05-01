import clsx from "clsx";
import styles from "./Skeleton.module.css";

/**
 * Layout-stable skeleton block. Renders a shimmer-pulsed placeholder
 * sized via inline width/height so consuming layouts don't shift when
 * real content arrives.
 *
 * `variant` controls border-radius — `"text"` (sm radius, fits inline
 * with prose) and `"block"` (md radius, fits cards/headers).
 */
export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  variant?: "text" | "block";
  className?: string;
}

export function Skeleton({
  width = "100%",
  height = "1em",
  variant = "text",
  className,
}: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      data-variant={variant}
      className={clsx(styles.skeleton, className)}
      style={{ width, height }}
    />
  );
}
