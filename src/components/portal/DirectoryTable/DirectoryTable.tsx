/**
 * `<DirectoryTable>` — directory grid rendered as a semantic `<table>`.
 *
 * Replaces the IMPL-0001 Phase 4 `<DocCard>` grid for the `/`
 * directory route (IMPL-0004 Phase 7 — see Resolved §13: `<DocCard>`
 * itself stays in `portal/` until a second consumer materialises).
 *
 * Columns: id, title, status, authors, updated. Title is the only
 * clickable cell; the row's accessible name comes from the link
 * (table-rows aren't focusable themselves, which is the WAI-ARIA pattern
 * for sortable / filterable data tables).
 *
 * No filter / sort wiring lives here yet — the Phase 7 toolbar work is
 * paused pending the upstream contract change for `listDocs`'s `?filter=`
 * / `?sort=` params (see IMPL-0004 Phase 7 prerequisite). The table
 * itself is independent of those params and ships in this slice.
 */

import { Link } from "react-router";
import { Badge } from "@donaldgifford/design-system";

import type { Document } from "../../../portal/api/__generated__/model";
import { urlIdFromCanonical } from "../../../portal/api/docId";

import styles from "./DirectoryTable.module.css";

export interface DirectoryTableProps {
  /** Documents to render, in the order they should appear. */
  documents: readonly Document[];
}

export function DirectoryTable({ documents }: DirectoryTableProps) {
  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col" className={styles.idCol}>
              ID
            </th>
            <th scope="col" className={styles.titleCol}>
              Title
            </th>
            <th scope="col" className={styles.statusCol}>
              Status
            </th>
            <th scope="col" className={styles.authorsCol}>
              Authors
            </th>
            <th scope="col" className={styles.updatedCol}>
              Updated
            </th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={`${doc.type}/${doc.id}`}>
              <td className={styles.idCell}>
                <span className={styles.id}>{doc.id}</span>
              </td>
              <td className={styles.titleCell}>
                <Link
                  to={`/${doc.type}/${urlIdFromCanonical(doc.id)}`}
                  className={styles.titleLink}
                >
                  {doc.title}
                </Link>
              </td>
              <td className={styles.statusCell}>
                <Badge status={doc.status} />
              </td>
              <td className={styles.authorsCell}>{formatAuthors(doc.authors)}</td>
              <td className={styles.updatedCell}>
                <time dateTime={doc.updated_at}>{formatDate(doc.updated_at)}</time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatAuthors(authors: Document["authors"]): string {
  if (authors === undefined || authors.length === 0) return "—";
  return authors.map((a) => a.name).join(", ");
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
