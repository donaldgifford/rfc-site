import type { Plugin } from "unified";
import type { Root, Html } from "mdast";

// Strips docz-managed boilerplate that should not appear in the rendered
// portal output:
//
//   1. `<!-- markdownlint-disable* -->` comments — used by the docz pipeline
//      to suppress linter warnings; pure tooling noise.
//
//   2. Auto-generated TOC blocks delimited by `<!--toc:start-->` and
//      `<!--toc:end-->` html-comment markers (and everything between them,
//      inclusive). The portal owns its own TOC presentation in a future
//      sidebar — re-rendering the source TOC inline would duplicate it.
//
// Malformed pairs are handled defensively: a `toc:start` without a matching
// `toc:end` strips just the start marker; a `toc:end` without a preceding
// `toc:start` strips just the end marker. We never cascade-delete unrelated
// content.
//
// Nested unrelated html comments (e.g. `<!-- not-a-toc -->`) pass through
// untouched.

const MARKDOWNLINT_RE = /^<!--\s*markdownlint-/;
const TOC_START_RE = /^<!--\s*toc:start\s*-->/i;
const TOC_END_RE = /^<!--\s*toc:end\s*-->/i;

function isHtmlNode(node: Root["children"][number]): node is Html {
  return node.type === "html";
}

const stripDoczBoilerplate: Plugin<[], Root> = () => {
  return (tree) => {
    const out: Root["children"] = [];
    // Buffer holds nodes between an opening `toc:start` and the next
    // `toc:end`. If a matching end is found, the buffer is dropped; if EOF
    // hits first, the buffer flushes back to `out` (the start marker itself
    // is still removed — that's tooling noise — but inner content survives).
    let buffer: Root["children"] | null = null;

    for (const node of tree.children) {
      if (isHtmlNode(node)) {
        if (MARKDOWNLINT_RE.test(node.value)) {
          continue;
        }
        if (TOC_START_RE.test(node.value)) {
          if (buffer !== null) {
            // Nested start without intervening end — flush previous buffer
            // back to output (preserve the orphan content) and reset.
            out.push(...buffer);
          }
          buffer = [];
          continue;
        }
        if (TOC_END_RE.test(node.value)) {
          if (buffer !== null) {
            // Matched pair — drop the buffer entirely.
            buffer = null;
          }
          // Either way, drop the end marker itself.
          continue;
        }
      }

      if (buffer !== null) {
        buffer.push(node);
      } else {
        out.push(node);
      }
    }

    // EOF with an open buffer: flush survivors (orphan-start handling).
    if (buffer !== null) {
      out.push(...buffer);
    }

    tree.children = out;
  };
};

export default stripDoczBoilerplate;
