import { describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider, Link } from "react-router";

import { Button } from "./Button";

describe("<Button>", () => {
  it("renders each variant with the right data-variant attr", () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("data-variant", "primary");

    rerender(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("data-variant", "secondary");

    rerender(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("data-variant", "ghost");

    rerender(
      <Button variant="icon" aria-label="open">
        ⚙
      </Button>,
    );
    expect(screen.getByRole("button", { name: /open/i })).toHaveAttribute("data-variant", "icon");
  });

  it("renders each size with the right data-size attr; defaults to md", () => {
    const { rerender } = render(<Button>Default</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("data-size", "md");

    rerender(<Button size="sm">Small</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("data-size", "sm");

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("data-size", "lg");
  });

  it("forwards refs to the underlying <button> element", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Click</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.textContent).toBe("Click");
  });

  it("passes native props through (data-*, aria-*, id, type)", () => {
    render(
      <Button id="submit" data-testid="submit-button" aria-label="Submit form" type="submit">
        Submit
      </Button>,
    );
    const button = screen.getByTestId("submit-button");
    expect(button).toHaveAttribute("id", "submit");
    expect(button).toHaveAttribute("aria-label", "Submit form");
    expect(button).toHaveAttribute("type", "submit");
  });

  it("defaults type to 'button' so accidental form submits don't happen", () => {
    render(<Button>Inert</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("merges className rather than replacing it", () => {
    render(<Button className="custom-class">Click</Button>);
    const button = screen.getByRole("button");
    // The component's root class is whatever clsx returns from
    // (styles.root, "custom-class") — assert the custom class is on
    // the element AND the element has at least one other class
    // (the styles.root hash).
    expect(button).toHaveClass("custom-class");
    expect(button.className.split(/\s+/).length).toBeGreaterThan(1);
  });

  it("fires onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("blocks click + applies aria-disabled when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Disabled
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("with asChild, composes with the child element (e.g. <Link>) and forwards button styling", async () => {
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: (
            <Button asChild variant="primary" size="lg">
              <Link to="/about">About</Link>
            </Button>
          ),
        },
        { path: "/about", element: <div>About page</div> },
      ],
      { initialEntries: ["/"] },
    );

    render(<RouterProvider router={router} />);

    const link = screen.getByRole("link", { name: /about/i });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/about");
    expect(link).toHaveAttribute("data-variant", "primary");
    expect(link).toHaveAttribute("data-size", "lg");

    const user = userEvent.setup();
    await user.click(link);
    expect(screen.getByText(/about page/i)).toBeInTheDocument();
  });
});
