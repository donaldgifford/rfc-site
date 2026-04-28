import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge, BADGE_STATUSES } from "./Badge";

describe("<Badge>", () => {
  it("renders the humanised status as text content by default", () => {
    render(<Badge status="accepted" />);
    expect(screen.getByText("Accepted")).toBeInTheDocument();
  });

  it("respects explicit children over the auto-humanised label", () => {
    render(<Badge status="accepted">Custom label</Badge>);
    expect(screen.getByText("Custom label")).toBeInTheDocument();
    expect(screen.queryByText("Accepted")).not.toBeInTheDocument();
  });

  it("normalises mixed-case status strings to the data-status attribute", () => {
    render(<Badge status="Accepted" data-testid="b" />);
    expect(screen.getByTestId("b")).toHaveAttribute("data-status", "accepted");
  });

  it("normalises whitespace-separated status to hyphenated data-status", () => {
    render(<Badge status="In Review" data-testid="b" />);
    expect(screen.getByTestId("b")).toHaveAttribute("data-status", "in-review");
  });

  it("defaults size to 'sm'; honours explicit size", () => {
    const { rerender } = render(<Badge status="draft" data-testid="b" />);
    expect(screen.getByTestId("b")).toHaveAttribute("data-size", "sm");

    rerender(<Badge status="draft" size="md" data-testid="b" />);
    expect(screen.getByTestId("b")).toHaveAttribute("data-size", "md");
  });

  it("forwards refs to the rendered span", () => {
    const ref = createRef<HTMLSpanElement>();
    render(
      <Badge status="draft" ref={ref}>
        X
      </Badge>,
    );
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
    expect(ref.current?.textContent).toBe("X");
  });

  it("merges (does not replace) consumer-provided className", () => {
    render(<Badge status="draft" className="consumer-class" data-testid="b" />);
    const node = screen.getByTestId("b");
    expect(node.className).toContain("consumer-class");
    // The internal styles.badge class should still be applied.
    expect(node.className.split(/\s+/).length).toBeGreaterThan(1);
  });

  it("passes native span props through (id, aria-*, onClick)", () => {
    let clicked = false;
    render(
      <Badge
        status="draft"
        id="b1"
        aria-label="Draft proposal"
        onClick={() => {
          clicked = true;
        }}
      />,
    );
    const node = screen.getByLabelText("Draft proposal");
    expect(node).toHaveAttribute("id", "b1");
    node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(clicked).toBe(true);
  });

  it("exposes a stable BADGE_STATUSES tuple matching the documented union", () => {
    expect(BADGE_STATUSES).toEqual([
      "draft",
      "proposed",
      "accepted",
      "rejected",
      "superseded",
      "abandoned",
    ]);
  });
});
