import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

import { remarkGithubAlerts } from "../../../../src/portal/markdown/plugins/github-alerts";

async function transform(input: string): Promise<string> {
  const out = await unified()
    .use(remarkParse)
    .use(remarkGithubAlerts)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(input);
  return String(out);
}

describe("remark-github-alerts plugin", () => {
  it('rewrites a [!NOTE] blockquote to <div class="admonition note"> with an adm-label', async () => {
    const out = await transform("> [!NOTE]\n> Useful information that users should know.");
    expect(out).toContain('class="admonition note"');
    expect(out).toContain('class="adm-label"');
    expect(out).toContain("Note");
    expect(out).toContain("Useful information that users should know.");
    expect(out).not.toContain("[!NOTE]");
  });

  it.each([
    ["WARNING", "warning"],
    ["TIP", "tip"],
    ["CAUTION", "caution"],
  ])("rewrites [!%s] to the %s variant", async (marker, variant) => {
    const out = await transform(`> [!${marker}]\n> Body text.`);
    expect(out).toContain(`class="admonition ${variant}"`);
  });

  it("normalises [!IMPORTANT] to the note variant (mockup has no Important visual)", async () => {
    const out = await transform("> [!IMPORTANT]\n> heads up");
    expect(out).toContain('class="admonition note"');
  });

  it("is case-insensitive on the marker", async () => {
    const out = await transform("> [!note]\n> lowercase marker");
    expect(out).toContain('class="admonition note"');
  });

  it("leaves a regular blockquote untouched", async () => {
    const out = await transform("> Just an ordinary quote.\n> Continuation.");
    expect(out).toContain("<blockquote>");
    expect(out).not.toContain("admonition");
  });

  it("leaves a blockquote with no marker untouched even if it has bracket-like text", async () => {
    const out = await transform("> See [NOTE]: ordinary square brackets do not trigger.");
    expect(out).toContain("<blockquote>");
    expect(out).not.toContain("admonition");
  });

  it("preserves additional content nodes (lists, headings) inside the alert", async () => {
    const out = await transform("> [!TIP]\n> First paragraph.\n>\n> - item one\n> - item two");
    expect(out).toContain('class="admonition tip"');
    expect(out).toContain("<ul>");
    expect(out).toContain("item one");
  });
});
