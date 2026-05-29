import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import type { Document } from "../../portal/api/__generated__/model";
import { ReferencesFooter } from "./ReferencesFooter";
import { renderRoute } from "../../../tests/utils/renderRoute";

function fixture(overrides: Partial<Document> = {}): Document {
  return {
    id: "RFC-0011",
    type: "rfc",
    title: "x",
    status: "draft",
    authors: [],
    labels: [],
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-15T10:00:00Z",
    source: { repo: "x", path: "y", commit: "abcdef" },
    links: [
      {
        direction: "outgoing",
        target: "RFC-0008",
        href: "/api/v1/rfc/0008",
        label: "Wiz CSPM deployment and scope",
      },
      {
        direction: "outgoing",
        target: "RFC-0006",
        href: "/api/v1/rfc/0006",
        label: "Identity Center and Okta federation model",
      },
    ],
    ...overrides,
  };
}

function renderFooter(doc: Document) {
  return renderRoute(
    {
      path: "/",
      Component: () => <ReferencesFooter doc={doc} />,
    },
    ["/"],
  );
}

describe("<ReferencesFooter>", () => {
  it("renders the References + Referenced by headings", () => {
    renderFooter(fixture());
    expect(screen.getByText("References")).toBeInTheDocument();
    expect(screen.getByText("Referenced by")).toBeInTheDocument();
  });

  it("renders outgoing references as Link rows with the portal route", () => {
    renderFooter(fixture());
    const rfc8 = screen.getByText("RFC-0008").closest("a");
    expect(rfc8).toHaveAttribute("href", "/rfc/0008");
    expect(screen.getByText("Wiz CSPM deployment and scope")).toBeInTheDocument();
  });

  it("renders the references empty state when there are no outgoing links", () => {
    renderFooter(fixture({ links: [] }));
    expect(screen.getByText(/doesn[’']t reference any others/)).toBeInTheDocument();
  });

  it("renders the back-references empty state", () => {
    renderFooter(fixture());
    expect(screen.getByText(/no other RFCs reference this one/i)).toBeInTheDocument();
  });

  it("ignores incoming links — only outgoing references are rendered", () => {
    renderFooter(
      fixture({
        links: [
          {
            direction: "incoming",
            target: "RFC-0005",
            href: "/api/v1/rfc/0005",
            label: "Should not appear",
          },
        ],
      }),
    );
    expect(screen.queryByText("Should not appear")).not.toBeInTheDocument();
  });
});
