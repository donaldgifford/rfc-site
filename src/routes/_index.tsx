import type { Route } from "./+types/_index";
import { Link } from "react-router";
import { listDocs } from "../portal/api/__generated__/docs/docs";
import type { DocumentListResponse } from "../portal/api/__generated__/model";
import { throwIfProblem } from "../portal/api/errors";
import { parseLinkHeader, type PaginationCursors } from "../portal/api/pagination";
import { DocCard } from "../components/portal/DocCard";
import { Skeleton } from "../components/portal/Skeleton";
import { ThemeToggle } from "../components/portal/ThemeToggle";
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
  readonly docs: DocumentListResponse;
  readonly cursors: PaginationCursors;
}

export async function loader({ request }: Route.LoaderArgs): Promise<IndexLoaderData> {
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;

  const response = await listDocs({ limit: DEFAULT_LIMIT, cursor });
  throwIfProblem(response);

  return {
    docs: response.data,
    cursors: parseLinkHeader(response.headers.get("link")),
  };
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const { docs, cursors } = loaderData;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.heading}>Directory</h1>
        <ThemeToggle />
      </header>

      {docs.length === 0 ? (
        <p className={styles.empty}>
          No documents yet. Check back once rfc-api has indexed at least one type.
        </p>
      ) : (
        <ul className={styles.grid}>
          {docs.map((doc) => (
            <li key={`${doc.type}/${doc.id}`}>
              <DocCard doc={doc} />
            </li>
          ))}
        </ul>
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
        <Skeleton width="92px" height="28px" variant="block" />
      </header>
      <ul className={styles.grid} aria-busy="true">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i}>
            <div className={styles.skeletonCard}>
              <Skeleton width="60px" height="14px" />
              <Skeleton width="100%" height="22px" />
              <Skeleton width="70%" height="16px" />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
