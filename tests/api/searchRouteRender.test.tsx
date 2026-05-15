import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import SearchRoute, { loader } from "../../src/routes/search";
import { setupMswLifecycle } from "../utils/msw";
import { renderRoute } from "../utils/renderRoute";

setupMswLifecycle();

function mountSearch(initial = "/search") {
  return renderRoute(
    {
      path: "/search",
      Component: SearchRoute,
      loader,
    },
    [initial],
  );
}

describe("/search route render", () => {
  it("renders the heading + the no-JS fallback form when q is empty", async () => {
    mountSearch();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: /Search documents/i }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("searchbox", { name: /search/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^search$/i })).toBeInTheDocument();
    expect(screen.getByText(/Start typing above/)).toBeInTheDocument();
  });

  it("renders search results when q matches fixture content", async () => {
    mountSearch("/search?q=postgres");
    await waitFor(() => {
      // ADR-0001 matches `postgres` in the fixture corpus.
      expect(screen.getByText("ADR-0001")).toBeInTheDocument();
    });
    // Result rows are anchor wrappers — there should be at least one match link
    // pointing into the portal.
    const link = screen.getByText("ADR-0001").closest("a");
    expect(link).toHaveAttribute("href", "/adr/0001");
  });

  it("renders the empty state when q yields no matches", async () => {
    mountSearch("/search?q=zzznevermatchesanyfixturezzz");
    await waitFor(() => {
      expect(screen.getByText(/No results/)).toBeInTheDocument();
    });
  });
});
