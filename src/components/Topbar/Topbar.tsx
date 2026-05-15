import { useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import { Kbd } from "./Kbd";
import styles from "./Topbar.module.css";

/**
 * Top-of-page chrome. Mockup §142-257 + §2828-2847.
 *
 * Three-column grid: brand (260px) / search trigger (centered, max 480px) /
 * nav + avatar (auto). Sticky 56px, translucent glass surface with
 * `backdrop-filter: blur(12px)` over `rgba(11,14,13,0.85)`.
 *
 * The search trigger opens the SearchModal — Phase 1 stubs the open intent
 * by binding `⌘K` / `Ctrl+K` to a no-op and the click handler to navigate
 * to `/search` as a fallback. Phase 3 replaces both with the actual modal.
 */
export function Topbar() {
  const navigate = useNavigate();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      // Phase 3 will open <SearchModal>; for now navigate to /search.
      void navigate("/search");
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [navigate]);

  return (
    <header className={styles.topbar}>
      <Link to="/" className={styles.brand}>
        <span className={styles.brandMark}>R</span>
        <span className={styles.brandName}>rfcs</span>
        <span className={styles.brandSub}>/ portal</span>
      </Link>

      <button
        type="button"
        className={styles.search}
        onClick={() => {
          void navigate("/search");
        }}
        aria-label="Search documents"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span>Search RFCs, authors, labels&hellip;</span>
        <span className={styles.kbdGroup}>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <nav className={styles.nav} aria-label="Primary">
        <NavLink
          to="/"
          end
          className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}
        >
          Directory
        </NavLink>
        <span className={styles.linkPlaceholder} aria-disabled="true" title="Coming soon">
          Frameworks
        </span>
        <span className={styles.linkPlaceholder} aria-disabled="true" title="Coming soon">
          API
        </span>
        <span className={styles.linkPlaceholder} aria-disabled="true" title="Coming soon">
          MCP
        </span>
        <span className={styles.linkPlaceholder} aria-disabled="true" title="Coming soon">
          About
        </span>
        <span className={styles.avatar} aria-hidden="true" />
      </nav>
    </header>
  );
}
