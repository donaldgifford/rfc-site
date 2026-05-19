import { describe, expect, it } from "vitest";

import { renderMarkdown } from "../../../src/portal/markdown/renderMarkdown";
import type { Document } from "../../../src/portal/api/__generated__/model";

function fixture(body: string, id = "RFC-0001"): Document {
  return {
    id,
    type: "rfc",
    status: "proposed",
    title: "Perf",
    body,
    authors: [],
    links: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    source: { repo: "test/test", ref: "main", path: "p.md", commit: "abc1234" },
  } as Document;
}

const codeBody = [
  "```typescript",
  "interface User { id: number; name: string; }",
  'const u: User = { id: 1, name: "Donald" };',
  "```",
  "",
  "```go",
  'package main\nfunc main() { fmt.Println("hi") }',
  "```",
  "",
  "```sql",
  "SELECT * FROM users WHERE active = TRUE;",
  "```",
].join("\n");

// OQ-1: Shiki highlighter singleton (IMPL-0006 §Phase 5).
//
// The module-scoped `pipeline` constant in renderMarkdown.ts attaches
// `@shikijs/rehype` exactly once. `@shikijs/rehype` itself uses
// `getSingletonHighlighter()` under the hood, so the WASM grammar
// engine is loaded once per Node process.
//
// We can't introspect Shiki's internal state from here, but we CAN
// observe its effect on render latency: the first call pays the WASM
// cold-start (~1-3s), and subsequent calls hit a warm highlighter
// (typically <100ms for the same fixture body).
//
// A 5x speedup between call 1 and call 3 is a generous floor — actual
// observed ratio is ~50-100x on a warm machine. If this assertion
// breaks, the highlighter is being re-instantiated.
describe("renderMarkdown — OQ-1 highlighter singleton", () => {
  it("subsequent renders are dramatically faster than the first (Shiki cached)", async () => {
    const doc = fixture(codeBody);

    const t1 = performance.now();
    await renderMarkdown(doc);
    const cold = performance.now() - t1;

    const t2 = performance.now();
    await renderMarkdown(fixture(codeBody, "RFC-0002"));
    const warm1 = performance.now() - t2;

    const t3 = performance.now();
    await renderMarkdown(fixture(codeBody, "RFC-0003"));
    const warm2 = performance.now() - t3;

    // eslint-disable-next-line no-console
    console.log(
      `[OQ-1] cold=${cold.toFixed(0)}ms warm1=${warm1.toFixed(0)}ms warm2=${warm2.toFixed(0)}ms ratio=${(cold / warm2).toFixed(1)}x`,
    );

    // The bar: warm2 must be at most 1/5 of cold. Reality is closer to
    // 1/50. If this fails, OQ-1 has regressed — Shiki is rebuilding
    // its highlighter on every call.
    expect(warm2).toBeLessThan(cold / 5);
    // warm1 might be slightly higher than warm2 because the JIT is still
    // priming, but it should still be well below cold.
    expect(warm1).toBeLessThan(cold / 3);
  });
});
