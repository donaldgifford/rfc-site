import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import type { Document } from "../../portal/api/__generated__/model";
import { DirectoryTable } from "./DirectoryTable";
import { renderRoute } from "../../../tests/utils/renderRoute";

function fixture(id: string, overrides: Partial<Document> = {}): Document {
  return {
    id,
    type: "rfc",
    title: `Title for ${id}`,
    status: "draft",
    authors: [{ name: "donald", handle: "donald" }],
    labels: [],
    created_at: "2026-05-14T08:00:00Z",
    updated_at: "2026-05-15T06:00:00Z",
    source: { repo: "x/y", path: "z.md", commit: "deadbeef" },
    ...overrides,
  };
}

function renderTable(docs: Document[], emptyMessage = "No matches.") {
  return renderRoute(
    {
      path: "/",
      Component: () => <DirectoryTable docs={docs} emptyMessage={emptyMessage} />,
    },
    ["/"],
  );
}

describe("<DirectoryTable>", () => {
  it("renders one <RfcRow> per doc", () => {
    renderTable([fixture("RFC-0001"), fixture("RFC-0002")]);
    expect(screen.getByText("Title for RFC-0001")).toBeInTheDocument();
    expect(screen.getByText("Title for RFC-0002")).toBeInTheDocument();
  });

  it("renders the empty message when there are no docs", () => {
    renderTable([], "Nothing here yet.");
    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
  });
});
