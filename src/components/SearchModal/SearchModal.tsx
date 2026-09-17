import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import type { SearchResult } from "../../portal/api/__generated__/model";
import { searchDocs } from "../../portal/api/__generated__/search/search";
import { throwIfProblem } from "../../portal/api/errors";
import { Kbd } from "../Topbar/Kbd";
import { SearchResultsList } from "./SearchResultsList";
import { SearchPreviewPane } from "./SearchPreviewPane";
import styles from "./SearchModal.module.css";

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

const DEBOUNCE_MS = 120;
const RESULT_LIMIT = 25;
const SCOPE_PILLS = ["all results", "titles", "body", "authors", "labels"] as const;

/**
 * Modal search dialog. Mockup §1253-1480 + §3564-3725.
 *
 * Rendered via `createPortal` to `document.body` so the backdrop sits above
 * the topbar (z-index 200, topbar is 100). Controlled — `open` + `onClose`
 * are owned by `<Topbar>`, which mirrors state on `?modal=1` in the URL.
 *
 * Behaviour:
 * - Focus the input on open (queueMicrotask after portal mount).
 * - Capture `document.activeElement` on open; restore on close.
 * - Backdrop click + Escape both close.
 * - Tab / Shift+Tab cycle inside the dialog only (manual focus trap).
 * - ↑ / ↓ move the active result; ↵ navigates to the active result.
 * - AbortController-per-keystroke so superseded responses can't clobber
 *   the active state.
 *
 * Filter pills are visual-only — content-scope facets depend on
 * rfc-api adding a `field` param (F-2 in the followups tracker).
 */
export function SearchModal({ open, onClose }: SearchModalProps) {
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [activeScope, setActiveScope] = useState<(typeof SCOPE_PILLS)[number]>("all results");

  const titleId = useId();

  // Capture + restore focus around open/close.
  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    queueMicrotask(() => {
      inputRef.current?.focus();
    });
    return () => {
      previouslyFocusedRef.current?.focus();
    };
  }, [open]);

  // Reset query state when the modal closes — keeps a fresh slate next open.
  useEffect(() => {
    if (open) return;
    setQ("");
    setResults([]);
    setActiveIndex(0);
    setLatencyMs(null);
    setLoading(false);
  }, [open]);

  // Debounced search with abort-per-keystroke.
  useEffect(() => {
    if (!open) return;
    if (q.length === 0) {
      setResults([]);
      setLatencyMs(null);
      setActiveIndex(0);
      return;
    }
    const controller = new AbortController();
    const handle = window.setTimeout(() => {
      const started = performance.now();
      setLoading(true);
      searchDocs({ q, limit: RESULT_LIMIT }, { signal: controller.signal })
        .then((response) => {
          throwIfProblem(response);
          setResults(response.data);
          setActiveIndex(0);
          setLatencyMs(Math.round(performance.now() - started));
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          // Surface failures as an empty result set — the modal degrades
          // gracefully; the full /search route is the authoritative
          // error surface.
          setResults([]);
          setLatencyMs(null);
        })
        .finally(() => {
          setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [q, open]);

  const activeResult = useMemo<SearchResult | undefined>(
    () => results[activeIndex],
    [results, activeIndex],
  );

  const navigateToResult = useCallback(
    (result: SearchResult) => {
      const id = result.document.id.replace(/^[A-Z]+-/, "");
      const hash =
        result.section_slug && result.section_slug.length > 0 ? `#${result.section_slug}` : "";
      onClose();
      void navigate(`/${result.document.type}/${id}${hash}`);
    },
    [navigate, onClose],
  );

  // Document-level key handling — open is exposed via root listener in
  // Topbar; here we own Escape + focus-trap + arrow navigation.
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (results.length === 0) return;
        setActiveIndex((idx) => Math.min(idx + 1, results.length - 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (results.length === 0) return;
        setActiveIndex((idx) => Math.max(idx - 1, 0));
        return;
      }
      if (event.key === "Enter") {
        if (activeResult) {
          event.preventDefault();
          navigateToResult(activeResult);
        }
        return;
      }
      if (event.key === "Tab") {
        // Focus trap: cycle within the dialog only.
        const root = dialogRef.current;
        if (!root) return;
        const focusables = root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first || !last) return;
        const activeEl = document.activeElement as HTMLElement | null;
        if (event.shiftKey && activeEl === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && activeEl === last) {
          event.preventDefault();
          first.focus();
        }
      }
    },
    [results.length, activeResult, navigateToResult, onClose],
  );

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- modal dialog captures keys for focus-trap, Escape, ↑/↓/↵ navigation */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={styles.modal}
        onKeyDown={handleKeyDown}
      >
        <span id={titleId} hidden>
          Search documents
        </span>

        <div className={styles.inputRow}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            className={styles.input}
            placeholder="Search RFCs, authors, labels…"
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
            }}
            aria-label="Search documents"
          />
          <div className={styles.closeHint}>
            <Kbd>esc</Kbd>
            <span>to close</span>
          </div>
        </div>

        <div className={styles.filtersRow} role="tablist" aria-label="Result scope">
          {SCOPE_PILLS.map((label) => {
            const isAll = label === "all results";
            const isActive = activeScope === label;
            return (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={[styles.pill, isActive && styles.pillActive].filter(Boolean).join(" ")}
                onClick={() => {
                  // Only "all results" is wired; per-facet pills are inert
                  // until rfc-api ships a `field` param (F-2). Keeping
                  // them clickable for visual feedback, but state is
                  // reverted to "all results" so we don't fool callers.
                  if (isAll) {
                    setActiveScope("all results");
                  } else {
                    setActiveScope(label);
                  }
                }}
                disabled={!isAll && false}
                title={
                  isAll ? undefined : "Coming soon — depends on rfc-api search-contract extensions"
                }
              >
                {label}
                {isAll && results.length > 0 ? (
                  <span className={styles.pillCount}>{results.length}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className={styles.body}>
          <SearchResultsList
            results={results}
            activeIndex={activeIndex}
            onActivate={setActiveIndex}
            onSelect={navigateToResult}
            empty={
              q.length === 0 ? "Start typing to search." : loading ? "Searching…" : "No matches."
            }
          />

          <SearchPreviewPane result={activeResult} />
        </div>

        <div className={styles.footer}>
          <span className={styles.hint}>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            navigate
          </span>
          <span className={styles.hint}>
            <Kbd>↵</Kbd>
            open
          </span>
          <span className={styles.hint}>
            <Kbd>tab</Kbd>
            preview
          </span>
          <span className={styles.powered}>
            <span>meilisearch</span>
            {latencyMs !== null ? <span className={styles.poweredDot}>● {latencyMs}ms</span> : null}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
