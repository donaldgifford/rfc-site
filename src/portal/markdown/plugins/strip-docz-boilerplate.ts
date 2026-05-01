// Phase 1 stub. Phase 3 implements the remark plugin:
//   - Walks the mdast and removes:
//       1. `html` nodes matching /^<!--\s*markdownlint-/
//       2. The subtree (inclusive) between `<!-- toc:start -->` and
//          `<!-- toc:end -->` html nodes.
//   - Inserts between `remark-gfm` and `remark-rehype` in the pipeline.
// See docs/design/0002-markdown-rendering-pipeline.md §Stripping docz boilerplate.
export {};
