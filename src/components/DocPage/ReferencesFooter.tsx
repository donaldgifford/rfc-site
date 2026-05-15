import { Link } from "react-router";
import type { Document, Link as DocLink } from "../../portal/api/__generated__/model";
import { apiHrefToPortalRoute } from "../../portal/api/docId";
import styles from "./ReferencesFooter.module.css";

interface ReferencesFooterProps {
  doc: Document;
}

/**
 * Article-footer references block. Mockup §1190-1247 + §3506-3537.
 *
 * Two columns: outgoing references derived from `Document.links[]` and
 * an empty "Referenced by" column. Back-references require a separate
 * rfc-api endpoint (followups tracker F-2) — surfaces the empty-state
 * placeholder until that ships.
 */
export function ReferencesFooter({ doc }: ReferencesFooterProps) {
  const outgoing = (doc.links ?? []).filter((link) => link.direction === "outgoing");
  return (
    <footer className={styles.footer}>
      <div>
        <h2 className={styles.heading}>References</h2>
        <ul className={styles.list}>
          {outgoing.length === 0 ? (
            <li className={styles.empty}>This document doesn&rsquo;t reference any others.</li>
          ) : (
            outgoing.map((link) => (
              <li key={`${link.target}:${link.href}`}>
                <ReferenceRow link={link} />
              </li>
            ))
          )}
        </ul>
      </div>
      <div>
        <h2 className={styles.heading}>Referenced by</h2>
        <ul className={styles.list}>
          <li className={styles.empty}>
            None yet &mdash; back-references arrive once rfc-api exposes the endpoint.
          </li>
        </ul>
      </div>
    </footer>
  );
}

function ReferenceRow({ link }: { link: DocLink }) {
  const portalRoute = apiHrefToPortalRoute(link.href);
  const labelText = link.label ?? "";
  if (portalRoute !== null) {
    return (
      <Link to={portalRoute} className={styles.ref}>
        <span className={styles.refNum}>{link.target}</span>
        {labelText.length > 0 ? <span className={styles.refTitle}>{labelText}</span> : null}
      </Link>
    );
  }
  // External / unresolved hrefs render as inert chrome — the data was
  // emitted by rfc-api so we still surface it.
  return (
    <span className={styles.ref}>
      <span className={styles.refNum}>{link.target}</span>
      {labelText.length > 0 ? <span className={styles.refTitle}>{labelText}</span> : null}
    </span>
  );
}
