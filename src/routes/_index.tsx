import type { Route } from "./+types/_index";
import { listDocs } from "../portal/api/__generated__/docs/docs";
import type {
  DocumentListFilterableResponse,
  ListDocsSortParameter,
} from "../portal/api/__generated__/model";
import { throwIfProblem } from "../portal/api/errors";
import { parseLinkHeader, type PaginationCursors } from "../portal/api/pagination";

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
  readonly totalCount: number;
  readonly totalUnfiltered: number | undefined;
}

export async function loader({ request }: Route.LoaderArgs): Promise<IndexLoaderData> {
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;

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
  const { docs, totalCount } = loaderData;
  return (
    <main>
      <h1>Directory — under construction</h1>
      <p>
        Phase 0 stub; rebuild lands in Phase 1 per IMPL-0005. Loader fetched {docs.length} of{" "}
        {totalCount} docs.
      </p>
    </main>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <main>
      <h1>Error</h1>
      <pre>{error instanceof Error ? error.message : String(error)}</pre>
    </main>
  );
}

export function HydrateFallback() {
  return (
    <main aria-busy="true">
      <h1>Loading…</h1>
    </main>
  );
}
