import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import type { Document } from "../../src/portal/api/__generated__/model";
import IndexRoute, { loader } from "../../src/routes/_index";
import { server } from "./server";
import { setupMswLifecycle } from "../utils/msw";
import { renderRoute } from "../utils/renderRoute";

setupMswLifecycle();

function doc(overrides: Partial<Document>): Document {
  return {
    id: "RFC-0001",
    type: "rfc",
    title: "Default fixture",
    status: "proposed",
    authors: [{ name: "donald", handle: "donald" }],
    labels: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    source: { repo: "x/y", path: "z.md", commit: "deadbeef" },
    ...overrides,
  };
}

function mountIndex(initial = "/") {
  return renderRoute(
    {
      path: "/",
      Component: IndexRoute,
      loader,
    },
    [initial],
  );
}

describe("/ route render", () => {
  it("renders the directory hero + serif title", async () => {
    mountIndex();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: "Request for Comments" }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("/ docs / rfcs")).toBeInTheDocument();
  });

  it("renders one row per doc from the loader (default MSW handler, RFC-only)", async () => {
    mountIndex();
    // The MSW fixture corpus has 2 RFC docs. After the auto-pinned filter,
    // both come through.
    await waitFor(() => {
      const links = screen
        .getAllByRole("link")
        .filter((el) => el.getAttribute("href")?.startsWith("/rfc/"));
      expect(links.length).toBe(2);
    });
  });

  it("renders the filter-aware empty state when filter narrows to zero", async () => {
    server.use(
      http.get("*/api/v1/docs", () =>
        HttpResponse.json([], {
          status: 200,
          headers: {
            "X-Total-Count": "0",
            "X-Total-Count-Unfiltered": "8",
          },
        }),
      ),
    );

    mountIndex();
    await waitFor(() => {
      expect(screen.getByText(/no documents match this filter/i)).toBeInTheDocument();
    });
  });

  it("renders the no-docs empty state when the corpus is empty and no filter is active", async () => {
    server.use(
      http.get("*/api/v1/docs", () =>
        HttpResponse.json([], {
          status: 200,
          headers: { "X-Total-Count": "0" },
        }),
      ),
    );

    mountIndex();
    await waitFor(() => {
      expect(screen.getByText(/no documents yet/i)).toBeInTheDocument();
    });
  });

  it("renders the results count widget with the filtered total", async () => {
    server.use(
      http.get("*/api/v1/docs", () =>
        HttpResponse.json([doc({ id: "RFC-0001" }), doc({ id: "RFC-0002", title: "Two" })], {
          status: 200,
          headers: { "X-Total-Count": "2", "X-Total-Count-Unfiltered": "8" },
        }),
      ),
    );

    mountIndex();
    await waitFor(() => {
      expect(screen.getByText("Results")).toBeInTheDocument();
    });
    // shownCount == totalCount → single number rendered
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
