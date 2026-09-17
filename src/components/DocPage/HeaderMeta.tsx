import type { Document } from "../../portal/api/__generated__/model";
import { StatusBadge } from "../Directory/StatusBadge";
import styles from "./HeaderMeta.module.css";

interface HeaderMetaProps {
  doc: Document;
}

/**
 * Doc-page header meta row. Mockup §732-741 + §3146-3154.
 *
 * Single mono-12 tertiary line: status-badge · authored by name · revision
 * N · relative-updated. Dots are visible `<span>` dividers (mockup uses
 * `.divider` class). Authors render as accent-coloured spans.
 */
export function HeaderMeta({ doc }: HeaderMetaProps) {
  const authors = doc.authors ?? [];
  const revision = (doc.source.commit ?? "").slice(0, 7);
  const updated = relativeFromNow(doc.updated_at);
  return (
    <div className={styles.meta}>
      <StatusBadge status={doc.status} />
      {authors.length > 0 ? (
        <>
          <span className={styles.divider} aria-hidden="true">
            ·
          </span>
          <span>
            authored by{" "}
            <span className={styles.author}>{authors.map((a) => a.name).join(", ")}</span>
          </span>
        </>
      ) : null}
      {revision.length > 0 ? (
        <>
          <span className={styles.divider} aria-hidden="true">
            ·
          </span>
          <span>revision {revision}</span>
        </>
      ) : null}
      <span className={styles.divider} aria-hidden="true">
        ·
      </span>
      <time dateTime={doc.updated_at} title={doc.updated_at}>
        {updated}
      </time>
    </div>
  );
}

export function relativeFromNow(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diff = Date.now() - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  if (diff < hour) {
    const m = Math.max(1, Math.floor(diff / minute));
    return `${String(m)} minute${m === 1 ? "" : "s"} ago`;
  }
  if (diff < day) {
    const h = Math.floor(diff / hour);
    return `${String(h)} hour${h === 1 ? "" : "s"} ago`;
  }
  if (diff < 2 * day) return "yesterday";
  if (diff < week) {
    const d = Math.floor(diff / day);
    return `${String(d)} days ago`;
  }
  if (diff < 4 * week) {
    const w = Math.floor(diff / week);
    return `${String(w)} week${w === 1 ? "" : "s"} ago`;
  }
  return date.toISOString().slice(0, 10);
}
