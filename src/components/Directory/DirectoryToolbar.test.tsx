import { describe, expect, it } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { DirectoryToolbar } from "./DirectoryToolbar";
import { renderRoute } from "../../../tests/utils/renderRoute";

function renderToolbar(initialUrl: string, shownCount: number, totalCount: number) {
  return renderRoute(
    {
      path: "/",
      Component: () => <DirectoryToolbar shownCount={shownCount} totalCount={totalCount} />,
    },
    [initialUrl],
  );
}

describe("<DirectoryToolbar>", () => {
  it("renders the results count as a single number when shown == total", () => {
    renderToolbar("/", 11, 11);
    expect(screen.getByText("Results")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
  });

  it("renders shown / total when client-side filtering has narrowed the rows", () => {
    renderToolbar("/", 3, 11);
    expect(screen.getByText("3 / 11")).toBeInTheDocument();
  });

  it("renders the sort toggle with two options", () => {
    renderToolbar("/", 1, 1);
    const updated = screen.getByRole("radio", { name: /updated/i });
    const number = screen.getByRole("radio", { name: /number/i });
    expect(updated).toBeInTheDocument();
    expect(number).toBeInTheDocument();
  });

  it("marks `updated ↓` active by default (rfc-api default)", () => {
    renderToolbar("/", 1, 1);
    const updated = screen.getByRole("radio", { name: /updated/i });
    expect(updated).toHaveAttribute("aria-checked", "true");
  });

  it("reads ?sort=id_asc from the URL and marks `number ↑` active", () => {
    renderToolbar("/?sort=id_asc", 1, 1);
    const numberOpt = screen.getByRole("radio", { name: /number/i });
    expect(numberOpt).toHaveAttribute("aria-checked", "true");
  });

  it("disables the filter trigger (Phase 1 stub)", () => {
    renderToolbar("/", 1, 1);
    const trigger = screen.getByRole("button", { name: /filter/i });
    expect(trigger).toBeDisabled();
  });

  it("updates ?sort= on click — id_asc when clicking `number ↑`", () => {
    renderToolbar("/", 1, 1);
    const numberOpt = screen.getByRole("radio", { name: /number/i });
    fireEvent.click(numberOpt);
    expect(numberOpt).toHaveAttribute("aria-checked", "true");
  });
});
