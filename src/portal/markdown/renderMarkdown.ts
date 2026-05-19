import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

import type { Document } from "../api/__generated__/model";
import { remarkPlugins, rehypePluginsCore, rehypeSanitizePlugin } from "./pipeline";
import { resolveAnchorLinks } from "./plugins/resolve-anchor-links";

// `remark-rehype`'s `allowDangerousHtml: false` (the default) is load-bearing:
// it ensures user-authored raw HTML in Markdown source is dropped at the
// mdast → hast boundary, so `<a target=_blank>` injected by the user can't
// reach the sanitizer with our newly-permissive schema. See sanitize.test.ts
// — the post-IMPL-0006 defence model moves tabnabbing prevention upstream.
const REMARK_REHYPE_OPTIONS = { allowDangerousHtml: false } as const;

// Module-scoped processor. unified processors are freezable + reusable;
// `process()` on a frozen processor is safe to call concurrently because
// each call gets its own VFile. Caching the processor means we only pay
// the plugin-attach cost once per Node process and (critically) Shiki's
// highlighter singleton is shared across calls — verified in Phase 5 OQ-1.
let pipeline = buildPipeline();

function buildPipeline() {
  return unified()
    .use(remarkParse)
    .use(remarkPlugins)
    .use(remarkRehype, REMARK_REHYPE_OPTIONS)
    .use(rehypePluginsCore)
    .use(resolveAnchorLinks)
    .use(rehypeSanitizePlugin)
    .use(rehypeStringify);
}

/**
 * Server-side Markdown → sanitized HTML render.
 *
 * Pure + isomorphic: the same pipeline runs in the SSR loader and in tests.
 * The output is a fully-baked HTML string with Shiki syntax highlighting,
 * heading anchors, admonition divs, mermaid placeholders, and cross-doc
 * link metadata (`data-cross-doc="1"` for the Phase 4 click-delegation
 * interceptor).
 *
 * The document's `links[]` array is threaded into `resolveAnchorLinks` via
 * `file.data.documentLinks` so cross-doc href rewriting works without
 * teaching the pipeline about `Document` shape.
 *
 * @param doc - rfc-api `Document`. Only `body` + `links` are read; the
 *   pipeline is doc-type-agnostic (RFC today, Framework tomorrow).
 * @returns Sanitized HTML ready for `dangerouslySetInnerHTML`. Empty
 *   string in if `doc.body` is missing or empty.
 */
export async function renderMarkdown(doc: Document): Promise<string> {
  const body = doc.body ?? "";
  if (body.length === 0) return "";
  const file = await pipeline.process({
    value: body,
    data: { documentLinks: doc.links ?? [] },
  });
  return String(file);
}

// Test-only — rebuild the cached processor between tests that need a clean
// Shiki highlighter or plugin state. Production callers must NOT use this.
export function _resetPipelineForTests(): void {
  pipeline = buildPipeline();
}
