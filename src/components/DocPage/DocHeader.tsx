import type { Document } from "../../portal/api/__generated__/model";
import { NumberLine } from "./NumberLine";
import { HeaderMeta } from "./HeaderMeta";
import { urlIdFromCanonical } from "../../portal/api/docId";
import styles from "./DocHeader.module.css";

interface DocHeaderProps {
  doc: Document;
}

/**
 * Article header: NumberLine eyebrow + serif h1 + HeaderMeta row,
 * separated from the prose by a hairline border. Mockup §702-741.
 */
export function DocHeader({ doc }: DocHeaderProps) {
  return (
    <header className={styles.header}>
      <NumberLine type={doc.type} number={urlIdFromCanonical(doc.id).padStart(4, "0")} />
      <h1 className={styles.title}>{doc.title}</h1>
      <HeaderMeta doc={doc} />
    </header>
  );
}
