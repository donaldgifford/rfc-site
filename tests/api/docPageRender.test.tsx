import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import DocPage, {
  loader as docLoader,
  HydrateFallback,
  ErrorBoundary,
} from "../../src/routes/$type.$id";
import { mockProblem } from "./server";
import { setupMswLifecycle } from "../utils/msw";
import { renderRoute } from "../utils/renderRoute";

setupMswLifecycle();

const docPageFixture = {
  path: "/:type/:id",
  Component: DocPage,
  loader: docLoader,
  HydrateFallback,
  ErrorBoundary,
} as const;

/**
 * Full-route integration test: mounts `$type.$id` via `createRoutesStub`
 * so the loader runs against the shared fixture-backed MSW handlers
 * (IMPL-0002 Phase 4). The happy path asserts against the canonical
 * RFC-0001 fixture (`tests/examples/docs/rfc/0001-adopt-msw-dev-mode.md`).
 *
 * Pairs with `tests/api/docPage.test.ts` (loader-only) — the loader
 * test covers control flow + error throwing; this one covers the
 * actual rendered output.
 */
describe("/$type/$id route — full render", () => {
  it("renders title, Badge (md), id, body, and authors line", async () => {
    renderRoute(docPageFixture, ["/rfc/0001"]);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          level: 1,
          name: "Adopt MSW-backed dev mode for the portal",
        }),
      ).toBeInTheDocument();
    });

    // Status humanises "proposed" → "Proposed" in the Badge label.
    expect(screen.getByText("Proposed")).toBeInTheDocument();
    // "RFC-0001" appears in both the breadcrumb and the dateline — assert ≥1.
    expect(screen.getAllByText(/RFC-0001/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Sam Author, Riley Reviewer/)).toBeInTheDocument();
    // A distinctive substring from the fixture body.
    expect(screen.getByText(/Iterating on the portal currently/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /directory/i })).toHaveAttribute("href", "/");
  });

  it("renders the not-found surface when getDoc returns ErrNotFound", async () => {
    mockProblem("*/api/v1/:type/:id", 404, {
      type: "/problems/not-found",
      title: "Resource not found",
      status: 404,
      detail: "rfc RFC-9999 not found",
      request_id: "01HTZ-INTEGRATION",
    });

    renderRoute(docPageFixture, ["/rfc/9999"]);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /document not found/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/rfc RFC-9999 not found/i)).toBeInTheDocument();
    expect(screen.getByText("01HTZ-INTEGRATION")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to the directory/i })).toBeInTheDocument();
  });

  it("renders the generic error surface (with request_id) for non-404 problems", async () => {
    mockProblem("*/api/v1/:type/:id", 500, {
      type: "/problems/internal",
      title: "Internal server error",
      status: 500,
      request_id: "01HTZ-INTEGRATION-500",
    });

    renderRoute(docPageFixture, ["/rfc/0001"]);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /500 — internal server error/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("01HTZ-INTEGRATION-500")).toBeInTheDocument();
  });
});
