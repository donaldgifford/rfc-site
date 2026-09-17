import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import type { Document } from "../../portal/api/__generated__/model";
import { RfcRow } from "./RfcRow";
import { renderRoute } from "../../../tests/utils/renderRoute";

function fixture(overrides: Partial<Document> = {}): Document {
  return {
    id: "RFC-0011",
    type: "rfc",
    title: "RFC portal for viewing and searching documents",
    status: "draft",
    authors: [
      { name: "donald", handle: "donald" },
      { name: "sam", handle: "sam" },
    ],
    labels: ["platform", "docs"],
    created_at: "2026-05-14T08:00:00Z",
    updated_at: "2026-05-15T06:00:00Z",
    source: { repo: "x/y", path: "z.md", commit: "deadbeef" },
    ...overrides,
  };
}

function renderRow(doc: Document) {
  return renderRoute(
    {
      path: "/",
      Component: () => <RfcRow doc={doc} />,
    },
    ["/"],
  );
}

describe("<RfcRow>", () => {
  it("renders the numeric ID as a 4-digit mono string", () => {
    renderRow(fixture());
    expect(screen.getByText("0011")).toBeInTheDocument();
  });

  it("links to /<type>/<urlId>", () => {
    renderRow(fixture());
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/rfc/0011");
  });

  it("renders title + labels + status badge + authors", () => {
    renderRow(fixture());
    expect(screen.getByText(/portal for viewing/)).toBeInTheDocument();
    expect(screen.getByText("platform")).toBeInTheDocument();
    expect(screen.getByText("docs")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("donald, sam")).toBeInTheDocument();
  });

  it("renders an em-dash for an empty authors list", () => {
    renderRow(fixture({ authors: [] }));
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders a relative updated time string", () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    renderRow(fixture({ updated_at: fiveMinutesAgo }));
    expect(screen.getByText(/min/)).toBeInTheDocument();
  });

  it("preserves the raw timestamp on the <time> dateTime attribute", () => {
    const iso = "2026-05-14T08:00:00Z";
    renderRow(fixture({ updated_at: iso }));
    const time = screen.getByRole("link").querySelector("time");
    expect(time).not.toBeNull();
    expect(time).toHaveAttribute("dateTime", iso);
  });
});
