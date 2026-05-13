/**
 * `<DirectoryToolbar>` — IMPL-0004 Phase 7b. Sits above `<DirectoryTable>`
 * on the `/` directory route and drives the URL-state filter + sort
 * contract shipped in rfc-api v0.3.0 / DESIGN-0003.
 *
 * Behaviour
 * - **Filter:** multi-select on `Document.type` via `<Badge variant="filter">`
 *   pills inside a native `<details>` disclosure. The summary doubles as a
 *   `<Button variant="secondary">` shape so users get the dropdown affordance
 *   without a Popover primitive (Resolved §7 — defer Popover until a route
 *   needs it). Selected types serialize to repeated `?filter=type:<id>`
 *   query params; the loader picks them up via `searchParams.getAll("filter")`.
 * - **Sort:** native `<select>` over the six rfc-api v0.3.0 sort keys.
 *   Empty selection (default) maps to `?sort=` absence — server uses
 *   `created_desc` (DESIGN-0003 OQ3-b — preserves today's behavior).
 * - **Cursor invalidation:** any filter or sort change deletes
 *   `?cursor=` from the URL atomically with the new param. rfc-api
 *   returns 400 on cursor-sort mismatch (DESIGN-0003 §Cursor encoding),
 *   and a cursor offset minted under one filter scope is meaningless
 *   under another — both invariants protected by deleting cursor on
 *   any toolbar interaction.
 * - **Results count:** `N of M shown` when a filter is active (uses
 *   `X-Total-Count-Unfiltered` from the loader); falls back to
 *   `N documents` when unfiltered.
 *
 * Per DESIGN-0001 §portal-only, `<DirectoryToolbar>` is never promoted.
 */

import { useCallback } from "react";
import { useSearchParams } from "react-router";
import { Badge, Button } from "@donaldgifford/design-system";

import styles from "./DirectoryToolbar.module.css";

interface FilterableType {
  readonly id: string;
  readonly label: string;
}

/**
 * The six portal-supported types. Mirrors `<SearchModal>`'s FILTER_TYPES
 * + the rfc-api fixture tree + the canonical-id prefixes recognised by
 * `rfc-api`. Phase 1 of DESIGN-0003 only validates the `type` field;
 * extending this list requires the corresponding rfc-api registry entry.
 */
const FILTER_TYPES: readonly FilterableType[] = [
  { id: "rfc", label: "RFC" },
  { id: "adr", label: "ADR" },
  { id: "design", label: "Design" },
  { id: "impl", label: "Impl" },
  { id: "plan", label: "Plan" },
  { id: "inv", label: "Inv" },
];

interface SortOption {
  readonly value: string;
  readonly label: string;
}

const SORT_OPTIONS: readonly SortOption[] = [
  { value: "created_desc", label: "Newest first" },
  { value: "created_asc", label: "Oldest first" },
  { value: "updated_desc", label: "Recently updated" },
  { value: "updated_asc", label: "Least recently updated" },
  { value: "id_asc", label: "ID A→Z" },
  { value: "id_desc", label: "ID Z→A" },
];

const DEFAULT_SORT = "created_desc";

export interface DirectoryToolbarProps {
  /** `X-Total-Count` from the loader (filtered total when filter is active). */
  totalCount: number;
  /**
   * `X-Total-Count-Unfiltered` — present iff at least one filter is
   * active on the inbound request. Used to render the `N of M shown`
   * widget; absence means render plain `N documents`.
   */
  totalUnfiltered: number | undefined;
}

export function DirectoryToolbar({ totalCount, totalUnfiltered }: DirectoryToolbarProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTypes = parseTypeFilters(searchParams);
  const activeSort = searchParams.get("sort") ?? DEFAULT_SORT;
  const hasActiveFilter = activeTypes.size > 0;

  const toggleType = useCallback(
    (typeId: string) => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        const current = parseTypeFilters(params);
        if (current.has(typeId)) {
          current.delete(typeId);
        } else {
          current.add(typeId);
        }
        params.delete("filter");
        for (const id of current) {
          params.append("filter", `type:${id}`);
        }
        // First page of the new view — keyset cursors are scoped to
        // a specific (filter, sort) pair.
        params.delete("cursor");
        return params;
      });
    },
    [setSearchParams],
  );

  const clearTypes = useCallback(() => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete("filter");
      params.delete("cursor");
      return params;
    });
  }, [setSearchParams]);

  const setSort = useCallback(
    (value: string) => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        if (value === DEFAULT_SORT) {
          params.delete("sort");
        } else {
          params.set("sort", value);
        }
        // rfc-api 400s on cursor-sort mismatch — drop the cursor so
        // the next request lands on page 1 of the new sort.
        params.delete("cursor");
        return params;
      });
    },
    [setSearchParams],
  );

  return (
    <div role="toolbar" aria-label="Directory filters and sort" className={styles.root}>
      <details className={styles.filterDropdown}>
        <summary className={styles.filterSummary}>
          <Button type="button" variant="secondary" size="sm" asChild aria-haspopup="listbox">
            <span>{hasActiveFilter ? `Type (${String(activeTypes.size)})` : "Type"}</span>
          </Button>
        </summary>
        <div role="listbox" aria-multiselectable="true" className={styles.filterPanel}>
          <FilterPill
            label="All"
            selected={!hasActiveFilter}
            onActivate={clearTypes}
            data-testid="directory-filter-all"
          />
          {FILTER_TYPES.map((type) => (
            <FilterPill
              key={type.id}
              label={type.label}
              selected={activeTypes.has(type.id)}
              onActivate={() => {
                toggleType(type.id);
              }}
              data-testid={`directory-filter-${type.id}`}
            />
          ))}
        </div>
      </details>

      <label className={styles.sortLabel}>
        <span className={styles.sortLabelText}>Sort</span>
        <select
          value={activeSort}
          onChange={(event) => {
            setSort(event.target.value);
          }}
          className={styles.sortSelect}
          aria-label="Sort directory"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <p className={styles.count} aria-live="polite">
        {totalUnfiltered !== undefined ? (
          <>
            <strong>{totalCount}</strong> of {totalUnfiltered} shown
          </>
        ) : (
          <>
            <strong>{totalCount}</strong> {totalCount === 1 ? "document" : "documents"}
          </>
        )}
      </p>
    </div>
  );
}

function parseTypeFilters(params: URLSearchParams): Set<string> {
  const result = new Set<string>();
  for (const value of params.getAll("filter")) {
    const match = /^type:(.+)$/.exec(value);
    if (match) {
      result.add(match[1] ?? "");
    }
  }
  return result;
}

interface FilterPillProps {
  label: string;
  selected: boolean;
  onActivate: () => void;
  "data-testid"?: string;
}

function FilterPill({ label, selected, onActivate, ...rest }: FilterPillProps) {
  return (
    <button
      type="button"
      className={styles.filterPill}
      onClick={onActivate}
      data-testid={rest["data-testid"]}
    >
      <Badge variant="filter" selected={selected}>
        {label}
      </Badge>
    </button>
  );
}
