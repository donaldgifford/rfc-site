import { describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Input } from "./Input";

describe("<Input>", () => {
  it("renders the right data-size attr; defaults to md", () => {
    const { rerender } = render(<Input placeholder="default" />);
    // Shell <span> wraps the native <input>; size data attr lives on
    // the shell so consumers can target it.
    const shell = screen.getByPlaceholderText("default").parentElement;
    expect(shell).toHaveAttribute("data-size", "md");

    rerender(<Input size="sm" placeholder="small" />);
    expect(screen.getByPlaceholderText("small").parentElement).toHaveAttribute("data-size", "sm");
  });

  it("forwards refs to the underlying <input> element", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} placeholder="x" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.placeholder).toBe("x");
  });

  it("passes native props through (id, name, aria-*, autoComplete)", () => {
    render(
      <Input id="search-q" name="q" aria-label="Search" autoComplete="off" placeholder="search" />,
    );
    const input = screen.getByPlaceholderText("search");
    expect(input).toHaveAttribute("id", "search-q");
    expect(input).toHaveAttribute("name", "q");
    expect(input).toHaveAttribute("aria-label", "Search");
    expect(input).toHaveAttribute("autocomplete", "off");
  });

  it("defaults type to 'text' but respects an explicit type", () => {
    const { rerender } = render(<Input placeholder="t1" />);
    expect(screen.getByPlaceholderText("t1")).toHaveAttribute("type", "text");

    rerender(<Input type="search" placeholder="t2" />);
    expect(screen.getByPlaceholderText("t2")).toHaveAttribute("type", "search");
  });

  it("renders prefix and suffix slots when supplied; omits them when not", () => {
    const { rerender, container } = render(<Input placeholder="bare" />);
    expect(container.querySelector('[data-slot="prefix"]')).toBeNull();
    expect(container.querySelector('[data-slot="suffix"]')).toBeNull();

    rerender(
      <Input
        placeholder="with-slots"
        prefix={<span data-testid="prefix-icon">🔍</span>}
        suffix={<span data-testid="suffix-hint">⌘K</span>}
      />,
    );
    expect(screen.getByTestId("prefix-icon")).toBeInTheDocument();
    expect(screen.getByTestId("suffix-hint")).toBeInTheDocument();
  });

  it("merges className on the shell rather than replacing it", () => {
    render(<Input placeholder="m" className="custom-class" />);
    const shell = screen.getByPlaceholderText("m").parentElement;
    expect(shell).toHaveClass("custom-class");
    expect(shell?.className.split(/\s+/).length).toBeGreaterThan(1);
  });

  it("accepts typing input and fires onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Input placeholder="typed" onChange={onChange} />);
    const input = screen.getByPlaceholderText<HTMLInputElement>("typed");
    await user.type(input, "hello");
    expect(input.value).toBe("hello");
    expect(onChange).toHaveBeenCalled();
  });

  it("propagates disabled to the <input> and reflects it on the shell via data-disabled", () => {
    render(<Input placeholder="d" disabled />);
    const input = screen.getByPlaceholderText("d");
    expect(input).toBeDisabled();
    expect(input.parentElement).toHaveAttribute("data-disabled", "true");
  });
});
