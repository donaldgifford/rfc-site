import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Breadcrumb } from "./Breadcrumb";

describe("<Breadcrumb>", () => {
  it("renders a nav landmark with aria-label='Breadcrumb' and an ordered list", () => {
    render(
      <Breadcrumb>
        <Breadcrumb.Item href="/">Home</Breadcrumb.Item>
        <Breadcrumb.Item href="/docs">Docs</Breadcrumb.Item>
        <Breadcrumb.Item>Current</Breadcrumb.Item>
      </Breadcrumb>,
    );

    const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
    expect(nav).toBeInTheDocument();
    expect(nav.querySelector("ol")).not.toBeNull();
    expect(nav.querySelectorAll("li")).toHaveLength(3);
  });

  it("renders linked items as <a href> and the final item (no href) as plain text", () => {
    render(
      <Breadcrumb>
        <Breadcrumb.Item href="/">Home</Breadcrumb.Item>
        <Breadcrumb.Item href="/docs">Docs</Breadcrumb.Item>
        <Breadcrumb.Item>Current</Breadcrumb.Item>
      </Breadcrumb>,
    );

    const homeLink = screen.getByRole("link", { name: "Home" });
    expect(homeLink.tagName).toBe("A");
    expect(homeLink).toHaveAttribute("href", "/");

    const docsLink = screen.getByRole("link", { name: "Docs" });
    expect(docsLink).toHaveAttribute("href", "/docs");

    // The final item is not a link — it has no role="link".
    expect(screen.queryByRole("link", { name: "Current" })).toBeNull();
    const current = screen.getByText("Current");
    expect(current.tagName).toBe("SPAN");
  });

  it("sets aria-current='page' when current={true}, regardless of href", () => {
    render(
      <Breadcrumb>
        <Breadcrumb.Item href="/">Home</Breadcrumb.Item>
        <Breadcrumb.Item href="/docs" current>
          Docs
        </Breadcrumb.Item>
      </Breadcrumb>,
    );

    const current = screen.getByText("Docs");
    expect(current).toHaveAttribute("aria-current", "page");
    // current=true overrides the link rendering even with href present.
    expect(current.tagName).toBe("SPAN");
    expect(screen.queryByRole("link", { name: "Docs" })).toBeNull();
  });

  it("annotates path-parameter items with data-param='true' on the <li>", () => {
    const { container } = render(
      <Breadcrumb>
        <Breadcrumb.Item href="/">Home</Breadcrumb.Item>
        <Breadcrumb.Item param>{"{type}"}</Breadcrumb.Item>
        <Breadcrumb.Item param>{"{id}"}</Breadcrumb.Item>
      </Breadcrumb>,
    );

    const params = container.querySelectorAll('li[data-param="true"]');
    expect(params).toHaveLength(2);
    expect(params[0]?.textContent).toBe("{type}");
    expect(params[1]?.textContent).toBe("{id}");
  });

  it("merges className on linked + non-linked items (never replaces)", () => {
    render(
      <Breadcrumb>
        <Breadcrumb.Item href="/" className="custom-link">
          Home
        </Breadcrumb.Item>
        <Breadcrumb.Item className="custom-text">Current</Breadcrumb.Item>
      </Breadcrumb>,
    );

    const link = screen.getByRole("link", { name: "Home" });
    expect(link.className).toMatch(/custom-link/);
    expect(link.className.split(/\s+/).length).toBeGreaterThan(1);

    const text = screen.getByText("Current");
    expect(text.className).toMatch(/custom-text/);
    expect(text.className.split(/\s+/).length).toBeGreaterThan(1);
  });

  it("supports asChild composition for RR7 <Link>-style wrappers", () => {
    render(
      <Breadcrumb>
        <Breadcrumb.Item asChild>
          <a href="/docs" data-testid="rr7-link">
            Docs
          </a>
        </Breadcrumb.Item>
      </Breadcrumb>,
    );

    const link = screen.getByTestId("rr7-link");
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/docs");
  });
});
