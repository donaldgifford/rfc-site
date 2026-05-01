import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

import mermaidMarker from "../../../../src/portal/markdown/plugins/mermaid-marker";

async function transform(input: string): Promise<string> {
  const out = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(mermaidMarker)
    .use(rehypeStringify)
    .process(input);
  return String(out);
}

describe("mermaid-marker plugin", () => {
  it("tags a mermaid fence with data-mermaid-source and drops language-mermaid", async () => {
    const input = ["```mermaid", "graph TD; A-->B", "```"].join("\n");
    const out = await transform(input);
    expect(out).toContain("data-mermaid-source");
    expect(out).not.toContain("language-mermaid");
    // Source is preserved as the <pre>'s child text — SSR fallback.
    expect(out).toContain("graph TD; A-->B");
  });

  it("leaves non-mermaid fences untouched", async () => {
    const input = ["```ts", "const x = 1;", "```"].join("\n");
    const out = await transform(input);
    expect(out).toContain("language-ts");
    expect(out).not.toContain("data-mermaid-source");
  });

  it("leaves no-language fences untouched", async () => {
    const input = ["```", "plain text block", "```"].join("\n");
    const out = await transform(input);
    expect(out).not.toContain("data-mermaid-source");
    expect(out).toContain("plain text block");
  });

  it("processes multiple mermaid blocks independently in one document", async () => {
    const input = [
      "```mermaid",
      "graph A;",
      "```",
      "",
      "Some text.",
      "",
      "```mermaid",
      "sequenceDiagram",
      "  Alice->>Bob: hi",
      "```",
    ].join("\n");
    const out = await transform(input);
    // Both blocks tagged.
    const matches = out.match(/data-mermaid-source/g) ?? [];
    expect(matches.length).toBe(2);
    expect(out).toContain("graph A;");
    expect(out).toContain("sequenceDiagram");
    expect(out).not.toContain("language-mermaid");
  });
});
