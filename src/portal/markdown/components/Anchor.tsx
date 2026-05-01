// Phase 1 stub. Phase 4 implements the `<a>` override:
//   1. Consume `links` via context (provided by `<DocumentView>`).
//   2. Match `href` against `links[].target` first, then `links[].href`.
//   3. Translate API-shaped href via `apiHrefToPortalRoute` from
//      `src/portal/api/docId.ts`.
//   4. Render RR7 `<Link>` for resolved internal, `<a target="_blank">` for
//      external, `<span data-broken-link>` for unmatched internal.
// See docs/design/0002-markdown-rendering-pipeline.md §Cross-document link resolution.
export {};
