import type { Document } from "../../portal/api/__generated__/model";
import styles from "./DocSidebar.module.css";

interface DocSidebarProps {
  doc: Document;
}

/**
 * Left sidebar metadata block. Mockup §3120-3137.
 *
 * Two `.sidebar-section`s — Metadata + Labels. Empty labels block is
 * omitted entirely. Status colour is mapped via inline `style` (mockup
 * uses the same trick) so the val text matches the `--status-*` token
 * exactly without a Badge box.
 */
export function DocSidebar({ doc }: DocSidebarProps) {
  const authors = doc.authors ?? [];
  const labels = doc.labels ?? [];
  const created = toDateOnly(doc.created_at);
  const updated = relativeFromNow(doc.updated_at);
  const revision = (doc.source.commit ?? "").slice(0, 7);
  const prTag = derivePrTag(doc.discussion?.url);

  return (
    <>
      <section className={styles.section}>
        <h2 className={styles.heading}>Metadata</h2>
        <div className={styles.row}>
          <span className={styles.key}>Status</span>
          <span className={styles.val} style={{ color: statusColor(doc.status) }}>
            {capitalize(doc.status)}
          </span>
        </div>
        {authors.length > 0 ? (
          <div className={styles.row}>
            <span className={styles.key}>{authors.length === 1 ? "Author" : "Authors"}</span>
            <span className={styles.val}>{authors.map((a) => a.name).join(", ")}</span>
          </div>
        ) : null}
        <div className={styles.row}>
          <span className={styles.key}>Created</span>
          <span className={styles.val}>{created}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.key}>Updated</span>
          <span className={styles.val}>{updated}</span>
        </div>
        {revision.length > 0 ? (
          <div className={styles.row}>
            <span className={styles.key}>Revision</span>
            <span className={styles.val}>{revision}</span>
          </div>
        ) : null}
        {prTag !== null && doc.discussion?.url ? (
          <div className={styles.row}>
            <span className={styles.key}>PR</span>
            <a
              className={styles.valLink}
              href={doc.discussion.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {prTag}
            </a>
          </div>
        ) : null}
      </section>

      {labels.length > 0 ? (
        <section className={styles.section}>
          <h2 className={styles.heading}>Labels</h2>
          <div className={styles.labels}>
            {labels.map((label) => (
              <span key={label} className={styles.labelTag}>
                {label}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function statusColor(status: string): string {
  const palette: Record<string, string> = {
    draft: "var(--status-draft)",
    proposed: "var(--status-proposed)",
    accepted: "var(--status-accepted)",
    rejected: "var(--status-rejected)",
    superseded: "var(--status-superseded)",
    abandoned: "var(--status-abandoned)",
    published: "var(--status-accepted)",
    discussion: "var(--status-superseded)",
  };
  return palette[status] ?? "var(--fg-primary)";
}

function capitalize(s: string): string {
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toDateOnly(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toISOString().slice(0, 10);
}

function relativeFromNow(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diff = Date.now() - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  if (diff < hour) {
    const m = Math.max(1, Math.floor(diff / minute));
    return `${String(m)}m ago`;
  }
  if (diff < day) {
    const h = Math.floor(diff / hour);
    return `${String(h)}h ago`;
  }
  if (diff < 2 * day) return "Yesterday";
  if (diff < week) {
    const d = Math.floor(diff / day);
    return `${String(d)}d ago`;
  }
  if (diff < 4 * week) {
    const w = Math.floor(diff / week);
    return `${String(w)}w ago`;
  }
  return date.toISOString().slice(0, 10);
}

/**
 * Derive a short PR tag like "#412" from a GitHub PR URL's trailing
 * segment. Falls back to the host + last segment for non-GitHub URLs.
 * Returns null when the URL is unparseable.
 */
function derivePrTag(url: string | undefined): string | null {
  if (url === undefined) return null;
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last === undefined) return null;
    if (/^\d+$/.test(last)) return `#${last}`;
    return last;
  } catch {
    return null;
  }
}
