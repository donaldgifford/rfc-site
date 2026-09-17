---
id: INV-0004
title: "Eliminate the RFC-page render flash on hard refresh"
status: Concluded
author: Donald Gifford
created: 2026-05-17
---
<!-- markdownlint-disable-file MD025 MD041 -->

# INV 0004: Eliminate the RFC-page render flash on hard refresh

**Status:** Concluded
**Author:** Donald Gifford
**Date:** 2026-05-17

> [!IMPORTANT]
> **Decision (2026-05-17):** Option A + Option C. Render Markdown server-side in the rfc-site loader; cache the rendered HTML in a process-local map keyed by `${doc.id}@${doc.source.commit}`. **Option B (rfc-api ingest-time render) is out of scope** — the upcoming MCP server returns Markdown to LLMs (HTML is noisier + token-expensive), so the second-consumer argument that would justify pre-rendering upstream doesn't apply. rfc-api stays a raw-Markdown data API. Next step: a DESIGN doc covering loader-side pipeline placement, cache shape, and the `@shikijs/rehype` SSR pattern.

<!--toc:start-->
- [Question](#question)
- [Hypothesis](#hypothesis)
- [Context](#context)
  - [Observed behavior today](#observed-behavior-today)
  - [Reference point: Oxide RFD site](#reference-point-oxide-rfd-site)
- [Approach](#approach)
  - [Spike 1 — Option A (loader-side render in rfc-site)](#spike-1--option-a-loader-side-render-in-rfc-site)
  - [Spike 2 — Option B (rfc-api ingest-time render)](#spike-2--option-b-rfc-api-ingest-time-render)
  - [Spike 3 — Option C (Option A + per-commit cache)](#spike-3--option-c-option-a--per-commit-cache)
- [Environment](#environment)
- [Findings](#findings)
- [Decision factors](#decision-factors)
- [Recommendation](#recommendation)
  - [Re-trigger criteria for Option B](#re-trigger-criteria-for-option-b)
- [Open questions](#open-questions)
- [References](#references)
<!--toc:end-->

## Question

Where should we render Markdown → HTML so the RFC page arrives painted on hard refresh?

Two candidate seams:

- **Option A.** Move the unified pipeline into the rfc-site loader (server-side React Router v7). rfc-api stays a raw-Markdown data API.
- **Option B.** Render at ingest in rfc-api, store HTML in Postgres, expose a new `body_html` field (keep `body` for clients that want the source). rfc-site loader becomes a thin sanitize-and-inject.
- **Option C (variant of A).** Same as A but cache the rendered HTML at the rfc-site loader keyed by `doc.source.commit`.

The investigation must produce a recommendation supported by load-time data, a bundle-size delta, and an honest read on the multi-language pipeline cost (Shiki + remark/rehype is a TS ecosystem; rfc-api is Go).

## Hypothesis

Option A (with the C variant of per-commit caching) wins for the current scope: one portal, one language stack, an iterating Markdown pipeline. Option B is the right answer **only** when a second consumer (a CLI, a second portal, an embed widget) needs rendered HTML — at that point the duplication argument flips.

Specifically, we expect:

- Shiki running in a React Router v7 loader works (it's isomorphic; `@shikijs/rehype` already ships ESM that Node can consume).
- SSR cost per RFC page is dominated by Shiki language-grammar load on cold worker, then drops sharply once warm. Worker warmth is per-process, not per-request — so production behavior diverges from local dev.
- Bundle delta on the server is significant (~MBs from Shiki + grammars) but acceptable since rfc-site SSR runs in a long-lived Node process via `@react-router/serve`.
- Bundle delta on the client may *shrink* — the markdown pipeline + Shiki currently ship to the browser; moving the render server-side means clients only get the sanitized HTML plus a minimal hydrator.

## Context

**Triggered by:** [DESIGN-0002](../design/0002-markdown-rendering-pipeline.md), [DESIGN-0003](../design/0003-rebuild-rfc-site-against-the-mockup.md), and a 2026-05-17 user observation that the RFC body content visibly redraws after hard refresh.

### Observed behavior today

`/{type}/{id}` on hard refresh:

1. rfc-site SSR loader fetches the doc from rfc-api. Doc body (raw Markdown) is in the SSR'd page as a prop.
2. SSR renders `<DocumentView>` — but `<DocumentView>` uses `MarkdownHooks` (async react-markdown) wrapped in `<Suspense>`. The fallback renders to HTML, not the article.
3. Browser receives the page with the layout (sidebar, header, TOC scaffold) painted, **but the article area is empty / fallback**.
4. React hydrates → `<Suspense>` resolves → Shiki WASM loads → pipeline runs → React swaps in the rendered HTML.
5. Visible result: the article "writes itself in" 0.5–1.5s after the rest of the page is painted.

This happens every refresh because the markdown render is, by design today, a client-side concern. The doc *data* is in the initial response; the *prose* is not.

### Reference point: Oxide RFD site

`https://rfd.shared.oxide.computer/rfd/0004` does not exhibit this behavior. Inspection of the raw HTML (not the post-hydration DOM) confirms:

- Same framework: `window.__reactRouterContext = {... "ssr":true, "isSpaMode":false}` — React Router v7 SSR.
- Article body is fully present in the initial HTML with semantic tags + pre-highlighted code:
  ```html
  <pre class="highlight"><code class="language-yaml" data-lang="yaml">
    <span style="color:var(--syntax-function)">IdentityMetadata</span>...
  ```
- Asciidoctor signature output (`<div class="paragraph" data-lineno="494">`) — they author RFDs in Asciidoc, not Markdown, but the architectural choice is independent of source format: **render to HTML server-side, ship the finished page**.

Oxide is therefore an existence proof that the React Router v7 SSR + pre-rendered article pattern works in production at the scope we care about.

## Approach

Three spikes, in order. Stop after enough evidence has accumulated to recommend.

### Spike 1 — Option A (loader-side render in rfc-site)

1. Branch from `main`. Move `src/portal/markdown/pipeline.ts` consumption into the `$type.$id.tsx` loader: run unified with the current plugin chain (remark-gfm → strip-docz-boilerplate → remark-github-alerts → rehype-slug → rehype-autolink-headings → mermaid-marker → `@shikijs/rehype` → normalize-hast-properties → rehype-sanitize), serialize hast → HTML string with `rehype-stringify`.
2. Loader returns `{ doc, bodyHtml }`. `<DocumentView>` becomes `<article dangerouslySetInnerHTML={{ __html: bodyHtml }} />`.
3. Remove `MarkdownHooks` + `<Suspense>` from `<DocumentView>`. Keep the LinksContext (still needed for `<Anchor>` resolution in any remaining interactive bits — TBD whether that survives this).
4. Capture:
   - **Cold loader latency** for `/rfc/0001` (first request after server boot): time-to-first-byte locally with `time curl -s ...`, repeated 5 times.
   - **Warm loader latency**: same, after Shiki + grammars are loaded once.
   - **Client bundle size**: `just build` → `dist/client/assets/*.js` size delta vs main.
   - **Server bundle size**: `dist/server/index.js` size delta vs main.
   - **Hydration cost**: lighthouse TBT before vs after.

### Spike 2 — Option B (rfc-api ingest-time render)

1. In `~/code/rfc-api`, add a Markdown rendering pass to the ingest pipeline (alongside the existing parse). Pick a Go renderer with the closest plugin parity to ours:
   - Candidates: [`goldmark`](https://github.com/yuin/goldmark) (de-facto standard; supports GFM, footnotes, has a community syntax-highlighter extension via Chroma).
   - Syntax highlighting: Chroma. Theme: pick whichever is closest to Shiki's current `github-dark-default`; document the gap.
2. Add `body_html` to the OpenAPI schema as an optional field. Keep `body` (raw Markdown) for clients that want it (MCP, CLI).
3. Store rendered HTML in PG alongside the raw Markdown (new column on the docs table; migration required).
4. Regenerate the orval client. rfc-site loader becomes: fetch doc → render `<article dangerouslySetInnerHTML={{ __html: doc.body_html }} />` after running it through `rehype-sanitize` (still required — never trust the upstream).
5. Capture:
   - **Ingest time delta**: how much longer does processing a doc take with the render step?
   - **PG storage delta**: `body_html` is typically 2–3× the size of the source Markdown.
   - **Pipeline parity**: enumerate which of our custom plugins (admonitions, mermaid markers, autolink headings, language-aware code blocks) have direct Go equivalents and which don't. Document each gap.
   - **Theme parity**: side-by-side screenshot of one RFC rendered by Shiki vs Chroma.

### Spike 3 — Option C (Option A + per-commit cache)

Only run if Spike 1's warm latency is acceptable but cold is not, *or* if we want to verify the cache invalidation story end-to-end.

1. On top of Spike 1's branch: wrap the loader render in a process-local `Map<string, string>` keyed by `${doc.id}@${doc.source.commit}`.
2. Webhook flow: when rfc-api re-ingests a doc, the new commit hash invalidates the entry on next request automatically (key miss). No explicit invalidation API needed.
3. Capture: hit rate, memory footprint at N docs, p50/p99 loader latency under a small synthetic load.

## Environment

| Component | Version / Value |
|-----------|----------------|
| Node / Bun | Bun 1.3.x (`mise.toml`) |
| React Router | 7.14 framework mode, `ssr: true` |
| Markdown stack | react-markdown 10, remark-gfm 4, rehype-sanitize 6, `@shikijs/rehype` 4 |
| rfc-api | Go 1.26 (sibling repo `~/code/rfc-api`) |
| Test corpus | `~/code/rfcs` (RFC-0001 through RFC-0008, mixed status + content variety per 2026-05-17 seed) |

## Findings

<!-- Fill in as the spikes complete. Expected to include:

     - Latency tables (cold / warm) for each spike
     - Bundle size deltas (client + server)
     - Pipeline parity matrix for Option B (plugin → Go equivalent → gap notes)
     - Theme parity screenshots for Option B
     - Memory + hit rate for Option C

     Be specific. Numbers without context are noise. -->

## Decision factors

When the spike data is in, weigh each option against these factors:

| Factor | Why it matters | A (loader) | B (rfc-api) | C (loader + cache) |
|--------|---------------|---|---|---|
| **Eliminates render flash** | The original problem. | ✓ | ✓ | ✓ |
| **Iterating on the pipeline doesn't require re-ingest** | We're actively tuning admonitions / mermaid / language detection. | ✓ | ✗ (re-ingest needed) | ✓ |
| **Other consumers reuse the rendered HTML** | MCP tools, CLI, future portals. | ✗ (each re-renders) | ✓ | ✗ |
| **Pipeline lives in one language** | Maintenance + plugin authoring. | ✓ (TS only) | ✗ (Go + TS sanitizer) | ✓ (TS only) |
| **Per-request CPU on rfc-site** | SSR worker cost at scale. | High (cold) / low (warm) | Low (HTML pre-cached upstream) | Low (cache hit) |
| **Per-ingest CPU on rfc-api** | Worker cost. | None | Higher | None |
| **PG storage** | HTML is 2–3× source size; pricing implication. | None | Higher | None |
| **API contract surface** | Each new field is a forever-commitment. | None | New optional `body_html` | None |
| **Theme parity with current Shiki output** | Visual regression. | None (same Shiki) | Risk — Chroma themes differ | None |
| **Webhook-driven freshness** | New commits land in production fast. | Same as today | Same as today | Same as today (cache miss = re-render) |

## Recommendation

**Option A (loader-side render in rfc-site) + Option C (per-commit cache).**

Rationale, captured 2026-05-17 after a direction-setting conversation:

- The upcoming MCP server is the next consumer of rfc-api content. MCP returns Markdown to LLMs (Claude handles Markdown natively; HTML wastes tokens on tags), so it consumes the same `body` field rfc-site does. The "second HTML consumer" criterion that would have flipped the recommendation to Option B isn't met.
- Keeping the rendering pipeline in rfc-site means we keep iterating on plugins (admonitions, mermaid markers, autolink headings, sanitize schema) without a re-ingest of every doc in rfc-api.
- Per-commit caching addresses the "don't full-render every reload" requirement directly: cache hit on the warm path is a string lookup; cache miss only happens when the doc actually changed (new `source.commit` from webhook → re-ingest → new key on next read).
- rfc-api stays a focused data API. No new `body_html` field, no Go pipeline parity work, no theme port.

**Spikes 1 and 3 are still load-bearing for the DESIGN that follows** — they validate the latency numbers and the cache hit-rate assumption. Spike 2 (rfc-api ingest-time render) is **out of scope** and is not run.

### Re-trigger criteria for Option B

If any of the following become true, re-open this investigation:

- An HTML-consuming surface that is **not** rfc-site appears (a wrapper UI driven by MCP resources, an embed widget, a second portal).
- We pick up a second Markdown source format (Asciidoc, reStructuredText) where the pipeline drift becomes painful to maintain twice.
- rfc-site SSR latency under production load fails the targets in Spike 1 and the per-commit cache is insufficient.

## Open questions

- **What's the production traffic shape?** Loader cold-start cost matters very differently for a 5-RPS portal vs a 500-RPS one. Need this number before judging Spike 1's cold-vs-warm split.
- **Is `@shikijs/rehype` SSR-stable under load?** Known to allocate WASM instances; need to confirm the per-request allocation pattern doesn't OOM under sustained load.
- **Will the Go pipeline ever reach mermaid parity?** Mermaid is rendered client-side regardless (it's a diagram, not text); the question is whether rfc-api at least *marks* mermaid blocks consistently with our `mermaid-marker` plugin.
- **Do we want the loader-rendered HTML cached in HTTP layer (`Cache-Control`)?** Cheap, but couples the cache to a content commit hash in the URL or an ETag — opens its own design surface.

## References

- [DESIGN-0002](../design/0002-markdown-rendering-pipeline.md) — the current pipeline.
- [DESIGN-0003](../design/0003-rebuild-rfc-site-against-the-mockup.md) — the rebuild plan; identifies the pipeline as "still load-bearing" and unchanged through IMPL-0005.
- [ADR-0001](../adr/0001-consume-rfc-api-via-its-published-openapi-contract.md) — the API-contract discipline. Option B requires an upstream contract change.
- Oxide RFD site (existence proof of React Router v7 SSR + pre-rendered article): https://rfd.shared.oxide.computer/rfd/0004
- [Goldmark](https://github.com/yuin/goldmark) — Go Markdown candidate for Option B.
- [Chroma](https://github.com/alecthomas/chroma) — Go syntax highlighter candidate for Option B.
