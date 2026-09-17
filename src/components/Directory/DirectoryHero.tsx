import type { ReactNode } from "react";
import styles from "./DirectoryHero.module.css";

interface DirectoryHeroProps {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}

/**
 * Hero block atop the Directory view. Mockup §273-311.
 *
 * Centered, grid-pattern bg with a radial-ellipse mask. Eyebrow is mono 11px
 * tertiary; title is serif 48px. Children slot below the title for the
 * `<LiveFilter>` input.
 */
export function DirectoryHero({ eyebrow, title, children }: DirectoryHeroProps) {
  return (
    <section className={styles.hero}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1 className={styles.title}>{title}</h1>
      {children}
    </section>
  );
}
