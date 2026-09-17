import type { ReactNode } from "react";
import styles from "./DocPage.module.css";

interface DocPageProps {
  sidebar: ReactNode;
  toc: ReactNode;
  children: ReactNode;
}

/**
 * 3-column shell for the RFC page. Mockup §641-650.
 *
 * Grid: 240px metadata / minmax(0, 1fr) article / 240px TOC, gap 56px,
 * max-w 1400px. Collapses to 2-col under 1100px (drops TOC) and to a
 * single column under 800px (drops both sidebars).
 */
export function DocPage({ sidebar, toc, children }: DocPageProps) {
  return (
    <div className={styles.view}>
      <aside className={styles.sidebarLeft}>{sidebar}</aside>
      <article className={styles.content}>{children}</article>
      <aside className={styles.sidebarRight}>{toc}</aside>
    </div>
  );
}
