import { describe, expect, it } from "vitest";
import { createRef } from "react";
import { render, screen } from "@testing-library/react";

import { Kbd } from "./Kbd";

describe("<Kbd>", () => {
  it("renders a <kbd> element with the supplied content", () => {
    render(<Kbd>⌘K</Kbd>);
    const kbd = screen.getByText("⌘K");
    expect(kbd.tagName).toBe("KBD");
  });

  it("renders the right data-size attr; defaults to sm", () => {
    const { rerender } = render(<Kbd>default</Kbd>);
    expect(screen.getByText("default")).toHaveAttribute("data-size", "sm");

    rerender(<Kbd size="md">md</Kbd>);
    expect(screen.getByText("md")).toHaveAttribute("data-size", "md");
  });

  it("forwards refs to the underlying <kbd> element", () => {
    const ref = createRef<HTMLElement>();
    render(<Kbd ref={ref}>↵</Kbd>);
    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current?.tagName).toBe("KBD");
  });

  it("passes native props through (id, data-*, aria-*, title)", () => {
    render(
      <Kbd id="esc-hint" data-testid="esc" aria-label="Escape key" title="Press Escape">
        esc
      </Kbd>,
    );
    const kbd = screen.getByTestId("esc");
    expect(kbd).toHaveAttribute("id", "esc-hint");
    expect(kbd).toHaveAttribute("aria-label", "Escape key");
    expect(kbd).toHaveAttribute("title", "Press Escape");
  });

  it("merges className rather than replacing it", () => {
    render(<Kbd className="custom-class">x</Kbd>);
    const kbd = screen.getByText("x");
    expect(kbd).toHaveClass("custom-class");
    expect(kbd.className.split(/\s+/).length).toBeGreaterThan(1);
  });
});
