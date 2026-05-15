import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("<StatusBadge>", () => {
  it("renders the label with the first letter capitalised", () => {
    render(<StatusBadge status="draft" />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it.each([
    ["draft"],
    ["proposed"],
    ["accepted"],
    ["rejected"],
    ["superseded"],
    ["abandoned"],
    ["published"],
    ["discussion"],
  ])("renders a known variant: %s", (status) => {
    const { container } = render(<StatusBadge status={status} />);
    expect(container.firstChild).toBeInstanceOf(HTMLSpanElement);
    expect(screen.getByText(new RegExp(status, "i"))).toBeInTheDocument();
  });

  it("falls back to the draft styling for unknown statuses", () => {
    const { container } = render(<StatusBadge status="unknown-status" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toMatch(/draft/);
  });

  it("respects the size prop", () => {
    const { container } = render(<StatusBadge status="draft" size="sm" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toMatch(/sm/);
  });

  it("renders an empty string for empty status without crashing", () => {
    const { container } = render(<StatusBadge status="" />);
    expect(container.firstChild).toBeInstanceOf(HTMLSpanElement);
  });
});
