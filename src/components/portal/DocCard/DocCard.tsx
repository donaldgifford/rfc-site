import { Link } from "react-router";
import type { Document } from "../../../portal/api/__generated__/model";
import { StatusPill } from "../StatusPill";
import styles from "./DocCard.module.css";

/**
 * Directory card for a single `Document`. Mirrors the "01 · Directory"
 * view in the design-system mockup
 * (`donaldgifford/design-system/rfc-portal-mockup_15.html`).
 *
 * Card is a link wrapper — the entire surface is clickable and routes
 * to `/$type/$id`. Inner status / authors / date are decoration; the
 * accessible name is the doc title.
 */
export function DocCard({ doc }: { doc: Document }) {
  const updated = formatDate(doc.updated_at);
  const authors = (doc.authors ?? []).map((a) => a.name).join(", ");

  return (
    <Link to={`/${doc.type}/${doc.id}`} className={styles.card} aria-label={doc.title}>
      <div className={styles.head}>
        <span className={styles.id}>{doc.id}</span>
        <StatusPill status={doc.status} />
      </div>
      <h2 className={styles.title}>{doc.title}</h2>
      <p className={styles.meta}>
        {authors.length > 0 ? <span className={styles.authors}>{authors}</span> : null}
        {authors.length > 0 ? <span aria-hidden="true">·</span> : null}
        <time dateTime={doc.updated_at}>{updated}</time>
      </p>
    </Link>
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
