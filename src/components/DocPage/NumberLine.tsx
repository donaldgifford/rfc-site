import styles from "./NumberLine.module.css";

interface NumberLineProps {
  /** Doc type as displayed (uppercased), e.g. "RFC". */
  type: string;
  /** Zero-padded URL id, e.g. "0011". */
  number: string;
}

/**
 * Doc-page eyebrow. Mockup §707-722.
 *
 * "RFC / 0011" mono-accent eyebrow with a fading-gradient `::after`
 * divider extending to the right edge of the article column.
 */
export function NumberLine({ type, number }: NumberLineProps) {
  return (
    <p className={styles.line}>
      {type.toUpperCase()} / {number}
    </p>
  );
}
