/**
 * `<Topbar>` — portal-only composite that lives in `src/root.tsx`'s
 * Layout. Sticky 3-col grid: brand on the left, read-only `<Input>`
 * search trigger in the centre, `<ThemeToggle>` + future-route nav
 * placeholders on the right.
 *
 * Behaviour:
 * - Clicking the search trigger opens `<SearchModal>` (IMPL-0004 Phase 9).
 * - A global `⌘K` (Mac) / `Ctrl+K` (other) shortcut also opens the
 *   modal. Bound on `document` while the Topbar is mounted; respects
 *   focus on `<input>` / `<textarea>` / contentEditable so it doesn't
 *   steal mid-typing keystrokes.
 * - Direct `/search` navigation stays as the no-JS-friendly fallback
 *   per IMPL-0004 Resolved §11 — a meta-Cmd-click on the trigger still
 *   opens the standalone route.
 * - Nav placeholders for `/api`, `/mcp`, `/frameworks` render as
 *   inert `<span aria-disabled>` so the spacing + visual rhythm is
 *   correct now, ahead of the routes themselves landing in a future
 *   IMPL.
 *
 * Per DESIGN-0001 §portal-only, `<Topbar>` is never promoted.
 */

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { Link } from "react-router";
import { Input, Kbd } from "@donaldgifford/design-system";

import { SearchModal } from "../SearchModal";
import { ThemeToggle } from "../ThemeToggle";
import styles from "./Topbar.module.css";

interface FutureRouteLink {
  readonly label: string;
  readonly hint: string;
}

const FUTURE_ROUTES: readonly FutureRouteLink[] = [
  { label: "API", hint: "Endpoint reference (coming soon)" },
  { label: "MCP", hint: "Model Context Protocol server (coming soon)" },
  { label: "Frameworks", hint: "Compliance frameworks (coming soon)" },
];

export function Topbar() {
  const [modalOpen, setModalOpen] = useState(false);

  const openModal = useCallback(() => {
    setModalOpen(true);
  }, []);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      const isShortcut = event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
      if (!isShortcut) return;
      // Don't steal focus from inputs the user is mid-typing in.
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
          return;
        }
      }
      event.preventDefault();
      openModal();
    }

    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [openModal]);

  const handleTriggerClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Allow modifier-clicks (meta-click, middle-click) to navigate to
    // the standalone /search page so power users can open it in a new
    // tab. Plain clicks open the modal overlay.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
    event.preventDefault();
    openModal();
  };

  return (
    <>
      <header className={styles.root}>
        <div className={styles.brand}>
          <Link to="/" className={styles.brandLink}>
            rfc-site
          </Link>
        </div>

        <div className={styles.search}>
          <Link
            to="/search"
            className={styles.searchTrigger}
            aria-label="Search documents (Cmd-K)"
            onClick={handleTriggerClick}
          >
            <Input
              size="sm"
              placeholder="Search documents…"
              readOnly
              tabIndex={-1}
              // The whole link is the focus surface; the inner <input>
              // is decorative here so we hide it from keyboard nav.
              suffix={<Kbd size="sm">⌘K</Kbd>}
              aria-hidden="true"
            />
          </Link>
        </div>

        <nav className={styles.nav} aria-label="Primary">
          {FUTURE_ROUTES.map((route) => (
            <span
              key={route.label}
              className={styles.navPlaceholder}
              aria-disabled="true"
              title={route.hint}
            >
              {route.label}
            </span>
          ))}
          <ThemeToggle />
        </nav>
      </header>

      <SearchModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
