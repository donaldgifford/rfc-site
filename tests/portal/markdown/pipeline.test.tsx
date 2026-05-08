import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { DocumentView } from "../../../src/portal/markdown/DocumentView";
import type { Document } from "../../../src/portal/api/__generated__/model";

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
    ...overrides,
  } as Document;
}

describe("markdown pipeline — GFM", () => {
  it("renders tables", async () => {
    const body = ["| Col A | Col B |", "| --- | --- |", "| 1 | 2 |"].join("\n");
    render(<DocumentView document={fixture(body)} />);
    const table = await screen.findByRole("table");
    expect(table).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Col A" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "1" })).toBeInTheDocument();
  });

  it("renders task lists with disabled checkboxes", async () => {
    const body = ["- [x] done", "- [ ] todo"].join("\n");
    render(<DocumentView document={fixture(body)} />);
    const checkboxes = await screen.findAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    for (const cb of checkboxes) {
      expect(cb).toBeDisabled();
    }
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
  });

  it("renders strikethrough", async () => {
    render(<DocumentView document={fixture("~~struck~~")} />);
    const struck = await screen.findByText("struck");
    expect(struck.tagName).toBe("DEL");
  });

  it("renders autolinks", async () => {
    render(<DocumentView document={fixture("Visit https://example.com for info.")} />);
    const link = await screen.findByRole("link", { name: "https://example.com" });
    expect(link).toHaveAttribute("href", "https://example.com");
  });
});

describe("markdown pipeline — heading anchors", () => {
  it("emits stable kebab-case slug ids on headings", async () => {
    const body = "## Cross-Document Link Resolution";
    const { container } = render(<DocumentView document={fixture(body)} />);
    const heading = await screen.findByRole("heading", { level: 2 });
    expect(heading).toHaveAttribute("id", "cross-document-link-resolution");
    // Anchor is prepended as a child of the heading.
    await waitFor(() => {
      const anchor = container.querySelector(".heading-anchor");
      expect(anchor).not.toBeNull();
      expect(anchor?.getAttribute("href")).toBe("#cross-document-link-resolution");
    });
  });

  it("computes the aria-label as 'Permalink to <heading text>'", async () => {
    const body = "## Section Two";
    render(<DocumentView document={fixture(body)} />);
    const anchor = await screen.findByRole("link", { name: /^Permalink to Section Two$/ });
    expect(anchor).toHaveClass("heading-anchor");
  });
});

describe("markdown pipeline — code highlighting", () => {
  it("emits the Shiki <pre><code><span> shape with language class", async () => {
    const body = ["```ts", "const x: number = 42;", "```"].join("\n");
    const { container } = render(<DocumentView document={fixture(body)} />);
    // Shiki sets the .shiki class on <pre>.
    await waitFor(() => {
      const pre = container.querySelector("pre.shiki");
      expect(pre).not.toBeNull();
      const code = pre?.querySelector("code");
      expect(code).not.toBeNull();
      // Per-token <span> elements with inline styles (the dual-theme CSS vars).
      const spans = pre?.querySelectorAll("code span");
      expect(spans?.length ?? 0).toBeGreaterThan(0);
    });
  });

  it("preserves inline code without Shiki wrapping", async () => {
    render(<DocumentView document={fixture("Some `inline_code` here.")} />);
    const code = await screen.findByText("inline_code");
    expect(code.tagName).toBe("CODE");
    // Inline code is not inside a <pre>.
    expect(code.closest("pre")).toBeNull();
  });
});

describe("markdown pipeline — sanitize allowlist", () => {
  it("preserves Shiki inline styles on <span>", async () => {
    const body = ["```js", "const a = 1;", "```"].join("\n");
    const { container } = render(<DocumentView document={fixture(body)} />);
    await waitFor(() => {
      const styledSpan = container.querySelector("pre.shiki code span[style]");
      expect(styledSpan).not.toBeNull();
    });
  });

  it("preserves the heading-anchor class on the prepended <a>", async () => {
    const body = "# Hello";
    const { container } = render(<DocumentView document={fixture(body)} />);
    await waitFor(() => {
      expect(container.querySelector("a.heading-anchor")).not.toBeNull();
    });
  });
});
