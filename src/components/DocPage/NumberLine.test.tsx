import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NumberLine } from "./NumberLine";

describe("<NumberLine>", () => {
  it("uppercases the type and renders the slash-separated eyebrow", () => {
    render(<NumberLine type="rfc" number="0011" />);
    expect(screen.getByText("RFC / 0011")).toBeInTheDocument();
  });

  it("uppercases any case the loader provides", () => {
    render(<NumberLine type="Adr" number="0042" />);
    expect(screen.getByText("ADR / 0042")).toBeInTheDocument();
  });
});
