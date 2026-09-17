import { useEffect, useRef } from "react";
import { Kbd } from "../Topbar/Kbd";
import styles from "./LiveFilter.module.css";

interface LiveFilterProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}

/**
 * Hero-level filter input. Mockup §313-352.
 *
 * Wide pill input centred under the hero title. `/` keystroke focuses the
 * input from anywhere on the page (when no other input has focus). The
 * filter is *client-side* — it narrows the already-rendered RFC table on
 * title / id / authors text match. Server-side filtering (type / labels)
 * happens via the URL params and the route loader.
 */
export function LiveFilter({
  value,
  onChange,
  placeholder = "Filter by title, number, or author",
}: LiveFilterProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "/") return;
      const target = event.target as HTMLElement | null;
      const activeTag = target?.tagName ?? "";
      // Skip when typing into another input/textarea/contenteditable.
      if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;
      if (target?.isContentEditable) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className={styles.wrapper}>
      <svg
        className={styles.icon}
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
      <input
        ref={inputRef}
        type="search"
        className={styles.input}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        aria-label="Filter directory"
      />
      <Kbd>/</Kbd>
    </div>
  );
}
