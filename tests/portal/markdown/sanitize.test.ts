import { describe, expect, it } from "vitest";
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeStringify from "rehype-stringify";
import rehypeSanitize from "rehype-sanitize";

import { sanitizeSchema } from "../../../src/portal/markdown/pipeline";

async function sanitize(html: string): Promise<string> {
  const out = await unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeStringify)
    .process(html);
  return String(out);
}

describe("sanitize schema — adversarial inputs", () => {
  it("strips <script> tags entirely", async () => {
    const out = await sanitize('<p>before<script>alert("xss")</script>after</p>');
    expect(out).not.toContain("<script>");
    expect(out).not.toContain("alert");
  });

  it("strips <iframe> tags", async () => {
    const out = await sanitize('<iframe src="https://attacker.example.com"></iframe>');
    expect(out).not.toContain("<iframe");
  });

  it("strips <object> and <embed>", async () => {
    const o1 = await sanitize('<object data="evil.swf"></object>');
    const o2 = await sanitize('<embed src="evil.swf">');
    expect(o1).not.toContain("<object");
    expect(o2).not.toContain("<embed");
  });

  it("strips <form> and <input>", async () => {
    const out = await sanitize(
      '<form action="https://attacker"><input type="text" name="phish"></form>',
    );
    expect(out).not.toContain("<form");
    // Tasklist <input type=checkbox disabled> is allowed; arbitrary inputs are not.
    expect(out).not.toContain('type="text"');
  });

  it("strips on* event handlers", async () => {
    const out = await sanitize('<p onclick="alert(1)" onmouseover="alert(2)">click</p>');
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("onmouseover");
    expect(out).not.toContain("alert");
  });

  it("strips javascript: URIs from href", async () => {
    const out = await sanitize('<a href="javascript:alert(1)">click</a>');
    expect(out).not.toMatch(/href=["']?javascript:/i);
  });

  it("strips data: URIs from href", async () => {
    const out = await sanitize('<a href="data:text/html,<script>alert(1)</script>">click</a>');
    expect(out).not.toMatch(/href=["']?data:/i);
  });

  it("strips style on tags that don't allow it", async () => {
    // The schema permits `style` on <pre>/<code>/<span> for Shiki; everywhere
    // else it must be stripped to prevent CSS-injection vectors.
    const out = await sanitize('<p style="background:url(http://evil)">x</p>');
    expect(out).not.toMatch(/<p[^>]*style=/);
  });

  it("strips srcset/lowsrc on <img>", async () => {
    // `src` is allowlisted; `srcset` (with raw http resources) is not.
    const out = await sanitize('<img src="https://example.com/a.png" srcset="evil 2x">');
    expect(out).not.toContain("srcset");
  });

  it("preserves <a target=_blank> when it reaches sanitize — defence shifts upstream", async () => {
    // Pre-IMPL-0006 this test asserted that target was stripped, but the
    // post-migration design lets `resolveAnchorLinks` set `target=_blank`
    // + `rel=noopener noreferrer` together for external links, so
    // `target` is now in the allowlist on `<a>`. The defense against
    // raw-HTML tabnabbing moves upstream — `remark-rehype` runs with
    // `allowDangerousHtml: false`, so user-authored `<a target=…>` HTML
    // in Markdown source never reaches the hast tree to begin with.
    const out = await sanitize('<a href="https://evil" target="_blank">x</a>');
    expect(out).toContain('target="_blank"');
  });

  it("preserves allowlisted GFM markup", async () => {
    const out = await sanitize(
      "<table><thead><tr><th>a</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>",
    );
    expect(out).toContain("<table>");
    expect(out).toContain("<th>a</th>");
    expect(out).toContain("<td>1</td>");
  });

  it("preserves <mark> for snippet rendering", async () => {
    const out = await sanitize("<p>before <mark>match</mark> after</p>");
    expect(out).toContain("<mark>match</mark>");
  });
});
