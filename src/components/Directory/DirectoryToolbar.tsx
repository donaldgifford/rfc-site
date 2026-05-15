import { useSearchParams } from "react-router";
import { ListDocsSortParameter } from "../../portal/api/__generated__/model";
import styles from "./DirectoryToolbar.module.css";

interface DirectoryToolbarProps {
  /** Number of rows currently rendered (post-filter). */
  shownCount: number;
  /** Total rows on the server (pre-pagination, post-filter). */
  totalCount: number;
}

interface SortOption {
  value: ListDocsSortParameter;
  label: string;
}

/**
 * Sort-toggle options. The mockup §2908-2914 shows `updated ↓` + `number ↑`
 * as the two visible options; rfc-api supports six in total, but Phase 1
 * exposes the two the mockup chooses to highlight. Switching to the full
 * six is a single-line edit when needed.
 */
const SORT_OPTIONS: readonly SortOption[] = [
  { value: ListDocsSortParameter.updated_desc, label: "updated ↓" },
  { value: ListDocsSortParameter.id_asc, label: "number ↑" },
];

/**
 * Mockup default — `updated ↓`. The toolbar shows this as active when the
 * URL has no `?sort=`. The route loader sends the same value upstream so
 * the data sort matches the UI highlight.
 */
const DEFAULT_SORT: ListDocsSortParameter = ListDocsSortParameter.updated_desc;

/**
 * Filter trigger (Phase 1 stub — Authors / Labels submenus are deferred to
 * a future phase) + segmented sort toggle + results count. Mockup §354-515
 * and §2863-2920.
 *
 * URL state: `?sort=<value>`. The default sort (`created_desc`) is omitted
 * from the URL so reload-with-shareable-link works without churn. Changing
 * the sort drops `?cursor=` so pagination resets to page 1.
 */
export function DirectoryToolbar({ shownCount, totalCount }: DirectoryToolbarProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeSort: ListDocsSortParameter = readSort(searchParams.get("sort"));

  function setSort(next: ListDocsSortParameter) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete("cursor");
      if (next === DEFAULT_SORT) {
        params.delete("sort");
      } else {
        params.set("sort", next);
      }
      return params;
    });
  }

  return (
    <div className={styles.toolbar}>
      <div className={styles.left}>
        <button
          type="button"
          className={styles.filterTrigger}
          aria-label="Filter (coming soon)"
          aria-disabled="true"
          disabled
          title="Filter — coming soon"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="7" y1="12" x2="17" y2="12" />
            <line x1="10" y1="18" x2="14" y2="18" />
          </svg>
        </button>
      </div>

      <div className={styles.right}>
        <div className={styles.sortControl}>
          <span className={styles.sortLabel}>sort</span>
          <div className={styles.sortToggle} role="radiogroup" aria-label="Sort directory by">
            {SORT_OPTIONS.map((option) => {
              const isActive = option.value === activeSort;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  className={isActive ? styles.sortOptActive : styles.sortOpt}
                  onClick={() => {
                    setSort(option.value);
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className={styles.resultsCount}>
          <span className={styles.rcLabel}>Results</span>
          <span className={styles.rcValue}>
            {shownCount === totalCount
              ? shownCount
              : `${String(shownCount)} / ${String(totalCount)}`}
          </span>
        </div>
      </div>
    </div>
  );
}

function readSort(raw: string | null): ListDocsSortParameter {
  if (raw === null) return DEFAULT_SORT;
  const allowed = Object.values(ListDocsSortParameter);
  if ((allowed as string[]).includes(raw)) {
    return raw as ListDocsSortParameter;
  }
  return DEFAULT_SORT;
}
