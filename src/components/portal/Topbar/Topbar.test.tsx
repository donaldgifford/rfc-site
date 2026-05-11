import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";

import { Topbar } from "./Topbar";

function renderTopbar({ initialPath = "/" }: { initialPath?: string } = {}) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <Topbar />,
      },
      {
        path: "/search",
        element: (
          <>
            <Topbar />
            <div>Search page</div>
          </>
        ),
      },
    ],
    { initialEntries: [initialPath] },
  );

  return render(<RouterProvider router={router} />);
}

describe("<Topbar>", () => {
  it("renders the brand link pointing at /", () => {
    renderTopbar();
    const brand = screen.getByRole("link", { name: /rfc-site/i });
    expect(brand).toHaveAttribute("href", "/");
  });

  it("renders the search trigger linking to /search with the ⌘K hint", () => {
    renderTopbar();
    const trigger = screen.getByRole("link", { name: /search documents/i });
    expect(trigger).toHaveAttribute("href", "/search");
    // The trigger composes <Input suffix={<Kbd>⌘K</Kbd>}>; the Kbd
    // surface should be present and the input read-only.
    expect(screen.getByText("⌘K")).toBeInTheDocument();
  });

  it("renders the placeholder nav entries as inert (aria-disabled) spans", () => {
    renderTopbar();
    for (const label of ["API", "MCP", "Frameworks"]) {
      const node = screen.getByText(label);
      expect(node).toHaveAttribute("aria-disabled", "true");
      expect(node.tagName).toBe("SPAN");
    }
  });

  it("includes the <ThemeToggle> in the right slot", () => {
    renderTopbar();
    // ThemeToggle exposes role="button" with an accessible name about
    // theme switching — assert it's present.
    const toggle = screen.getByRole("button", { name: /theme/i });
    expect(toggle).toBeInTheDocument();
  });

  it("⌘K navigates to /search", async () => {
    const user = userEvent.setup();
    renderTopbar({ initialPath: "/" });

    expect(screen.queryByText(/search page/i)).not.toBeInTheDocument();
    await user.keyboard("{Meta>}k{/Meta}");
    expect(await screen.findByText(/search page/i)).toBeInTheDocument();
  });

  it("⌘K does NOT trigger when the focus is inside an input (so users mid-typing aren't ambushed)", async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: (
            <>
              <Topbar />
              <input data-testid="external" defaultValue="" />
            </>
          ),
        },
        { path: "/search", element: <div>Search page</div> },
      ],
      { initialEntries: ["/"] },
    );

    render(<RouterProvider router={router} />);
    const external = screen.getByTestId<HTMLInputElement>("external");
    await user.click(external);
    await user.keyboard("{Meta>}k{/Meta}");
    // We should NOT have navigated.
    expect(screen.queryByText(/search page/i)).not.toBeInTheDocument();
  });
});
