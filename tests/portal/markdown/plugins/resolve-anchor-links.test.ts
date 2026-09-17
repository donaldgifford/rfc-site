import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

import type { Link as DocLink } from "../../../../src/portal/api/__generated__/model";
import { resolveAnchorLinks } from "../../../../src/portal/markdown/plugins/resolve-anchor-links";

async function transform(input: string, links: readonly DocLink[] = []): Promise<string> {
  const out = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(resolveAnchorLinks)
    .use(rehypeStringify)
    .process({ value: input, data: { documentLinks: links } });
  return String(out);
}

const crossDocLink: DocLink = {
  direction: "outgoing",
  target: "./0001-postgres.md",
  href: "/api/v1/rfc/0001",
};

describe("resolve-anchor-links plugin", () => {
  it("leaves hash-only anchors unchanged", async () => {
    const out = await transform("[jump](#section)");
    expect(out).toContain('href="#section"');
    expect(out).not.toContain("data-cross-doc");
    expect(out).not.toContain("data-broken-link");
  });

  it("rewrites a cross-doc href via links[].target → portal route + data-cross-doc", async () => {
    const out = await transform("[see RFC-0001](./0001-postgres.md)", [crossDocLink]);
    expect(out).toContain('href="/rfc/0001"');
    expect(out).toContain('data-cross-doc="1"');
    expect(out).not.toContain("0001-postgres.md");
  });

  it("rewrites a cross-doc href via links[].href (API URL fallback) → portal route + data-cross-doc", async () => {
    const apiHrefLink: DocLink = {
      direction: "outgoing",
      target: "RFC-0001",
      href: "/api/v1/rfc/0001",
    };
    const out = await transform("[link](/api/v1/rfc/0001)", [apiHrefLink]);
    expect(out).toContain('href="/rfc/0001"');
    expect(out).toContain('data-cross-doc="1"');
  });

  it("adds target=_blank + rel=noopener noreferrer to external http(s) links", async () => {
    const out = await transform("[external](https://example.com/page)");
    expect(out).toContain('href="https://example.com/page"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).not.toContain("data-cross-doc");
  });

  it("replaces unmatched internal-looking links with <span data-broken-link>", async () => {
    const out = await transform("[broken](./does-not-exist.md)");
    expect(out).toContain("<span");
    expect(out).toContain('data-broken-link=""');
    expect(out).toContain('title="Unresolved link: ./does-not-exist.md"');
    expect(out).not.toContain("<a href=");
    expect(out).toContain("broken");
  });

  it("preserves the broken-link span's children (link text)", async () => {
    const out = await transform("[link **text**](./missing.md)");
    expect(out).toContain("<span");
    expect(out).toContain("<strong>text</strong>");
  });

  it("matches links[].target before links[].href when both could match", async () => {
    // Two links — the first matches the markdown href via `target`,
    // pointing at one resource; the second would match via `href`,
    // pointing at a different resource. Target-priority means we
    // resolve to the first link's API href → /rfc/0042.
    const targetMatch: DocLink = {
      direction: "outgoing",
      target: "./0001-postgres.md",
      href: "/api/v1/rfc/0042",
    };
    const hrefMatch: DocLink = {
      direction: "outgoing",
      target: "other-target",
      href: "./0001-postgres.md",
    };
    const out = await transform("[link](./0001-postgres.md)", [targetMatch, hrefMatch]);
    expect(out).toContain('href="/rfc/0042"');
  });

  it("ignores anchors with no href", async () => {
    // remark won't normally emit hrefless anchors from markdown, but the plugin
    // must defensively skip them when other rehype passes inject something.
    const out = await unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(() => (tree) => {
        // Inject an <a> with no href via a tiny inline plugin.
        const root = tree as unknown as { children: unknown[] };
        root.children.push({
          type: "element",
          tagName: "a",
          properties: {},
          children: [{ type: "text", value: "no href" }],
        });
      })
      .use(resolveAnchorLinks)
      .use(rehypeStringify)
      .process({ value: "_p_", data: { documentLinks: [] } });
    expect(String(out)).toContain("<a>no href</a>");
  });

  it("leaves cross-doc rewriting alone when documentLinks is empty", async () => {
    const out = await transform("[link](./0001-postgres.md)", []);
    expect(out).toContain("data-broken-link");
    expect(out).not.toContain("data-cross-doc");
  });

  it("skips the rewrite when the matched link's href doesn't parse to a portal route", async () => {
    const malformed: DocLink = {
      direction: "outgoing",
      target: "./0001-postgres.md",
      href: "not-a-real-api-href",
    };
    const out = await transform("[link](./0001-postgres.md)", [malformed]);
    // Falls through to the broken-link branch since the apiHrefToPortalRoute returned null.
    expect(out).toContain("data-broken-link");
    expect(out).not.toContain("data-cross-doc");
  });
});
