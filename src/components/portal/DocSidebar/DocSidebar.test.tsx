import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { DocSidebar } from "./DocSidebar";
import type { Document } from "../../../portal/api/__generated__/model";

const baseDoc: Document = {
  id: "RFC-0001",
  type: "rfc",
  title: "Test RFC",
  status: "proposed",
  authors: [{ name: "Sam Author" }, { name: "Riley Reviewer" }],
  created_at: "2026-03-15T00:00:00Z",
  updated_at: "2026-04-12T00:00:00Z",
  source: {
    repo: "donaldgifford/rfc-site",
    path: "fixtures/rfc/0001.md",
    commit: "abc123",
  },
};

describe("<DocSidebar>", () => {
  it("renders all baseline metadata blocks (Status, Authors, Created, Updated, Source)", () => {
    render(<DocSidebar document={baseDoc} />);

    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Proposed")).toBeInTheDocument();

    expect(screen.getByText("Authors")).toBeInTheDocument();
    expect(screen.getByText("Sam Author")).toBeInTheDocument();
    expect(screen.getByText("Riley Reviewer")).toBeInTheDocument();

    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("Updated")).toBeInTheDocument();

    expect(screen.getByText("Source")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /donaldgifford\/rfc-site/ })).toHaveAttribute(
      "href",
      "https://github.com/donaldgifford/rfc-site/blob/abc123/fixtures/rfc/0001.md",
    );
  });

  it("wraps the sidebar in an <aside> with an aria-label landmark", () => {
    render(<DocSidebar document={baseDoc} />);
    expect(screen.getByRole("complementary", { name: /document metadata/i })).toBeInTheDocument();
  });

  it("uses raw ISO timestamps for the <time dateTime> attribute", () => {
    const { container } = render(<DocSidebar document={baseDoc} />);
    const times = Array.from(container.querySelectorAll("time"));
    const dates = times.map((t) => t.getAttribute("datetime"));
    expect(dates).toContain("2026-03-15T00:00:00Z");
    expect(dates).toContain("2026-04-12T00:00:00Z");
  });

  it("falls back to HEAD when source.commit is missing", () => {
    const doc: Document = {
      ...baseDoc,
      source: { repo: "donaldgifford/rfc-site", path: "fixtures/rfc/0001.md" },
    };
    render(<DocSidebar document={doc} />);
    expect(screen.getByRole("link", { name: /donaldgifford\/rfc-site/ })).toHaveAttribute(
      "href",
      "https://github.com/donaldgifford/rfc-site/blob/HEAD/fixtures/rfc/0001.md",
    );
  });

  it("omits the Authors block entirely when authors is empty/undefined", () => {
    const doc: Document = { ...baseDoc, authors: undefined };
    render(<DocSidebar document={doc} />);
    expect(screen.queryByText("Authors")).not.toBeInTheDocument();
  });

  it("renders the Discussion block only when discussion.url is set", () => {
    const without = render(<DocSidebar document={baseDoc} />);
    expect(without.queryByText("Discussion")).not.toBeInTheDocument();
    without.unmount();

    render(
      <DocSidebar
        document={{
          ...baseDoc,
          discussion: { url: "https://github.com/x/y/pull/1", comment_count: 3 },
        }}
      />,
    );
    expect(screen.getByText("Discussion")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view discussion/i })).toHaveAttribute(
      "href",
      "https://github.com/x/y/pull/1",
    );
    expect(screen.getByText("3 comments")).toBeInTheDocument();
  });

  it("renders Labels list when labels are present", () => {
    render(<DocSidebar document={{ ...baseDoc, labels: ["dev-mode", "tooling"] }} />);
    expect(screen.getByText("Labels")).toBeInTheDocument();
    expect(screen.getByText("dev-mode")).toBeInTheDocument();
    expect(screen.getByText("tooling")).toBeInTheDocument();
  });
});
