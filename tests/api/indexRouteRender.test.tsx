import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import IndexRoute, { loader as indexLoader, HydrateFallback } from "../../src/routes/_index";
import { fixtureDoc, mockListDocs } from "./server";
import { setupMswLifecycle } from "../utils/msw";
import { renderRoute } from "../utils/renderRoute";
import type { Document } from "../../src/portal/api/__generated__/model";

setupMswLifecycle();

const indexFixture = {
  path: "/",
  Component: IndexRoute,
  loader: indexLoader,
  HydrateFallback,
} as const;

/**
 * Full-route integration test: mounts `_index` via `createRoutesStub`
 * (RR7's purpose-built test harness) so the loader runs against MSW
 * and the rendered component DOM is exercised end-to-end. Catches
 * regressions in the JSX wiring, Badge integration, DocCard linking,
 * and pagination link generation that loader-only tests miss.
 */
describe("/ index route — full render", () => {
  it("renders cards for each Document with id, title, and Badge", async () => {
    const docs: Document[] = [
      { ...fixtureDoc, id: "RFC-0001", title: "First doc", status: "Accepted" },
      { ...fixtureDoc, id: "RFC-0002", title: "Second doc", status: "Draft", type: "rfc" },
    ];
    mockListDocs(docs);

    renderRoute(indexFixture, ["/"]);

    await waitFor(() => {
      expect(screen.getByText("First doc")).toBeInTheDocument();
    });

    expect(screen.getByText("Second doc")).toBeInTheDocument();
    expect(screen.getByText("RFC-0001")).toBeInTheDocument();
    expect(screen.getByText("RFC-0002")).toBeInTheDocument();
    // Badges render with humanised labels:
    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    // Card links target /$type/$id:
    expect(screen.getByRole("link", { name: "First doc" })).toHaveAttribute(
      "href",
      "/rfc/RFC-0001",
    );
  });

  it("emits prev/next pagination links from the Link header cursors", async () => {
    mockListDocs([fixtureDoc], {
      link: '</api/v1/docs?cursor=NEXT&limit=24>; rel="next", </api/v1/docs?cursor=PREV&limit=24>; rel="prev"',
    });

    renderRoute(indexFixture, ["/"]);

    await waitFor(() => {
      expect(screen.getByText("Adopt portal frontend stack")).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: /previous/i })).toHaveAttribute(
      "href",
      "/?cursor=PREV",
    );
    expect(screen.getByRole("link", { name: /next/i })).toHaveAttribute("href", "/?cursor=NEXT");
  });

  it("renders the empty-state message when listDocs returns no docs", async () => {
    mockListDocs([]);

    renderRoute(indexFixture, ["/"]);

    await waitFor(() => {
      expect(screen.getByText(/no documents yet/i)).toBeInTheDocument();
    });
  });
});
