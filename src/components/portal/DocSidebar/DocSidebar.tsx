/**
 * `<DocSidebar>` — metadata sidebar for the `/$type/$id` doc page.
 *
 * Composes `<Card variant="elevated">` blocks (one per metadata facet)
 * laid out as a single column. Status, Authors, Created, Updated, and
 * Source are always present; Discussion (PR link + comment count) and
 * Labels only render when the doc payload supplies them.
 *
 * IMPL-0004 Phase 8a — the cross-RFC preview card (Phase 8b) extends
 * `<Anchor>` separately; this composite is purely presentational and
 * does not fetch any data.
 */

import { Badge, Card } from "@donaldgifford/design-system";

import type { Document } from "../../../portal/api/__generated__/model";

import styles from "./DocSidebar.module.css";

export interface DocSidebarProps {
  document: Document;
}

export function DocSidebar({ document }: DocSidebarProps) {
  const { status, authors, created_at, updated_at, source, discussion, labels } = document;

  return (
    <aside className={styles.sidebar} aria-label="Document metadata">
      <MetaBlock label="Status">
        <Badge status={status} size="md" />
      </MetaBlock>

      {authors && authors.length > 0 ? (
        <MetaBlock label="Authors">
          <ul className={styles.list}>
            {authors.map((author, idx) => (
              <li key={`${author.name}-${String(idx)}`}>{author.name}</li>
            ))}
          </ul>
        </MetaBlock>
      ) : null}

      <MetaBlock label="Created">
        <time dateTime={created_at}>{formatDate(created_at)}</time>
      </MetaBlock>

      <MetaBlock label="Updated">
        <time dateTime={updated_at}>{formatDate(updated_at)}</time>
      </MetaBlock>

      <MetaBlock label="Source">
        <a
          href={sourceUrl(source.repo, source.path, source.commit)}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.sourceLink}
        >
          {source.repo}
          <span className={styles.sourcePath}>{source.path}</span>
        </a>
      </MetaBlock>

      {discussion?.url !== undefined ? (
        <MetaBlock label="Discussion">
          <a
            href={discussion.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.sourceLink}
          >
            View discussion
            {typeof discussion.comment_count === "number" ? (
              <span className={styles.commentCount}>{discussion.comment_count} comments</span>
            ) : null}
          </a>
        </MetaBlock>
      ) : null}

      {labels && labels.length > 0 ? (
        <MetaBlock label="Labels">
          <ul className={styles.tagList}>
            {labels.map((label) => (
              <li key={label} className={styles.tag}>
                {label}
              </li>
            ))}
          </ul>
        </MetaBlock>
      ) : null}
    </aside>
  );
}

function MetaBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card variant="elevated" padding="sm" className={styles.block}>
      <Card.Header className={styles.blockLabel}>{label}</Card.Header>
      <Card.Body className={styles.blockBody}>{children}</Card.Body>
    </Card>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function sourceUrl(repo: string, path: string, commit?: string): string {
  const ref = commit ?? "HEAD";
  return `https://github.com/${repo}/blob/${ref}/${path}`;
}
