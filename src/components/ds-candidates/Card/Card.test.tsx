import { describe, expect, it } from "vitest";
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, Link } from "react-router";

import { Card, CardHeader, CardBody, CardFooter } from "./Card";

describe("<Card>", () => {
  it("renders each variant + padding with the matching data attrs; defaults are flat/md", () => {
    const { rerender } = render(<Card data-testid="card">x</Card>);
    let card = screen.getByTestId("card");
    expect(card).toHaveAttribute("data-variant", "flat");
    expect(card).toHaveAttribute("data-padding", "md");

    rerender(
      <Card variant="elevated" padding="lg" data-testid="card">
        x
      </Card>,
    );
    card = screen.getByTestId("card");
    expect(card).toHaveAttribute("data-variant", "elevated");
    expect(card).toHaveAttribute("data-padding", "lg");

    rerender(
      <Card padding="sm" data-testid="card">
        x
      </Card>,
    );
    expect(screen.getByTestId("card")).toHaveAttribute("data-padding", "sm");
  });

  it("forwards refs to the underlying <div>", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Card ref={ref} data-testid="card">
        x
      </Card>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current?.textContent).toBe("x");
  });

  it("passes native props through (id, role, aria-*, onClick)", () => {
    render(
      <Card id="info" role="region" aria-label="info card" data-testid="card">
        body
      </Card>,
    );
    const card = screen.getByRole("region", { name: /info card/i });
    expect(card).toHaveAttribute("id", "info");
    expect(card).toBe(screen.getByTestId("card"));
  });

  it("merges className rather than replacing it", () => {
    render(
      <Card className="custom-class" data-testid="card">
        x
      </Card>,
    );
    const card = screen.getByTestId("card");
    expect(card).toHaveClass("custom-class");
    expect(card.className.split(/\s+/).length).toBeGreaterThan(1);
  });

  it("renders Header / Body / Footer sub-components", () => {
    render(
      <Card data-testid="card">
        <CardHeader data-testid="hd">Header</CardHeader>
        <CardBody data-testid="bd">Body content</CardBody>
        <CardFooter data-testid="ft">Footer</CardFooter>
      </Card>,
    );
    expect(screen.getByTestId("hd")).toHaveTextContent("Header");
    expect(screen.getByTestId("bd")).toHaveTextContent("Body content");
    expect(screen.getByTestId("ft")).toHaveTextContent("Footer");
    expect(screen.getByTestId("hd").parentElement).toBe(screen.getByTestId("card"));
  });

  it("exposes sub-components via dot notation (Card.Header / Card.Body / Card.Footer)", () => {
    render(
      <Card data-testid="card">
        <Card.Header data-testid="hd">H</Card.Header>
        <Card.Body data-testid="bd">B</Card.Body>
        <Card.Footer data-testid="ft">F</Card.Footer>
      </Card>,
    );
    expect(screen.getByTestId("hd")).toHaveTextContent("H");
    expect(screen.getByTestId("bd")).toHaveTextContent("B");
    expect(screen.getByTestId("ft")).toHaveTextContent("F");
  });

  it("with asChild, renders the child element (e.g. <Link>) with the card's data attrs + class", () => {
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: (
            <Card asChild variant="elevated" padding="lg" data-testid="card">
              <Link to="/about">About card</Link>
            </Card>
          ),
        },
        { path: "/about", element: <div>About page</div> },
      ],
      { initialEntries: ["/"] },
    );

    render(<RouterProvider router={router} />);
    const link = screen.getByRole("link", { name: /about card/i });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/about");
    expect(link).toHaveAttribute("data-variant", "elevated");
    expect(link).toHaveAttribute("data-padding", "lg");
  });
});
