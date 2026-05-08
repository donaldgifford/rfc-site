import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";

import stripDoczBoilerplate from "../../../../src/portal/markdown/plugins/strip-docz-boilerplate";

async function transform(input: string): Promise<string> {
  const out = await unified()
    .use(remarkParse)
    .use(stripDoczBoilerplate)
    .use(remarkStringify)
    .process(input);
  return String(out).trim();
}

describe("strip-docz-boilerplate plugin", () => {
  it("removes <!-- markdownlint-* --> comments", async () => {
    const input = ["<!-- markdownlint-disable-file MD025 MD041 -->", "", "# Hello"].join("\n");
    const out = await transform(input);
    expect(out).not.toContain("markdownlint");
    expect(out).toContain("# Hello");
  });

  it("removes the entire <!--toc:start-->...<!--toc:end--> block", async () => {
    const input = [
      "# Title",
      "",
      "<!--toc:start-->",
      "- [A](#a)",
      "- [B](#b)",
      "<!--toc:end-->",
      "",
      "## A",
      "",
      "Body.",
    ].join("\n");
    const out = await transform(input);
    expect(out).not.toContain("toc:start");
    expect(out).not.toContain("toc:end");
    expect(out).not.toContain("[A](#a)");
    expect(out).not.toContain("[B](#b)");
    expect(out).toContain("# Title");
    expect(out).toContain("## A");
    expect(out).toContain("Body.");
  });

  it("removes both markdownlint comments and TOC blocks together", async () => {
    const input = [
      "<!-- markdownlint-disable-file MD025 -->",
      "",
      "# Title",
      "",
      "<!--toc:start-->",
      "- [A](#a)",
      "<!--toc:end-->",
      "",
      "Body.",
    ].join("\n");
    const out = await transform(input);
    expect(out).not.toContain("markdownlint");
    expect(out).not.toContain("toc:");
    expect(out).not.toContain("[A](#a)");
    expect(out).toContain("# Title");
    expect(out).toContain("Body.");
  });

  it("is a no-op when neither marker is present", async () => {
    const input = ["# Title", "", "Body.", "", "## Section", "", "More."].join("\n");
    const out = await transform(input);
    expect(out).toContain("# Title");
    expect(out).toContain("Body.");
    expect(out).toContain("## Section");
    expect(out).toContain("More.");
  });

  it("strips an orphan <!--toc:start--> without cascade-deleting", async () => {
    const input = [
      "# Title",
      "",
      "<!--toc:start-->",
      "",
      "## After",
      "",
      "Body that should survive.",
    ].join("\n");
    const out = await transform(input);
    expect(out).not.toContain("toc:start");
    // Defensive: orphan start strips the marker itself but preserves
    // everything following it.
    expect(out).toContain("# Title");
    expect(out).toContain("## After");
    expect(out).toContain("Body that should survive.");
  });

  it("strips an orphan <!--toc:end--> in isolation", async () => {
    const input = ["# Title", "", "<!--toc:end-->", "", "Body."].join("\n");
    const out = await transform(input);
    expect(out).not.toContain("toc:end");
    expect(out).toContain("# Title");
    expect(out).toContain("Body.");
  });

  it("preserves unrelated HTML comments", async () => {
    const input = [
      "# Title",
      "",
      "<!-- not-a-toc but a perfectly normal comment -->",
      "",
      "Body.",
    ].join("\n");
    const out = await transform(input);
    expect(out).toContain("not-a-toc");
    expect(out).toContain("# Title");
    expect(out).toContain("Body.");
  });
});
