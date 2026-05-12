/**
 * `<CodeBlock>` — standalone syntax-highlighted code surface for
 * non-Markdown contexts (API examples, MCP setup snippets).
 *
 * **Why a separate primitive?** `src/portal/markdown/components/Code.tsx`
 * is page-bound to `<DocumentView>` and consumes hast from the unified
 * pipeline. This primitive accepts a plain `code` string + `language`
 * and runs its own Shiki transform on the client. SSR renders an
 * unstyled `<pre><code>` fallback so search engines + no-JS clients
 * still see the source.
 *
 * Theme: dual `github-light` / `github-dark` matching
 * `src/portal/markdown/pipeline.ts` so highlighted output looks
 * consistent with rendered Markdown code blocks. The `data-theme`
 * switch on `<html>` flips them with no JS.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from "react";
import clsx from "clsx";

import { Button } from "@donaldgifford/design-system";
import styles from "./CodeBlock.module.css";

export interface CodeBlockProps extends Omit<ComponentPropsWithoutRef<"pre">, "children"> {
  /** Source code to render. */
  code: string;
  /** Highlighting language. Defaults to `"text"` (no highlighting). */
  language?: string;
  /** Optional badge above the code (e.g. `"curl"` or `"package.json"`). */
  label?: string;
  /** Show the copy-to-clipboard affordance. Defaults to `true`. */
  showCopy?: boolean;
}

interface ShikiModule {
  codeToHtml: (
    code: string,
    options: {
      lang: string;
      themes: { light: string; dark: string };
      defaultColor?: false;
    },
  ) => Promise<string>;
}

// Shared async-loaded singleton so multiple `<CodeBlock>` instances
// don't each pay the cost of initialising Shiki. The first call
// kicks off the import + highlighter creation; subsequent calls
// reuse the same promise.
let highlighterPromise: Promise<ShikiModule> | null = null;
function loadShiki(): Promise<ShikiModule> {
  highlighterPromise ??= import("shiki") as Promise<ShikiModule>;
  return highlighterPromise;
}

export const CodeBlock = forwardRef<HTMLPreElement, CodeBlockProps>(function CodeBlock(
  { code, language = "text", label, showCopy = true, className, ...rest },
  ref,
) {
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadShiki()
      .then(async (shiki) => {
        const html = await shiki.codeToHtml(code, {
          lang: language,
          themes: { light: "github-light", dark: "github-dark" },
          defaultColor: false,
        });
        if (!cancelled) setHighlightedHtml(html);
      })
      .catch(() => {
        // Highlighting is best-effort — leave the SSR fallback in
        // place if Shiki fails to load or hits an unknown language.
      });

    return () => {
      cancelled = true;
    };
  }, [code, language]);

  useEffect(() => {
    return () => {
      if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
    };
  }, []);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(code).then(
      () => {
        setCopied(true);
        if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
        copiedTimer.current = setTimeout(() => {
          setCopied(false);
        }, 1500);
      },
      () => {
        // Clipboard rejected (permissions / non-secure context) —
        // swallow silently. Future work: surface a toast.
      },
    );
  }, [code]);

  return (
    <div className={clsx(styles.root, className)} data-language={language}>
      {label === undefined && !showCopy ? null : (
        <div className={styles.chrome}>
          {label === undefined ? <span /> : <span className={styles.label}>{label}</span>}
          {showCopy ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              aria-label={copied ? "Copied!" : "Copy code"}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          ) : null}
        </div>
      )}

      {highlightedHtml === null ? (
        <pre ref={ref} className={styles.fallback} {...rest}>
          <code data-language={language}>{code}</code>
        </pre>
      ) : (
        <div
          className={styles.highlighted}
          // Shiki produces its own <pre><code> shell — we drop it
          // into the wrapper. Output is trusted (Shiki is a known
          // safe transform); no sanitization needed since `code` is
          // a string the consumer controls.
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      )}
    </div>
  );
});
