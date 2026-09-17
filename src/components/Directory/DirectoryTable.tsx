import type { Document } from "../../portal/api/__generated__/model";
import { RfcRow } from "./RfcRow";
import styles from "./DirectoryTable.module.css";

interface DirectoryTableProps {
  docs: Document[];
  emptyMessage: string;
}

/**
 * Directory rows container. Mockup §517-520 — `.rfc-table` rule (just sets a
 * 4px margin top; the row visual lives in `<RfcRow>`).
 */
export function DirectoryTable({ docs, emptyMessage }: DirectoryTableProps) {
  if (docs.length === 0) {
    return <p className={styles.empty}>{emptyMessage}</p>;
  }
  return (
    <div className={styles.table}>
      {docs.map((doc) => (
        <RfcRow key={`${doc.type}/${doc.id}`} doc={doc} />
      ))}
    </div>
  );
}
