import { useMemo, useState } from "react";
import type { Route } from "./+types/_index";
import { listDocs } from "../portal/api/__generated__/docs/docs";
import type {
  DocumentListFilterableResponse,
  ListDocsSortParameter,
} from "../portal/api/__generated__/model";
import { throwIfProblem } from "../portal/api/errors";
import { parseLinkHeader, type PaginationCursors } from "../portal/api/pagination";
import {
  DirectoryHero,
  DirectoryTable,
  DirectoryToolbar,
  LiveFilter,
} from "../components/Directory";
import styles from "./_index.module.css";

const DEFAULT_LIMIT = 24;
const RFC_ONLY_FILTER = "type:rfc";
// Match the UI default in <DirectoryToolbar>. Mockup highlights "updated ↓".
const DEFAULT_SORT: ListDocsSortParameter = "updated_desc";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Request for Comments — rfc-site" },
    {
      name: "description",
      content: "Browse and search RFCs in the rfc-api portal.",
    },
  ];
}

interface IndexLoaderData {
  readonly docs: DocumentListFilterableResponse;
  readonly cursors: PaginationCursors;
  readonly totalCount: number;
  readonly totalUnfiltered: number | undefined;
}

export async function loader({ request }: Route.LoaderArgs): Promise<IndexLoaderData> {
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const sortRaw = url.searchParams.get("sort");

  // Pin filter=type:rfc per RFC-0001 (RFC-only scope) when no filter is set.
  // If the URL already has explicit filters, honour them — out-of-band tools
  // and tests can still inspect other types.
  const rawFilters = url.searchParams.getAll("filter");
  const filter = rawFilters.length > 0 ? rawFilters : [RFC_ONLY_FILTER];

  const sort: ListDocsSortParameter =
    sortRaw !== null && sortRaw.length > 0 ? (sortRaw as ListDocsSortParameter) : DEFAULT_SORT;

  const response = await listDocs({
    limit: DEFAULT_LIMIT,
    cursor,
    filter,
    sort,
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
  const { docs, totalCount, totalUnfiltered } = loaderData;
  const [filterQuery, setFilterQuery] = useState("");

  // Client-side narrowing — keeps the server-side total stable while the
  // user types. Matches against id, title, and any author name/handle.
  const filteredDocs = useMemo(() => {
    const needle = filterQuery.trim().toLowerCase();
    if (needle.length === 0) return docs;
    return docs.filter((doc) => {
      if (doc.id.toLowerCase().includes(needle)) return true;
      if (doc.title.toLowerCase().includes(needle)) return true;
      const authors = doc.authors ?? [];
      return authors.some(
        (author) =>
          author.name.toLowerCase().includes(needle) ||
          (author.handle?.toLowerCase().includes(needle) ?? false),
      );
    });
  }, [docs, filterQuery]);

  const emptyMessage =
    docs.length === 0 && totalUnfiltered !== undefined
      ? "No documents match this filter. Clear filters to see all docs."
      : docs.length === 0
        ? "No documents yet. Check back once rfc-api has indexed at least one type."
        : "No matches for that query. Clear the filter to see all rows.";

  return (
    <main className={styles.container}>
      <DirectoryHero eyebrow="/ docs / rfcs" title="Request for Comments">
        <LiveFilter value={filterQuery} onChange={setFilterQuery} />
      </DirectoryHero>

      <DirectoryToolbar shownCount={filteredDocs.length} totalCount={totalCount} />

      <DirectoryTable docs={filteredDocs} emptyMessage={emptyMessage} />
    </main>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <main className={styles.container}>
      <h1>Error</h1>
      <pre>{error instanceof Error ? error.message : String(error)}</pre>
    </main>
  );
}

export function HydrateFallback() {
  return (
    <main className={styles.container} aria-busy="true">
      <DirectoryHero eyebrow="/ docs / rfcs" title="Request for Comments" />
    </main>
  );
}
