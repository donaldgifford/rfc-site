import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Document } from "../../portal/api/__generated__/model";
import { HeaderMeta } from "./HeaderMeta";

function fixture(overrides: Partial<Document> = {}): Document {
  return {
    id: "RFC-0011",
    type: "rfc",
    title: "x",
    status: "draft",
    authors: [{ name: "donald", handle: "donald" }],
    created_at: "2026-05-01T00:00:00Z",
    updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    source: { repo: "x", path: "y", commit: "abcdef0123456789" },
    ...overrides,
  };
}

describe("<HeaderMeta>", () => {
  it("renders the status badge", () => {
    render(<HeaderMeta doc={fixture()} />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("renders authors joined by comma after `authored by`", () => {
    render(
      <HeaderMeta
        doc={fixture({
          authors: [
            { name: "donald", handle: "d" },
            { name: "sam", handle: "s" },
          ],
        })}
      />,
    );
    expect(screen.getByText("donald, sam")).toBeInTheDocument();
    expect(screen.getByText(/authored by/i)).toBeInTheDocument();
  });

  it("renders the 7-char revision", () => {
    render(<HeaderMeta doc={fixture()} />);
    expect(screen.getByText(/revision abcdef0/i)).toBeInTheDocument();
  });

  it("renders a relative updated time", () => {
    render(<HeaderMeta doc={fixture()} />);
    expect(screen.getByText(/hours? ago/i)).toBeInTheDocument();
  });

  it("preserves the raw ISO on the <time> dateTime attribute", () => {
    const iso = "2026-05-15T10:00:00Z";
    render(<HeaderMeta doc={fixture({ updated_at: iso })} />);
    const time =
      (screen.getByRole("time", { hidden: true }) as HTMLTimeElement | null) ??
      document.querySelector("time");
    expect(time).not.toBeNull();
    expect(time).toHaveAttribute("dateTime", iso);
  });
});
