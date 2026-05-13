import type { Route } from "./+types/search";
import { Form, Link, useNavigation, useSearchParams } from "react-router";

import { searchDocs } from "../portal/api/__generated__/search/search";
import type { SearchResult } from "../portal/api/__generated__/model";
import { throwIfProblem } from "../portal/api/errors";
import { urlIdFromCanonical } from "../portal/api/docId";
import { Snippet } from "../portal/markdown";
import { Button } from "@donaldgifford/design-system";
import { Skeleton } from "../components/portal/Skeleton";
import { RouteErrorBoundary } from "../components/portal/RouteErrorBoundary";
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

  // Empty query: render the prompt state without an API call. Keeps the
  // search page cheap to land on for users browsing in from the directory.
  if (q.length === 0) {
    return { q: "", results: [] };
  }

  const response = await searchDocs({ q, limit: DEFAULT_LIMIT });
  throwIfProblem(response);
  return { q, results: response.data };
}

export default function Search({ loaderData }: Route.ComponentProps) {
  const { q, results } = loaderData;
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const isSearching = navigation.state === "loading";
  // The input renders the URL's `q` (so the value persists across reloads),
  // not the loader's already-resolved q (which would lag during navigation).
  const inputValue = searchParams.get("q") ?? "";

  return (
    <main className={styles.main} aria-busy={isSearching}>
      <header className={styles.header}>
        <nav className={styles.crumbs}>
          <Link to="/" className={styles.crumbLink}>
            Directory
          </Link>
          <span aria-hidden="true">/</span>
          <span>Search</span>
        </nav>
      </header>

      <Form method="get" role="search" className={styles.form}>
        <label htmlFor="search-q" className={styles.label}>
          Search across all documents
        </label>
        <input
          id="search-q"
          name="q"
          type="search"
          defaultValue={inputValue}
          placeholder="e.g. postgres, mermaid, ingest…"
          className={styles.input}
          autoComplete="off"
        />
        <Button type="submit" variant="primary" className={styles.submit}>
          Search
        </Button>
      </Form>

      {q.length === 0 ? (
        <p className={styles.empty}>
          Enter a query to search titles, body content, and section headings.
        </p>
      ) : results.length === 0 ? (
        <p className={styles.empty}>
          No results for <strong>{q}</strong>. Try a different query.
        </p>
      ) : (
        <ul className={styles.results}>
          {results.map((result) => (
            <SearchHit key={hitKey(result)} result={result} />
          ))}
        </ul>
      )}
    </main>
  );
}

export const ErrorBoundary = RouteErrorBoundary;

export function HydrateFallback() {
  return (
    <main className={styles.main} aria-busy="true">
      <header className={styles.header}>
        <Skeleton width="120px" height="14px" />
        <Skeleton width="92px" height="28px" variant="block" />
      </header>
      <Skeleton width="100%" height="44px" variant="block" />
      <ul className={styles.results} aria-busy="true">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className={styles.hit}>
            <Skeleton width="40%" height="20px" />
            <Skeleton width="92%" height="14px" />
            <Skeleton width="70%" height="14px" />
          </li>
        ))}
      </ul>
    </main>
  );
}

function hitKey(result: SearchResult): string {
  return [result.document.type, result.document.id, result.section_slug ?? ""].join("/");
}

interface SearchHitProps {
  result: SearchResult;
}

function SearchHit({ result }: SearchHitProps) {
  const { document, snippet, matched_terms, section_heading, section_slug, score } = result;
  const portalRoute = `/${document.type}/${urlIdFromCanonical(document.id)}${
    section_slug ? `#${section_slug}` : ""
  }`;
  const matchedTerms = matched_terms ?? [];
  return (
    <li className={styles.hit}>
      <p className={styles.hitMeta}>
        <span className={styles.hitId}>{document.id}</span>
        {typeof score === "number" ? (
          <span className={styles.hitScore} title="Relevance score">
            {score.toFixed(2)}
          </span>
        ) : null}
      </p>
      <h2 className={styles.hitTitle}>
        <Link to={portalRoute} className={styles.hitLink}>
          {document.title}
          {section_heading ? <span className={styles.hitSection}> · {section_heading}</span> : null}
        </Link>
      </h2>
      <Snippet html={snippet} fallbackTerms={matchedTerms} />
    </li>
  );
}
