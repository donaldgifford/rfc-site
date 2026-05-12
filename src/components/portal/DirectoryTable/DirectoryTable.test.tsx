import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { DirectoryTable } from "./DirectoryTable";
import type { Document } from "../../../portal/api/__generated__/model";

function renderTable(documents: readonly Document[]) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <DirectoryTable documents={documents} />,
      },
      // Stub destination routes so RR7 Link resolution doesn't warn.
      { path: "/adr/:id", element: <div /> },
      { path: "/rfc/:id", element: <div /> },
    ],
    { initialEntries: ["/"] },
  );
  return render(<RouterProvider router={router} />);
}

const sample: Document[] = [
  {
    id: "ADR-0001",
    type: "adr",
    title: "Use PostgreSQL for primary storage",
    status: "accepted",
    authors: [{ name: "Donald Gifford" }],
    created_at: "2026-03-15T00:00:00Z",
    updated_at: "2026-04-12T00:00:00Z",
    source: { repo: "donaldgifford/rfc-site", path: "fixtures/adr/0001.md" },
  },
  {
    id: "RFC-0001",
    type: "rfc",
    title: "Adopt MSW-backed dev mode for the portal",
    status: "proposed",
    authors: [{ name: "Donald Gifford" }, { name: "A. N. Other" }],
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-20T00:00:00Z",
    source: { repo: "donaldgifford/rfc-site", path: "fixtures/rfc/0001.md" },
  },
];

describe("<DirectoryTable>", () => {
  it("renders a single <table> with all 5 expected column headers", () => {
    renderTable(sample);
    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();

    const headers = within(table).getAllByRole("columnheader");
    expect(headers.map((h) => h.textContent)).toEqual([
      "ID",
      "Title",
      "Status",
      "Authors",
      "Updated",
    ]);
  });

  it("renders one row per document with id + title + Badge + authors visible", () => {
    renderTable(sample);

    expect(screen.getByText("ADR-0001")).toBeInTheDocument();
    expect(screen.getByText("RFC-0001")).toBeInTheDocument();
    expect(screen.getByText("Use PostgreSQL for primary storage")).toBeInTheDocument();
    expect(screen.getByText("Adopt MSW-backed dev mode for the portal")).toBeInTheDocument();
    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.getByText("Proposed")).toBeInTheDocument();
    expect(screen.getByText("Donald Gifford")).toBeInTheDocument();
    expect(screen.getByText("Donald Gifford, A. N. Other")).toBeInTheDocument();
  });

  it("makes only the title clickable (links to /$type/$urlId using the URL-form id)", () => {
    renderTable(sample);
    expect(
      screen.getByRole("link", { name: "Use PostgreSQL for primary storage" }),
    ).toHaveAttribute("href", "/adr/0001");
    expect(
      screen.getByRole("link", { name: "Adopt MSW-backed dev mode for the portal" }),
    ).toHaveAttribute("href", "/rfc/0001");

    // Exactly one link per row — the table is not "card-style" clickable.
    const allLinks = screen.getAllByRole("link");
    expect(allLinks).toHaveLength(2);
  });

  it("renders an em-dash placeholder when authors is empty/undefined", () => {
    const base = sample[0];
    if (base === undefined) throw new Error("fixture invariant: sample is non-empty");
    const docs: Document[] = [
      {
        ...base,
        id: "ADR-0002",
        title: "Anon",
        authors: undefined,
      },
    ];
    renderTable(docs);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("uses a semantic <time> element with the raw updated_at value as dateTime", () => {
    const { container } = renderTable(sample);
    const times = Array.from(container.querySelectorAll("time"));
    expect(times).toHaveLength(2);
    expect(times[0]?.getAttribute("datetime")).toBe("2026-04-12T00:00:00Z");
    expect(times[1]?.getAttribute("datetime")).toBe("2026-04-20T00:00:00Z");
  });
});
