import { urlIdFromCanonical } from "../../portal/api/docId";
import type { SearchResult } from "../../portal/api/__generated__/model";
import { StatusBadge } from "../Directory/StatusBadge";
import { relativeFromNow } from "../DocPage/HeaderMeta";
import styles from "./SearchModal.module.css";

interface SearchPreviewPaneProps {
  result: SearchResult | undefined;
}

/**
 * Right pane — preview of the active result. Mockup §1401-1456.
 *
 * Lazily fetches the full document via `useGetDoc` only when a hit is
 * active. The header renders the NumberLine eyebrow + serif title +
 * mono meta row; the body shows the rendered snippet HTML so the user
 * sees the match context without a full Markdown render.
 *
 * The mockup shows section h3 headings (`Summary` / `Motivation`),
 * but we don't currently get section content back from `searchDocs` —
 * we render the snippet HTML as the body until rfc-api exposes a
 * per-section content endpoint.
 */
export function SearchPreviewPane({ result }: SearchPreviewPaneProps) {
  if (!result) {
    return (
      <aside className={styles.preview} aria-label="Preview">
        <p className={styles.previewEmpty}>Select a result to preview.</p>
      </aside>
    );
  }

  const { document: doc, snippet, section_heading: sectionHeading } = result;
  const numericId = urlIdFromCanonical(doc.id).padStart(4, "0");

  return (
    <aside className={styles.preview} aria-label="Preview">
      <header className={styles.previewHeader}>
        <div className={styles.previewNumberLine}>
          {doc.type.toUpperCase()} / {numericId}
        </div>
        <h3 className={styles.previewTitle}>{doc.title}</h3>
        <div className={styles.previewMeta}>
          <StatusBadge status={doc.status} />
          <span className={styles.previewMetaDivider} aria-hidden="true">
            ·
          </span>
          <span>{(doc.authors ?? []).map((a) => a.name).join(", ") || "—"}</span>
          {doc.updated_at ? (
            <>
              <span className={styles.previewMetaDivider} aria-hidden="true">
                ·
              </span>
              <time dateTime={doc.updated_at}>{relativeFromNow(doc.updated_at)}</time>
            </>
          ) : null}
        </div>
      </header>
      <div className={styles.previewBody}>
        {sectionHeading ? <h3>{sectionHeading}</h3> : null}
        {snippet ? (
          <p dangerouslySetInnerHTML={{ __html: snippet }} />
        ) : (
          <p className={styles.previewEmpty}>
            Match found in title or metadata — open the document for the full body.
          </p>
        )}
      </div>
    </aside>
  );
}
