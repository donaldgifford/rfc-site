import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import IndexRoute, { loader as indexLoader, HydrateFallback } from "../../src/routes/_index";
import { server } from "./server";
import { setupMswLifecycle } from "../utils/msw";
import { renderRoute } from "../utils/renderRoute";

setupMswLifecycle();

const indexFixture = {
  path: "/",
  Component: IndexRoute,
  loader: indexLoader,
  HydrateFallback,
} as const;

/**
 * Full-route integration test: mounts `_index` via `createRoutesStub`
 * (RR7's purpose-built test harness) so the loader runs against the
 * shared fixture-backed MSW handlers (IMPL-0002 Phase 4) and the
 * rendered card grid is exercised end-to-end. Catches regressions in
 * the JSX wiring, Badge integration, DocCard linking, and pagination
 * link generation that loader-only tests miss.
 */
describe("/ index route — full render", () => {
  it("renders a card per fixture with id, title, and humanised Badge", async () => {
    renderRoute(indexFixture, ["/"]);

    await waitFor(() => {
      expect(screen.getByText("Use PostgreSQL for primary storage")).toBeInTheDocument();
    });

    // Spot-check several fixtures from across the type tree.
    expect(screen.getByText("ADR-0001")).toBeInTheDocument();
    expect(screen.getByText("RFC-0001")).toBeInTheDocument();
    expect(screen.getByText("Adopt MSW-backed dev mode for the portal")).toBeInTheDocument();
    // Badges humanise statuses: "accepted" → "Accepted", "proposed" → "Proposed", "draft" → "Draft".
    expect(screen.getAllByText("Accepted").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Proposed").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Draft").length).toBeGreaterThanOrEqual(1);
    // Card links target /$type/$id:
    expect(
      screen.getByRole("link", { name: "Use PostgreSQL for primary storage" }),
    ).toHaveAttribute("href", "/adr/ADR-0001");
  });

  it("emits prev/next pagination links from the Link header cursors", async () => {
    // The fixture handler only emits `rel="next"` — override so we
    // exercise both cursor states in a single render.
    server.use(
      http.get("*/api/v1/docs", () =>
        HttpResponse.json(
          [
            {
              id: "RFC-0001",
              type: "rfc",
              title: "Pagination probe",
              status: "accepted",
              created_at: "2026-04-20T00:00:00Z",
              updated_at: "2026-04-20T00:00:00Z",
              source: { repo: "donaldgifford/rfc-site", path: "fixtures/rfc/0001.md" },
            },
          ],
          {
            status: 200,
            headers: {
              link: '</api/v1/docs?cursor=NEXT&limit=24>; rel="next", </api/v1/docs?cursor=PREV&limit=24>; rel="prev"',
            },
          },
        ),
      ),
    );

    renderRoute(indexFixture, ["/"]);

    await waitFor(() => {
      expect(screen.getByText("Pagination probe")).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: /previous/i })).toHaveAttribute(
      "href",
      "/?cursor=PREV",
    );
    expect(screen.getByRole("link", { name: /next/i })).toHaveAttribute("href", "/?cursor=NEXT");
  });

  it("renders the empty-state message when listDocs returns no docs", async () => {
    server.use(http.get("*/api/v1/docs", () => HttpResponse.json([], { status: 200 })));

    renderRoute(indexFixture, ["/"]);

    await waitFor(() => {
      expect(screen.getByText(/no documents yet/i)).toBeInTheDocument();
    });
  });
});
