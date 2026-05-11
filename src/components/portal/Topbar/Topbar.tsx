/**
 * `<Topbar>` — portal-only composite that lives in `src/root.tsx`'s
 * Layout. Sticky 3-col grid: brand on the left, read-only `<Input>`
 * search trigger in the centre, `<ThemeToggle>` + future-route nav
 * placeholders on the right.
 *
 * Behaviour:
 * - Clicking the search trigger navigates to `/search`. Phase 9 will
 *   upgrade it to open the modal overlay; until then a plain
 *   navigation is the no-JS-friendly behaviour.
 * - A global `⌘K` (Mac) / `Ctrl+K` (other) shortcut also navigates to
 *   `/search`. Bound on `document` while the Topbar is mounted.
 * - Nav placeholders for `/api`, `/mcp`, `/frameworks` render as
 *   inert `<span aria-disabled>` so the spacing + visual rhythm is
 *   correct now, ahead of the routes themselves landing in a future
 *   IMPL.
 *
 * Per DESIGN-0001 §portal-only, `<Topbar>` is never promoted.
 */

import { useEffect } from "react";
import { Link, useNavigate } from "react-router";

import { Input } from "../../ds-candidates/Input";
import { Kbd } from "../../ds-candidates/Kbd";
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
  const navigate = useNavigate();

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
      void navigate("/search");
    }

    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [navigate]);

  return (
    <header className={styles.root}>
      <div className={styles.brand}>
        <Link to="/" className={styles.brandLink}>
          rfc-site
        </Link>
      </div>

      <div className={styles.search}>
        <Link to="/search" className={styles.searchTrigger} aria-label="Search documents (Cmd-K)">
          <Input
            size="sm"
            placeholder="Search documents…"
            readOnly
            tabIndex={-1}
            // The whole link is the focus surface; the inner <input>
            // is decorative here so we hide it from keyboard nav.
            // Phase 9 will replace this with a real input that opens
            // the modal.
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
  );
}
