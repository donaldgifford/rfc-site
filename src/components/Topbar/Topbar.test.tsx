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
  it("renders the 3-element brand composite (mark + name + sub) on /", () => {
    renderTopbar();
    expect(screen.getByText("R")).toBeInTheDocument();
    expect(screen.getByText("rfcs")).toBeInTheDocument();
    expect(screen.getByText(/directory/)).toBeInTheDocument();
  });

  it.each([
    ["/", "R", "rfcs", /directory/],
    ["/search", "R", "rfcs", /search/],
    ["/rfc/0001", "R", "rfcs", /0001/],
    ["/api", "A", "api", /reference/],
    ["/mcp", "M", "mcps", /setup/],
  ])(
    "adapts the brand to the route: %s → %s / %s / %s",
    (initial, mark, name, subPattern) => {
      const { unmount } = renderTopbar(initial);
      expect(screen.getByText(mark)).toBeInTheDocument();
      expect(screen.getByText(name)).toBeInTheDocument();
      expect(screen.getByText(subPattern as RegExp)).toBeInTheDocument();
      unmount();
    },
  );

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

  it("renders inert placeholders for still-unbuilt routes", () => {
    renderTopbar();
    for (const label of ["Frameworks", "About"]) {
      const placeholder = screen.getByText(label);
      expect(placeholder).toHaveAttribute("aria-disabled", "true");
    }
  });

  it("renders the MCP NavLink as a real route, not a placeholder", () => {
    renderTopbar();
    const mcp = screen.getByRole("link", { name: "MCP" });
    expect(mcp).toHaveAttribute("href", "/mcp");
  });

  it("renders the API NavLink as a real route, not a placeholder", () => {
    renderTopbar();
    const api = screen.getByRole("link", { name: "API" });
    expect(api).toHaveAttribute("href", "/api");
  });

  it("binds ⌘K / Ctrl+K to open the search modal (?modal=1)", () => {
    renderTopbar("/");
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("opens the search modal when the search trigger is clicked", () => {
    renderTopbar("/");
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /search documents/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("meta-click on the search trigger uses the /search no-JS fallback", () => {
    renderTopbar("/");
    fireEvent.click(screen.getByRole("button", { name: /search documents/i }), { metaKey: true });
    // No dialog mount — RR7 navigated; we can't see /search's body here
    // because the test route is "*", but the modal should NOT have opened.
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
