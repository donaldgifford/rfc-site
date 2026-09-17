import { useEffect, useState, type RefObject } from "react";
import styles from "./TableOfContents.module.css";

interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

interface TableOfContentsProps {
  /** Ref to the rendered article container. Headings inside are harvested. */
  articleRef: RefObject<HTMLDivElement | null>;
}

/**
 * Right-sidebar table of contents. Mockup §1181-1188 + §3540-3556.
 *
 * Walks the article container's rendered h2/h3 nodes, emits a `<ul>` with
 * the mockup's `.toc-list` + `.nested` classes. Uses IntersectionObserver
 * to update the `.current` highlight as the user scrolls. Re-walks when
 * the article DOM changes (MutationObserver) so Markdown rehydration
 * doesn't strand the TOC.
 */
export function TableOfContents({ articleRef }: TableOfContentsProps) {
  const [entries, setEntries] = useState<TocEntry[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);

  // Walk + watch the article container.
  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;

    function walk(): TocEntry[] {
      if (!article) return [];
      const headings = article.querySelectorAll<HTMLElement>("h2[id], h3[id]");
      const next: TocEntry[] = [];
      headings.forEach((h) => {
        const id = h.id;
        const text = h.textContent ? h.textContent.trim() : "";
        const level = h.tagName === "H2" ? 2 : 3;
        if (id.length > 0 && text.length > 0) {
          next.push({ id, text, level });
        }
      });
      return next;
    }

    setEntries(walk());

    const observer = new MutationObserver(() => {
      setEntries(walk());
    });
    observer.observe(article, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
    };
  }, [articleRef]);

  // Scroll-spy on the harvested headings.
  useEffect(() => {
    if (entries.length === 0) return;
    const article = articleRef.current;
    if (!article) return;

    const observer = new IntersectionObserver(
      (changes) => {
        // Pick the topmost visible heading. If none are intersecting,
        // keep whatever the user last passed.
        const visible = changes
          .filter((c) => c.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target instanceof HTMLElement) {
          setCurrentId(visible.target.id);
        }
      },
      { rootMargin: "-80px 0px -60% 0px" },
    );

    for (const entry of entries) {
      const node = article.querySelector(`#${CSS.escape(entry.id)}`);
      if (node) observer.observe(node);
    }
    return () => {
      observer.disconnect();
    };
  }, [entries, articleRef]);

  if (entries.length === 0) return null;

  return (
    <nav aria-label="On this page" className={styles.section}>
      <h2 className={styles.heading}>On this page</h2>
      <ul className={styles.list}>
        {entries.map((entry) => {
          const className = [entry.level === 3 ? styles.nested : ""].filter(Boolean).join(" ");
          return (
            <li key={entry.id} className={className}>
              <a
                href={`#${entry.id}`}
                className={entry.id === currentId ? styles.linkCurrent : styles.link}
              >
                {entry.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
