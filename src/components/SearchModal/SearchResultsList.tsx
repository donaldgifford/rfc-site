import type { SearchResult } from "../../portal/api/__generated__/model";
import { StatusBadge } from "../Directory/StatusBadge";
import styles from "./SearchModal.module.css";

interface SearchResultsListProps {
  results: readonly SearchResult[];
  activeIndex: number;
  onActivate: (index: number) => void;
  onSelect: (result: SearchResult) => void;
  empty: string;
}

/**
 * Left pane — result rows grouped by document type. Mockup §1331-1393.
 *
 * Each row is a 3-part layout: a mono top row (id + small status badge),
 * a sans-serif title (with `<mark>` highlights from the snippet), and
 * a 2-line clamped snippet (also with `<mark>`).
 *
 * `<mark>` tags arrive pre-rendered from rfc-api in `SearchResult.snippet`
 * — we inject via `dangerouslySetInnerHTML` because the HTML is server-
 * sanitized to a fixed allowlist (`<em>`, `<mark>`, `<code>`).
 *
 * Phase 3 ships docs-only — labels and other non-doc result kinds wait
 * for rfc-api to emit them.
 */
export function SearchResultsList({
  results,
  activeIndex,
  onActivate,
  onSelect,
  empty,
}: SearchResultsListProps) {
  if (results.length === 0) {
    return (
      <div className={styles.list} role="listbox" aria-label="Search results">
        <p className={styles.empty}>{empty}</p>
      </div>
    );
  }

  // Group by document type so the sticky group header can show
  // `RFCs — N matches` / `ADRs — N matches` per mockup §1331.
  const groups = new Map<
    string,
    { typeLabel: string; rows: { result: SearchResult; index: number }[] }
  >();
  results.forEach((result, index) => {
    const typeLabel = pluralizeType(result.document.type);
    const existing = groups.get(result.document.type);
    if (existing) {
      existing.rows.push({ result, index });
    } else {
      groups.set(result.document.type, { typeLabel, rows: [{ result, index }] });
    }
  });

  return (
    <ul className={styles.list} role="listbox" aria-label="Search results">
      {Array.from(groups.values()).map((group) => (
        <li key={group.typeLabel}>
          <div className={styles.groupHeader}>
            {group.typeLabel} — {group.rows.length} {group.rows.length === 1 ? "match" : "matches"}
          </div>
          <ul className={styles.list} style={{ overflow: "visible" }}>
            {group.rows.map(({ result, index }) => (
              <li key={`${result.document.id}-${result.section_slug ?? ""}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={[styles.item, index === activeIndex && styles.itemActive]
                    .filter(Boolean)
                    .join(" ")}
                  onMouseEnter={() => {
                    onActivate(index);
                  }}
                  onClick={() => {
                    onSelect(result);
                  }}
                >
                  <div className={styles.itemTop}>
                    <span className={styles.itemNum}>{result.document.id}</span>
                    <span className={styles.itemStatus}>
                      <StatusBadge status={result.document.status} size="sm" />
                    </span>
                  </div>
                  <div className={styles.itemTitle}>{result.document.title}</div>
                  {result.snippet ? (
                    <div
                      className={styles.itemSnippet}
                      dangerouslySetInnerHTML={{ __html: result.snippet }}
                    />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function pluralizeType(type: string): string {
  return `${type.toUpperCase()}s`;
}
