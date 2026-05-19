import { describe, expect, it } from "vitest";

import { renderMarkdown } from "../../../src/portal/markdown/renderMarkdown";
import { loadFixtures } from "../../../src/portal/api/msw/fixtures";
import type { Document, Link } from "../../../src/portal/api/__generated__/model";

function fixture(body: string, overrides: Partial<Document> = {}): Document {
  return {
    id: "RFC-0001",
    type: "rfc",
    status: "proposed",
    title: "Fixture",
    body,
    authors: [],
    links: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    source: { repo: "test/test", ref: "main", path: "0001.md", commit: "abc1234" },
    ...overrides,
  } as Document;
}

describe("renderMarkdown — happy path", () => {
  it("returns an empty string when doc.body is missing", async () => {
    const html = await renderMarkdown(fixture("", { body: undefined }));
    expect(html).toBe("");
  });

  it("returns an empty string when doc.body is empty", async () => {
    const html = await renderMarkdown(fixture(""));
    expect(html).toBe("");
  });

  it("renders a paragraph", async () => {
    const html = await renderMarkdown(fixture("Hello, world."));
    expect(html).toContain("<p>Hello, world.</p>");
  });

  it("renders GFM tables", async () => {
    const body = ["| Col A | Col B |", "| --- | --- |", "| 1 | 2 |"].join("\n");
    const html = await renderMarkdown(fixture(body));
    expect(html).toContain("<table>");
    expect(html).toContain("<th>Col A</th>");
    expect(html).toContain("<td>1</td>");
  });

  it("renders GFM task lists with disabled checkboxes", async () => {
    const html = await renderMarkdown(fixture(["- [x] done", "- [ ] todo"].join("\n")));
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("disabled");
    expect(html).toMatch(/checked/);
  });

  it("renders strikethrough", async () => {
    const html = await renderMarkdown(fixture("~~struck~~"));
    expect(html).toContain("<del>struck</del>");
  });

  it("renders GFM autolinks as anchor tags", async () => {
    const html = await renderMarkdown(fixture("Visit https://example.com for info."));
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("https://example.com");
  });
});

describe("renderMarkdown — heading anchors", () => {
  it("emits a kebab-case id on headings", async () => {
    const html = await renderMarkdown(fixture("## Cross-Document Link Resolution"));
    expect(html).toContain('id="cross-document-link-resolution"');
  });

  it("prepends a heading-anchor link with a Permalink aria-label", async () => {
    const html = await renderMarkdown(fixture("## Section Two"));
    expect(html).toContain('class="heading-anchor"');
    expect(html).toContain('aria-label="Permalink to Section Two"');
    expect(html).toContain('href="#section-two"');
  });

  it("preserves the heading-anchor class through sanitize", async () => {
    // Sanitize allowlist defaults strip <a class>; we extended it for
    // `heading-anchor` and `data-footnote-backref` in pipeline.ts. This
    // is a regression guard.
    const html = await renderMarkdown(fixture("# Hello"));
    expect(html).toContain('<a class="heading-anchor"');
  });
});

describe("renderMarkdown — GitHub-flavoured admonitions", () => {
  it.each([
    ["NOTE", "note"],
    ["WARNING", "warning"],
    ["TIP", "tip"],
    ["CAUTION", "caution"],
  ])('rewrites [!%s] to <div class="admonition %s">', async (marker, variant) => {
    const body = `> [!${marker}]\n> Body text.`;
    const html = await renderMarkdown(fixture(body));
    expect(html).toContain(`class="admonition ${variant}"`);
    expect(html).toContain('class="adm-label"');
  });

  it("normalises [!IMPORTANT] to the note variant", async () => {
    const html = await renderMarkdown(fixture("> [!IMPORTANT]\n> heads up"));
    expect(html).toContain('class="admonition note"');
  });
});

describe("renderMarkdown — code blocks", () => {
  it("emits a Shiki <pre.shiki> wrapper around fenced code", async () => {
    const body = ["```ts", "const x: number = 42;", "```"].join("\n");
    const html = await renderMarkdown(fixture(body));
    expect(html).toMatch(/<pre[^>]*class="[^"]*shiki/);
    expect(html).toContain("<code");
    // Tokenised <span>s are present (Shiki splits identifiers/keywords).
    expect(html).toContain("<span");
  });

  it("syntax-highlights Go, SQL, YAML code blocks via Shiki <span> tokens", async () => {
    for (const [lang, body] of [
      ["go", "package main"],
      ["sql", "SELECT 1 FROM t;"],
      ["yaml", "key: value"],
    ] as const) {
      const html = await renderMarkdown(fixture(["```" + lang, body, "```"].join("\n")));
      expect(html).toMatch(/<pre[^>]*class="[^"]*shiki/);
      expect(html).toContain("<code");
      // Multiple highlighted token spans, not just one flat span.
      const spanCount = (html.match(/<span/g) ?? []).length;
      expect(spanCount).toBeGreaterThan(1);
    }
  });

  it("annotates highlighted <pre> with data-language for the badge CSS selector", async () => {
    for (const lang of ["go", "sql", "yaml", "typescript", "rust"] as const) {
      const html = await renderMarkdown(fixture(["```" + lang, "x = 1", "```"].join("\n")));
      expect(html).toMatch(new RegExp(`<pre[^>]*data-language="${lang}"`));
    }
  });

  it("does NOT set data-language for plain/text/no-lang blocks", async () => {
    const html = await renderMarkdown(fixture(["```", "some text", "```"].join("\n")));
    expect(html).not.toMatch(/data-language=/);
  });

  it("emits CSS variables instead of inline hex colors on Shiki <span>s (Phase 2)", async () => {
    const html = await renderMarkdown(fixture(["```ts", 'const x = "hi";', "```"].join("\n")));
    // The tokens-to-css-variables transformer rewrites every color:#XXX to
    // a var(--code-*) reference. Zero hexes is the IMPL-0006 §Phase 2
    // success criterion.
    expect(html).not.toMatch(/color:\s*#[0-9a-fA-F]/);
    // At least one token should carry a --code-* reference.
    expect(html).toMatch(/color:var\(--code-/);
  });

  it("strips the inline background-color from <pre> (CSS owns code-bg)", async () => {
    const html = await renderMarkdown(fixture(["```ts", "const x = 1;", "```"].join("\n")));
    // The transformer drops `background-color:#…` from the <pre>; the
    // `.markdown-body pre { background: var(--code-bg) }` rule wins.
    expect(html).not.toMatch(/<pre[^>]*background-color/);
  });

  it("preserves inline code without wrapping it in <pre>", async () => {
    const html = await renderMarkdown(fixture("Some `inline` text."));
    expect(html).toContain("<code>inline</code>");
    expect(html).not.toMatch(/<pre[^>]*>[^<]*<code>inline/);
  });

  it("does NOT Shiki-highlight language-mermaid blocks (mermaid-marker takes them)", async () => {
    const body = ["```mermaid", "graph TD; A-->B;", "```"].join("\n");
    const html = await renderMarkdown(fixture(body));
    // mermaid-marker sets data-mermaid-source (empty string sentinel) and
    // leaves the body in <code>; it does NOT add the .shiki class.
    expect(html).toContain("data-mermaid-source");
    expect(html).not.toMatch(/<pre[^>]*class="[^"]*shiki[^"]*"[^>]*data-language="mermaid"/);
    expect(html).toContain("graph TD");
  });
});

describe("renderMarkdown — anchor resolution (resolve-anchor-links integration)", () => {
  it("leaves hash-only anchors alone", async () => {
    const html = await renderMarkdown(fixture("[jump](#section)"));
    expect(html).toContain('href="#section"');
    expect(html).not.toContain("data-cross-doc");
  });

  it("rewrites cross-doc href via links[].target to the portal route", async () => {
    const links: Link[] = [
      {
        direction: "outgoing",
        target: "./0001-postgres.md",
        href: "/api/v1/rfc/0001",
      },
    ];
    const html = await renderMarkdown(fixture("[see RFC-0001](./0001-postgres.md)", { links }));
    expect(html).toContain('href="/rfc/0001"');
    expect(html).toContain('data-cross-doc="1"');
  });

  it("adds target=_blank + rel=noopener on external http(s) links", async () => {
    const html = await renderMarkdown(fixture("[ex](https://example.com)"));
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("replaces unresolved internal-looking hrefs with <span data-broken-link>", async () => {
    const html = await renderMarkdown(fixture("[broken](./missing.md)"));
    expect(html).toContain("<span");
    expect(html).toContain("data-broken-link");
    expect(html).toContain("Unresolved link: ./missing.md");
  });
});

describe("renderMarkdown — fixture corpus", () => {
  it("produces non-empty HTML for every doc in tests/examples/docs/", async () => {
    const docs = await loadFixtures();
    expect(docs.length).toBeGreaterThan(0);
    for (const doc of docs) {
      const html = await renderMarkdown(doc);
      expect(html.length).toBeGreaterThan(0);
    }
  });
});

describe("renderMarkdown — sanitization", () => {
  it("strips <script> injection inside the body", async () => {
    const body = ['<script>alert("xss")</script>', "", "Hello."].join("\n");
    const html = await renderMarkdown(fixture(body));
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(");
    expect(html).toContain("Hello.");
  });

  it("strips raw <a target=_blank> from user-authored HTML (allowDangerousHtml: false)", async () => {
    // The user can write raw HTML in Markdown source. Our defence model
    // says `remark-rehype` must drop this at the mdast → hast boundary
    // because `target` is now in the sanitize allowlist for plugin output.
    const body = '<a href="https://evil" target="_blank">x</a>';
    const html = await renderMarkdown(fixture(body));
    expect(html).not.toContain("target=");
    expect(html).not.toContain('href="https://evil"');
  });

  it("strips on* event handlers", async () => {
    const body = '<p onclick="alert(1)">x</p>';
    const html = await renderMarkdown(fixture(body));
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("alert");
  });
});
