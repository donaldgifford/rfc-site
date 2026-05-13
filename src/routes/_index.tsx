import type { Route } from "./+types/_index";
import { Link } from "react-router";
import { listDocs } from "../portal/api/__generated__/docs/docs";
import type {
  DocumentListFilterableResponse,
  ListDocsSortParameter,
} from "../portal/api/__generated__/model";
import { throwIfProblem } from "../portal/api/errors";
import { parseLinkHeader, type PaginationCursors } from "../portal/api/pagination";
import { DirectoryTable } from "../components/portal/DirectoryTable";
import { DirectoryToolbar } from "../components/portal/DirectoryToolbar";
import { Skeleton } from "../components/portal/Skeleton";
import { RouteErrorBoundary } from "../components/portal/RouteErrorBoundary";
import styles from "./_index.module.css";

const DEFAULT_LIMIT = 24;

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "rfc-site — directory" },
    {
      name: "description",
      content: "RFCs, ADRs, and design docs across the rfc-api content surface.",
    },
  ];
}

interface IndexLoaderData {
  readonly docs: DocumentListFilterableResponse;
  readonly cursors: PaginationCursors;
  /** X-Total-Count from the response (filtered total when filters are active). */
  readonly totalCount: number;
  /**
   * X-Total-Count-Unfiltered — present only when at least one filter is
   * active. Used by the empty-state branch to distinguish "no matches
   * in this filter" from "no docs at all".
   */
  readonly totalUnfiltered: number | undefined;
}

export async function loader({ request }: Route.LoaderArgs): Promise<IndexLoaderData> {
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;

  // Pass-through the URL's filter[] + sort into listDocs (DESIGN-0003).
  // The generated client serialises filter as a repeated query param;
  // sort is single-valued. Invalid sort or filter values propagate as
  // 400 problem+json — out-of-band URLs surface through the route
  // error boundary instead of silently falling back, which would
  // desync the toolbar's URL state from the rendered result set.
  const filterValues = url.searchParams.getAll("filter");
  const sortRaw = url.searchParams.get("sort");

  const response = await listDocs({
    limit: DEFAULT_LIMIT,
    cursor,
    ...(filterValues.length > 0 ? { filter: filterValues } : {}),
    ...(sortRaw !== null && sortRaw.length > 0 ? { sort: sortRaw as ListDocsSortParameter } : {}),
  });
  throwIfProblem(response);

  return {
    docs: response.data,
    cursors: parseLinkHeader(response.headers.get("link")),
    totalCount: parseCount(response.headers.get("x-total-count")),
    totalUnfiltered: parseOptionalCount(response.headers.get("x-total-count-unfiltered")),
  };
}

function parseCount(raw: string | null): number {
  if (raw === null) return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function parseOptionalCount(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const { docs, cursors, totalCount, totalUnfiltered } = loaderData;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.heading}>Directory</h1>
      </header>

      <DirectoryToolbar totalCount={totalCount} totalUnfiltered={totalUnfiltered} />

      {docs.length === 0 ? (
        <p className={styles.empty}>
          {totalUnfiltered !== undefined
            ? "No documents match this filter. Clear filters to see all docs."
            : "No documents yet. Check back once rfc-api has indexed at least one type."}
        </p>
      ) : (
        <DirectoryTable documents={docs} />
      )}

      {cursors.next || cursors.prev ? (
        <nav className={styles.pagination} aria-label="Pagination">
          {cursors.prev ? (
            <Link to={`/?cursor=${encodeURIComponent(cursors.prev)}`} className={styles.pageLink}>
              ← Previous
            </Link>
          ) : (
            <span className={styles.pageLinkDisabled}>← Previous</span>
          )}
          {cursors.next ? (
            <Link to={`/?cursor=${encodeURIComponent(cursors.next)}`} className={styles.pageLink}>
              Next →
            </Link>
          ) : (
            <span className={styles.pageLinkDisabled}>Next →</span>
          )}
        </nav>
      ) : null}
    </main>
  );
}

export const ErrorBoundary = RouteErrorBoundary;

export function HydrateFallback() {
  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <Skeleton width="160px" height="38px" variant="block" />
      </header>
      <div className={styles.skeletonTable} aria-busy="true">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className={styles.skeletonRow}>
            <Skeleton width="80px" height="14px" />
            <Skeleton width="100%" height="14px" />
            <Skeleton width="80px" height="20px" />
            <Skeleton width="120px" height="14px" />
            <Skeleton width="80px" height="14px" />
          </div>
        ))}
      </div>
    </main>
  );
}
