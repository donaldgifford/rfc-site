import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DirectoryHero } from "./DirectoryHero";

describe("<DirectoryHero>", () => {
  it("renders the eyebrow + serif title", () => {
    render(<DirectoryHero eyebrow="/ docs / rfcs" title="Request for Comments" />);
    expect(screen.getByText("/ docs / rfcs")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Request for Comments" }),
    ).toBeInTheDocument();
  });

  it("slots children below the title", () => {
    render(
      <DirectoryHero eyebrow="x" title="y">
        <p data-testid="slot">slotted</p>
      </DirectoryHero>,
    );
    expect(screen.getByTestId("slot")).toBeInTheDocument();
  });
});
