import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";

import Search, {
  loader as searchLoader,
  HydrateFallback,
  ErrorBoundary,
} from "../../src/routes/search";
import { setupMswLifecycle } from "../utils/msw";
import { renderRoute } from "../utils/renderRoute";

setupMswLifecycle();

const searchRouteFixture = {
  path: "/search",
  Component: Search,
  loader: searchLoader,
  HydrateFallback,
  ErrorBoundary,
} as const;

describe("/search route — full render", () => {
  it("renders the prompt state when no q is provided", async () => {
    renderRoute(searchRouteFixture, ["/search"]);
    await waitFor(() => {
      expect(screen.getByRole("search")).toBeInTheDocument();
    });
    expect(screen.getByText(/Enter a query/i)).toBeInTheDocument();
  });

  it("renders results from the seeded MSW corpus and links each title to the portal route (URL form)", async () => {
    renderRoute(searchRouteFixture, ["/search?q=postgres"]);

    await waitFor(() => {
      // ADR-0001 fixture mentions postgres — assert the heading link exists.
      expect(screen.getByRole("heading", { level: 2, name: /Postgres/i })).toBeInTheDocument();
    });

    // The hit's link uses the URL form (`/adr/0001`), NOT the canonical
    // form (`/ADR-0001`) — see CLAUDE.md §Hard rules.
    const link = screen.getByRole("link", { name: /Postgres/i });
    expect(link.getAttribute("href")).toMatch(/^\/adr\/0001/);
  });

  it("renders the synthesised <em>postgres</em> snippet from the MSW handler", async () => {
    const { container } = renderRoute(searchRouteFixture, ["/search?q=postgres"]);
    await waitFor(() => {
      expect(container.querySelector(".snippet em")).not.toBeNull();
    });
    expect(container.querySelector(".snippet em")?.textContent).toBe("postgres");
  });

  it("renders the no-results state when the query has zero matches", async () => {
    renderRoute(searchRouteFixture, ["/search?q=zzznonsense"]);
    await waitFor(() => {
      expect(screen.getByText(/No results for/i)).toBeInTheDocument();
    });
  });
});
