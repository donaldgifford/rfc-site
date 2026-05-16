import { Form, Link, useNavigation, useSearchParams } from "react-router";
import type { Route } from "./+types/search";

import { searchDocs } from "../portal/api/__generated__/search/search";
import type { SearchResult } from "../portal/api/__generated__/model";
import { throwIfProblem } from "../portal/api/errors";
import { urlIdFromCanonical } from "../portal/api/docId";
import { StatusBadge } from "../components/Directory/StatusBadge";
import styles from "./search.module.css";

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
  const navigation = useNavigation();
  const inputValue = searchParams.get("q") ?? "";
  const isSearching = navigation.state === "loading";

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Portal · Search</p>
        <h1 className={styles.title}>Search documents</h1>
        <p className={styles.subtitle}>
          No-JS fallback for the <kbd>⌘K</kbd> modal. Type a query and press Enter.
        </p>
      </header>

      <Form method="get" role="search" className={styles.form}>
        <input
          name="q"
          type="search"
          defaultValue={inputValue}
          placeholder="Search RFCs, authors, labels…"
          aria-label="Search"
          className={styles.input}
        />
        <button type="submit" className={styles.submit}>
          Search
        </button>
      </Form>

      {q.length === 0 ? (
        <p className={styles.empty}>Start typing above to search.</p>
      ) : isSearching ? (
        <p className={styles.empty}>Searching…</p>
      ) : results.length === 0 ? (
        <p className={styles.empty}>No results for &ldquo;{q}&rdquo;.</p>
      ) : (
        <ol className={styles.list} aria-label={`${String(results.length)} results for ${q}`}>
          {results.map((result) => {
            const numericId = urlIdFromCanonical(result.document.id);
            const hash =
              result.section_slug && result.section_slug.length > 0
                ? `#${result.section_slug}`
                : "";
            const portalRoute = `/${result.document.type}/${numericId}${hash}`;
            return (
              <li
                key={`${result.document.id}-${result.section_slug ?? ""}`}
                className={styles.item}
              >
                <Link to={portalRoute} className={styles.itemLink}>
                  <div className={styles.itemTop}>
                    <span className={styles.itemNum}>{result.document.id}</span>
                    <StatusBadge status={result.document.status} size="sm" />
                  </div>
                  <div className={styles.itemTitle}>{result.document.title}</div>
                  {result.snippet ? (
                    <div
                      className={styles.itemSnippet}
                      dangerouslySetInnerHTML={{ __html: result.snippet }}
                    />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <main className={styles.main}>
      <h1>Error</h1>
      <pre>{error instanceof Error ? error.message : String(error)}</pre>
    </main>
  );
}

export function HydrateFallback() {
  return (
    <main className={styles.main} aria-busy="true">
      <h1>Loading…</h1>
    </main>
  );
}
