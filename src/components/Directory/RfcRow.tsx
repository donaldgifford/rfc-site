import { Link } from "react-router";
import type { Document } from "../../portal/api/__generated__/model";
import { urlIdFromCanonical } from "../../portal/api/docId";
import { StatusBadge } from "./StatusBadge";
import styles from "./RfcRow.module.css";

interface RfcRowProps {
  doc: Document;
}

/**
 * A single row in the RFC directory table. Mockup §521-637.
 *
 * 5-column grid: numeric ID / title + labels / status badge / authors /
 * relative-time updated. Whole row is a single Link — the mockup treats
 * the row as clickable.
 */
export function RfcRow({ doc }: RfcRowProps) {
  const urlId = urlIdFromCanonical(doc.id);
  const numericId = urlId.padStart(4, "0");
  const route = `/${doc.type}/${urlId}`;
  const authors = doc.authors ?? [];
  const labels = doc.labels ?? [];

  return (
    <Link to={route} className={styles.row}>
      <div className={styles.number}>{numericId}</div>
      <div className={styles.titleCell}>
        <div className={styles.title}>{doc.title}</div>
        {labels.length > 0 ? (
          <div className={styles.labels}>
            {labels.map((label) => (
              <span key={label} className={styles.labelTag}>
                {label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className={styles.statusCell}>
        <StatusBadge status={doc.status} />
      </div>
      <div className={styles.authorsCell}>
        {authors.length > 0 ? (
          authors.map((author) => author.name).join(", ")
        ) : (
          <span aria-hidden="true">—</span>
        )}
      </div>
      <div className={styles.updatedCell}>
        <time dateTime={doc.updated_at} title={doc.updated_at}>
          {formatRelative(doc.updated_at)}
        </time>
      </div>
    </Link>
  );
}

/**
 * Mockup uses bespoke phrasings ("2 hours ago", "Yesterday", "3 days ago",
 * "1 week ago", "2 weeks ago"). This matches that surface — buckets are
 * tuned to align with the mockup's examples.
 */
function formatRelative(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diffMs = Date.now() - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;

  if (diffMs < minute) return "just now";
  if (diffMs < hour) {
    const mins = Math.floor(diffMs / minute);
    return `${String(mins)} min${mins === 1 ? "" : "s"} ago`;
  }
  if (diffMs < day) {
    const hrs = Math.floor(diffMs / hour);
    return `${String(hrs)} hour${hrs === 1 ? "" : "s"} ago`;
  }
  if (diffMs < 2 * day) return "Yesterday";
  if (diffMs < week) {
    const days = Math.floor(diffMs / day);
    return `${String(days)} days ago`;
  }
  if (diffMs < 4 * week) {
    const weeks = Math.floor(diffMs / week);
    return `${String(weeks)} week${weeks === 1 ? "" : "s"} ago`;
  }
  // Fall back to a short month/year for older docs.
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}
