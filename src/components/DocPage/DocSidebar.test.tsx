import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Document } from "../../portal/api/__generated__/model";
import { DocSidebar } from "./DocSidebar";

function fixture(overrides: Partial<Document> = {}): Document {
  return {
    id: "RFC-0011",
    type: "rfc",
    title: "Portal for RFCs",
    status: "draft",
    authors: [{ name: "donald", handle: "donald" }],
    labels: ["platform", "docs"],
    created_at: "2026-04-16T12:00:00Z",
    updated_at: "2026-05-15T10:00:00Z",
    source: {
      repo: "donaldgifford/rfcs",
      path: "rfc/0011-portal.md",
      commit: "deadbeefcafe1234",
    },
    discussion: { url: "https://github.com/donaldgifford/rfcs/pull/412" },
    ...overrides,
  };
}

describe("<DocSidebar>", () => {
  it("renders status + created (date-only) + relative updated + revision (7-char commit)", () => {
    render(<DocSidebar doc={fixture()} />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("2026-04-16")).toBeInTheDocument();
    expect(screen.getByText("deadbee")).toBeInTheDocument();
  });

  it("renders Author (singular) for a single-author doc", () => {
    render(<DocSidebar doc={fixture()} />);
    expect(screen.getByText("Author")).toBeInTheDocument();
    expect(screen.getByText("donald")).toBeInTheDocument();
  });

  it("renders Authors (plural) joined by comma", () => {
    render(
      <DocSidebar
        doc={fixture({
          authors: [
            { name: "donald", handle: "donald" },
            { name: "sam", handle: "sam" },
          ],
        })}
      />,
    );
    expect(screen.getByText("Authors")).toBeInTheDocument();
    expect(screen.getByText("donald, sam")).toBeInTheDocument();
  });

  it("derives the PR tag from the discussion URL's trailing segment", () => {
    render(<DocSidebar doc={fixture()} />);
    const link = screen.getByRole("link", { name: "#412" });
    expect(link).toHaveAttribute("href", "https://github.com/donaldgifford/rfcs/pull/412");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("omits the PR row when discussion is absent", () => {
    render(<DocSidebar doc={fixture({ discussion: undefined })} />);
    expect(screen.queryByText("PR")).not.toBeInTheDocument();
  });

  it("omits the Labels section when labels is empty", () => {
    render(<DocSidebar doc={fixture({ labels: [] })} />);
    expect(screen.queryByText("Labels")).not.toBeInTheDocument();
  });

  it("renders each label as a label-tag chip", () => {
    render(<DocSidebar doc={fixture({ labels: ["platform", "docs", "tooling"] })} />);
    expect(screen.getByText("platform")).toBeInTheDocument();
    expect(screen.getByText("docs")).toBeInTheDocument();
    expect(screen.getByText("tooling")).toBeInTheDocument();
  });

  it("colours the status value with the matching --status-* token", () => {
    const { container } = render(<DocSidebar doc={fixture({ status: "accepted" })} />);
    const val = container.querySelector("[style*='--status-accepted']");
    expect(val).not.toBeNull();
  });

  it("normalises title-cased rfc-api status to the right token + label", () => {
    const { container } = render(<DocSidebar doc={fixture({ status: "Accepted" })} />);
    const val = container.querySelector("[style*='--status-accepted']");
    expect(val).not.toBeNull();
    expect(screen.getByText("Accepted")).toBeInTheDocument();
  });
});
