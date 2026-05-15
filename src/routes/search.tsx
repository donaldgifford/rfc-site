import type { Route } from "./+types/search";
import { Form, Link, useSearchParams } from "react-router";

import { searchDocs } from "../portal/api/__generated__/search/search";
import type { SearchResult } from "../portal/api/__generated__/model";
import { throwIfProblem } from "../portal/api/errors";
import { urlIdFromCanonical } from "../portal/api/docId";

const DEFAULT_LIMIT = 25;

export function meta({ loaderData }: Route.MetaArgs) {
  const q = loaderData?.q ?? "";
  const title = q.length > 0 ? `Search results for "${q}" — rfc-site` : "Search — rfc-site";
  return [{ title }];
}

interface SearchLoaderData {
  readonly q: string;
  readonly results: SearchResult[];
}

export async function loader({ request }: Route.LoaderArgs): Promise<SearchLoaderData> {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";

  if (q.length === 0) {
    return { q: "", results: [] };
  }

  const response = await searchDocs({ q, limit: DEFAULT_LIMIT });
  throwIfProblem(response);
  return { q, results: response.data };
}

export default function Search({ loaderData }: Route.ComponentProps) {
  const { q, results } = loaderData;
  const [searchParams] = useSearchParams();
  const inputValue = searchParams.get("q") ?? "";

  return (
    <main>
      <h1>Search — under construction</h1>
      <p>Phase 0 stub; rebuild lands in Phase 3 per IMPL-0005.</p>
      <Form method="get" role="search">
        <input
          name="q"
          type="search"
          defaultValue={inputValue}
          placeholder="search…"
          aria-label="Search"
        />
        <button type="submit">Search</button>
      </Form>
      {q.length > 0 ? (
        <ul>
          {results.map((result) => {
            const portalRoute = `/${result.document.type}/${urlIdFromCanonical(result.document.id)}${
              result.section_slug ? `#${result.section_slug}` : ""
            }`;
            return (
              <li
                key={`${result.document.type}/${result.document.id}/${result.section_slug ?? ""}`}
              >
                <Link to={portalRoute}>
                  {result.document.id} — {result.document.title}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
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
