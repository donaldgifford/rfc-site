import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTheme } from "@donaldgifford/design-system/theme";

interface MermaidBlockProps {
  source: string;
  children?: ReactNode;
}

/**
 * Client-side mermaid diagram hydration.
 *
 * SSR / no-JS: renders `children` (the original `<code>` source text from
 * the Phase 3 `mermaid-marker` plugin) inside a `<pre>`, so search engines
 * and pre-hydration clients see the diagram source.
 *
 * On client mount: dynamically `await import("mermaid")` (Resolved §7 —
 * keeps the ~700 KB library out of the main bundle for non-mermaid pages),
 * initialises with the active theme, and replaces the placeholder with the
 * rendered SVG. Re-renders when the theme flips.
 */
export function MermaidBlock({ source, children }: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Sentinel held inside an object so the eslint
    // `no-unnecessary-condition` rule doesn't narrow it to `false`
    // across the async closure boundary.
    const state = { cancelled: false };
    const node = containerRef.current;
    if (!node) return;

    void (async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({
          startOnLoad: false,
          theme: theme === "dark" ? "dark" : "default",
          securityLevel: "strict",
        });
        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, source);
        if (state.cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = svg;
        setHydrated(true);
        setError(null);
      } catch (err) {
        if (state.cancelled) return;
        setError(err instanceof Error ? err.message : "mermaid render failed");
      }
    })();

    return () => {
      state.cancelled = true;
    };
  }, [source, theme]);

  return (
    <div className="mermaid-block" data-mermaid-block="">
      <div ref={containerRef} className="mermaid-block__diagram" aria-hidden={!hydrated} />
      {error !== null ? (
        <p className="mermaid-block__error" role="alert">
          {error}
        </p>
      ) : null}
      {!hydrated ? (
        <pre className="mermaid-block__source" data-mermaid-source-fallback="">
          {children}
        </pre>
      ) : null}
    </div>
  );
}
