/**
 * `<SearchModal>` — overlay search experience for the portal.
 *
 * IMPL-0004 Phase 9. The legacy `/search` route (IMPL-0003 Phase 7)
 * stays as the no-JS fallback + direct-deep-link destination per
 * Resolved §11; this composite is what the topbar's search trigger and
 * the global `⌘K` shortcut open from any route.
 *
 * Controlled API: parent owns the `open` + `onOpenChange` state. The
 * modal mounts a fixed-position overlay above a translucent backdrop;
 * focus moves to the input on open, `Escape` closes, backdrop click
 * closes. Results list re-uses the same `searchDocs` payload + Snippet
 * rendering as the route so behaviour is consistent across surfaces.
 *
 * Scope notes (per IMPL-0004 Phase 9 — deferred to follow-ups):
 *   - Filter pills (`<Badge variant="filter">`) gate on the upstream
 *     design-system 0.4.0 release.
 *   - Grouped-by-type results + sticky group headers.
 *   - Side preview pane on hover.
 *   - Full WAI-ARIA Dialog focus-trap polish.
 */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type SyntheticEvent,
} from "react";
import { Link } from "react-router";

import { searchDocs } from "../../../portal/api/__generated__/search/search";
import type { SearchResult } from "../../../portal/api/__generated__/model";
import { urlIdFromCanonical } from "../../../portal/api/docId";
import { Input, Kbd } from "@donaldgifford/design-system";

import { Button } from "../../ds-candidates/Button";
import { Snippet } from "../../../portal/markdown";

import styles from "./SearchModal.module.css";

const DEFAULT_LIMIT = 25;

export interface SearchModalProps {
  /** Controlled open state. */
  open: boolean;
  /** Close handler — called on backdrop click, Escape, or programmatically. */
  onOpenChange: (open: boolean) => void;
}

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const titleId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [errored, setErrored] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const close = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // Focus the input when the modal opens.
  useEffect(() => {
    if (!open) return;
    // useEffect runs after paint; focus on the next tick to ensure the
    // input is mounted.
    queueMicrotask(() => {
      inputRef.current?.focus();
    });
  }, [open]);

  // Global Escape — bound only while open so we don't fight other listeners.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  // Reset state when the modal closes so re-opening starts fresh.
  useEffect(() => {
    if (open) return;
    setQuery("");
    setResults([]);
    setErrored(false);
    setSearching(false);
    abortRef.current?.abort();
    abortRef.current = null;
  }, [open]);

  const runSearch = useCallback(async (q: string) => {
    if (q.length === 0) {
      setResults([]);
      setSearching(false);
      setErrored(false);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);
    setErrored(false);
    try {
      const response = await searchDocs({ q, limit: DEFAULT_LIMIT }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (response.status === 200) {
        setResults(response.data);
      } else {
        setErrored(true);
        setResults([]);
      }
    } catch {
      if (controller.signal.aborted) return;
      // Network or AbortError — show inert error surface.
      setErrored(true);
      setResults([]);
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  }, []);

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runSearch(query.trim());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void runSearch(query.trim());
    }
  };

  if (!open) return null;

  return (
    <div className={styles.overlay}>
      <button type="button" className={styles.backdrop} aria-label="Close search" onClick={close} />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={styles.dialog}>
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            Search documents
          </h2>
          <Button variant="ghost" size="sm" onClick={close} aria-label="Close search dialog">
            Close
          </Button>
        </header>

        <form role="search" className={styles.form} onSubmit={handleSubmit}>
          <Input
            ref={inputRef}
            type="search"
            size="md"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search titles, body content, section headings…"
            aria-label="Search query"
            autoComplete="off"
          />
        </form>

        <div className={styles.body}>
          {errored ? (
            <p className={styles.empty}>Search failed — try again.</p>
          ) : searching ? (
            <p className={styles.empty}>Searching…</p>
          ) : query.length === 0 ? (
            <p className={styles.empty}>
              Type a query and press <Kbd size="sm">Enter</Kbd> to search.
            </p>
          ) : results.length === 0 ? (
            <p className={styles.empty}>
              No results for <strong>{query}</strong>.
            </p>
          ) : (
            <ul className={styles.results}>
              {results.map((result) => (
                <ModalHit key={hitKey(result)} result={result} onSelect={close} />
              ))}
            </ul>
          )}
        </div>

        <footer className={styles.footer}>
          <span>
            <Kbd size="sm">Esc</Kbd> close
          </span>
          <span>
            <Kbd size="sm">↵</Kbd> search
          </span>
        </footer>
      </div>
    </div>
  );
}

function hitKey(result: SearchResult): string {
  return [result.document.type, result.document.id, result.section_slug ?? ""].join("/");
}

function ModalHit({ result, onSelect }: { result: SearchResult; onSelect: () => void }) {
  const { document, snippet, matched_terms, section_heading, section_slug } = result;
  const portalRoute = `/${document.type}/${urlIdFromCanonical(document.id)}${
    section_slug !== undefined && section_slug !== "" ? `#${section_slug}` : ""
  }`;
  const matchedTerms = matched_terms ?? [];
  return (
    <li className={styles.hit}>
      <Link to={portalRoute} className={styles.hitLink} onClick={onSelect}>
        <p className={styles.hitMeta}>
          <span className={styles.hitId}>{document.id}</span>
        </p>
        <p className={styles.hitTitle}>
          {document.title}
          {section_heading !== undefined && section_heading !== "" ? (
            <span className={styles.hitSection}> · {section_heading}</span>
          ) : null}
        </p>
        <Snippet html={snippet} fallbackTerms={matchedTerms} />
      </Link>
    </li>
  );
}
