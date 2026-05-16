import { useCallback, useEffect } from "react";
import { Link, NavLink, useNavigate, useSearchParams } from "react-router";
import { SearchModal } from "../SearchModal/SearchModal";
import { Kbd } from "./Kbd";
import styles from "./Topbar.module.css";

/**
 * Top-of-page chrome. Mockup §142-257 + §2828-2847.
 *
 * Three-column grid: brand (260px) / search trigger (centered, max 480px) /
 * nav + avatar (auto). Sticky 56px, translucent glass surface with
 * `backdrop-filter: blur(12px)` over `rgba(11,14,13,0.85)`.
 *
 * The search trigger opens `<SearchModal>` via `?modal=1` URL state.
 * `⌘K` / `Ctrl+K` is bound document-wide. Meta-click on the trigger
 * navigates to `/search` as the no-JS fallback (mirrors browser
 * convention of opening links in a new tab with the meta key).
 */
export function Topbar() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const modalOpen = searchParams.get("modal") === "1";

  const openModal = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("modal", "1");
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }, [setSearchParams]);

  const closeModal = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("modal");
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }, [setSearchParams]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      openModal();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [openModal]);

  return (
    <>
      <header className={styles.topbar}>
        <Link to="/" className={styles.brand}>
          <span className={styles.brandMark}>R</span>
          <span className={styles.brandName}>rfcs</span>
          <span className={styles.brandSub}>/ portal</span>
        </Link>

        <button
          type="button"
          className={styles.search}
          onClick={(event) => {
            // Meta/Ctrl-click → no-JS fallback (mirrors open-in-new-tab convention).
            if (event.metaKey || event.ctrlKey) {
              void navigate("/search");
              return;
            }
            openModal();
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
          <NavLink
            to="/api"
            className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}
          >
            API
          </NavLink>
          <NavLink
            to="/mcp"
            className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}
          >
            MCP
          </NavLink>
          <span className={styles.linkPlaceholder} aria-disabled="true" title="Coming soon">
            About
          </span>
          <span className={styles.avatar} aria-hidden="true" />
        </nav>
      </header>

      <SearchModal open={modalOpen} onClose={closeModal} />
    </>
  );
}
