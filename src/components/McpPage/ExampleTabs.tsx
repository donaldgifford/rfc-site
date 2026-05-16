import { useState } from "react";
import type { ConfigSnippet } from "./content";
import styles from "./ExampleTabs.module.css";

interface ExampleTabsProps {
  snippets: readonly ConfigSnippet[];
}

/**
 * Client-config tab switcher. Mockup §1825-1865 + §4015-4032.
 *
 * Renders one tab per snippet; the active tab swaps the visible `<pre>`
 * body. Comment line gets the muted italic Tokyo Night colour; the rest
 * is the default `--code-fg`. No syntax highlighting beyond the comment
 * — JSON is short enough that highlighting earns less than it costs to
 * route through Shiki for a stub snippet.
 */
export function ExampleTabs({ snippets }: ExampleTabsProps) {
  const [activeClient, setActiveClient] = useState(snippets[0]?.client ?? "");

  const active = snippets.find((s) => s.client === activeClient) ?? snippets[0];
  if (!active) return null;

  return (
    <div>
      <div className={styles.tabs} role="tablist" aria-label="Client config">
        {snippets.map((snippet) => {
          const isActive = snippet.client === active.client;
          return (
            <button
              key={snippet.client}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={[styles.tab, isActive && styles.tabActive].filter(Boolean).join(" ")}
              onClick={() => {
                setActiveClient(snippet.client);
              }}
            >
              {snippet.client}
            </button>
          );
        })}
      </div>
      <pre className={styles.code} aria-label={`${active.client} MCP config`}>
        <span className={styles.codeComment}>{active.comment}</span>
        {"\n"}
        {active.body}
      </pre>
    </div>
  );
}
