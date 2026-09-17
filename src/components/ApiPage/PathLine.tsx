import { Fragment, useState } from "react";
import type { HttpMethod } from "../../portal/openapi/loader";
import { MethodChip } from "./MethodChip";
import styles from "./ApiPage.module.css";

interface PathLineProps {
  method: HttpMethod;
  path: string;
}

/**
 * `<MethodChip> /api/v1/{type}/{id} [copy]` row. Mockup §1674-1706.
 *
 * `{paramName}` segments render in `--code-number` for visual emphasis.
 * Copy button uses `navigator.clipboard` when available; falls back to
 * a no-op + a brief "Copied" label flip for the success state.
 */
export function PathLine({ method, path }: PathLineProps) {
  const [copied, setCopied] = useState(false);
  const segments = splitPathSegments(path);

  return (
    <div className={styles.pathLine}>
      <MethodChip method={method} />
      <span className={styles.fullPath}>
        {segments.map((segment, idx) => (
          <Fragment key={`${segment.text}-${String(idx)}`}>
            {segment.isVar ? (
              <span className={styles.segmentVar}>{segment.text}</span>
            ) : (
              segment.text
            )}
          </Fragment>
        ))}
      </span>
      <button
        type="button"
        className={[styles.copyButton, copied && styles.copyButtonCopied].filter(Boolean).join(" ")}
        onClick={() => {
          if (typeof navigator === "undefined") return;
          void navigator.clipboard.writeText(path).then(() => {
            setCopied(true);
            window.setTimeout(() => {
              setCopied(false);
            }, 1500);
          });
        }}
        aria-label={copied ? "Path copied" : "Copy path"}
      >
        {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}

interface PathSegment {
  text: string;
  isVar: boolean;
}

function splitPathSegments(path: string): PathSegment[] {
  const segments: PathSegment[] = [];
  const re = /\{[^}]+\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(path)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: path.slice(lastIndex, match.index), isVar: false });
    }
    segments.push({ text: match[0], isVar: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < path.length) {
    segments.push({ text: path.slice(lastIndex), isVar: false });
  }
  return segments;
}
