import { describe, expect, it } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { Topbar } from "./Topbar";
import { renderRoute } from "../../../tests/utils/renderRoute";

function renderTopbar(initial = "/") {
  return renderRoute(
    {
      path: "*",
      Component: () => <Topbar />,
    },
    [initial],
  );
}

describe("<Topbar>", () => {
  it("renders the 3-element brand composite", () => {
    renderTopbar();
    expect(screen.getByText("R")).toBeInTheDocument();
    expect(screen.getByText("rfcs")).toBeInTheDocument();
    expect(screen.getByText(/portal/)).toBeInTheDocument();
  });

  it("renders the search trigger with ⌘K affordance", () => {
    renderTopbar();
    const trigger = screen.getByRole("button", { name: /search documents/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("⌘");
    expect(trigger).toHaveTextContent("K");
  });

  it("renders the Directory NavLink as active on /", () => {
    renderTopbar("/");
    const link = screen.getByRole("link", { name: "Directory" });
    expect(link).toHaveAttribute("href", "/");
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("renders inert placeholders for unbuilt routes", () => {
    renderTopbar();
    for (const label of ["Frameworks", "API", "MCP", "About"]) {
      const placeholder = screen.getByText(label);
      expect(placeholder).toHaveAttribute("aria-disabled", "true");
    }
  });

  it("binds ⌘K / Ctrl+K to navigate to /search", () => {
    renderTopbar("/");
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    // The Topbar lives inside the routes stub; after navigation the
    // NavLink for Directory should still be in DOM but not active any more.
    // We check by asserting the rerendered Directory link no longer has
    // aria-current=page (navigation happened to /search, which the stub
    // routes don't match but RR7's NavLink still updates).
    const link = screen.getByRole("link", { name: "Directory" });
    expect(link).not.toHaveAttribute("aria-current", "page");
  });
});
