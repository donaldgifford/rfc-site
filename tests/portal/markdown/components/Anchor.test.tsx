import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";

import { DocumentView } from "../../../../src/portal/markdown/DocumentView";
import type { Document } from "../../../../src/portal/api/__generated__/model";

function fixture(body: string, links: Document["links"] = []): Document {
  return {
    id: "RFC-0001",
    type: "rfc",
    status: "proposed",
    title: "Fixture",
    body,
    authors: [],
    links,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    source: { repo: "x/y", path: "z.md", commit: "deadbeef" },
  };
}

function renderWithRouter(doc: Document): void {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <DocumentView document={doc} /> },
    { path: "/:type/:id", Component: () => <p>doc page</p> },
  ]);
  render(<Stub initialEntries={["/"]} />);
}

describe("<Anchor>", () => {
  it("renders an RR7 <Link> for href that matches links[].target (canonical id)", async () => {
    const doc = fixture("See [ADR-0001](ADR-0001) for context.", [
      { direction: "outgoing", target: "ADR-0001", href: "/api/v1/adr/0001" },
    ]);
    renderWithRouter(doc);
    const link = await screen.findByRole("link", { name: "ADR-0001" });
    expect(link).toHaveAttribute("href", "/adr/0001");
  });

  it("renders an RR7 <Link> for href that matches links[].href (API URL fallback)", async () => {
    const doc = fixture("See [the API URL](/api/v1/rfc/0002) for context.", [
      { direction: "outgoing", target: "RFC-0002", href: "/api/v1/rfc/0002" },
    ]);
    renderWithRouter(doc);
    const link = await screen.findByRole("link", { name: "the API URL" });
    expect(link).toHaveAttribute("href", "/rfc/0002");
  });

  it("renders an external <a target=_blank rel=noopener> for unmatched http(s) URLs", async () => {
    const doc = fixture("See [example](https://example.com) for context.");
    renderWithRouter(doc);
    const link = await screen.findByRole("link", { name: "example" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders <span data-broken-link> for unmatched internal-looking hrefs", async () => {
    const doc = fixture("See [stale](./stale-doc.md) for context.");
    renderWithRouter(doc);
    const span = await screen.findByText("stale");
    expect(span.tagName).toBe("SPAN");
    expect(span).toHaveAttribute("data-broken-link");
    expect(span).toHaveAttribute("title", "Unresolved link: ./stale-doc.md");
  });

  it("preserves hash-only anchors as plain <a> for in-page navigation", async () => {
    const doc = fixture("Jump to [§Goals](#goals).");
    renderWithRouter(doc);
    const link = await screen.findByRole("link", { name: "§Goals" });
    expect(link).toHaveAttribute("href", "#goals");
  });
});
