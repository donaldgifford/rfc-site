import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub, type LoaderFunction } from "react-router";
import DocPage, {
  loader as docLoader,
  HydrateFallback,
  ErrorBoundary,
} from "../../src/routes/$type.$id";
import { fixtureDoc, mockGetDoc, mockProblem, server } from "./server";

// RR7's Route.LoaderArgs narrows `params` to the route's pattern; the
// stub uses a generic `Params<string>`. The runtime contract matches —
// cast to satisfy the stub typing.
const stubLoader = docLoader as unknown as LoaderFunction;

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

/**
 * Full-route integration test: mounts `$type.$id` via `createRoutesStub`
 * so the loader runs against MSW and the rendered component DOM is
 * exercised end-to-end. Pairs with `tests/api/docPage.test.ts` (loader-
 * only) — the loader test covers control flow + error throwing; this
 * one covers the actual rendered output.
 */
describe("/$type/$id route — full render", () => {
  it("renders title, Badge (md), id, body, and authors line", async () => {
    mockGetDoc({
      ...fixtureDoc,
      id: "RFC-0042",
      title: "Adopt new test harness",
      status: "Proposed",
      authors: [
        { name: "Donald Gifford", handle: "donaldgifford" },
        { name: "Test Bot", handle: "tb" },
      ],
      body: "## Decision\n\nUse createRoutesStub.",
    });

    const Stub = createRoutesStub([
      {
        path: "/:type/:id",
        Component: DocPage,
        loader: stubLoader,
        HydrateFallback,
        ErrorBoundary,
      },
    ]);
    render(<Stub initialEntries={["/rfc/RFC-0042"]} />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: "Adopt new test harness" }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Proposed")).toBeInTheDocument();
    // "RFC-0042" appears in both the breadcrumb and the dateline — assert ≥1.
    expect(screen.getAllByText(/RFC-0042/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Donald Gifford, Test Bot/)).toBeInTheDocument();
    expect(screen.getByText(/Use createRoutesStub\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /directory/i })).toHaveAttribute("href", "/");
  });

  it("renders the not-found surface when getDoc returns ErrNotFound", async () => {
    mockProblem("getDoc", 404, {
      type: "/problems/not-found",
      title: "Resource not found",
      status: 404,
      detail: "rfc RFC-9999 not found",
      request_id: "01HTZ-INTEGRATION",
    });

    const Stub = createRoutesStub([
      {
        path: "/:type/:id",
        Component: DocPage,
        loader: stubLoader,
        HydrateFallback,
        ErrorBoundary,
      },
    ]);
    render(<Stub initialEntries={["/rfc/RFC-9999"]} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /document not found/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/rfc RFC-9999 not found/i)).toBeInTheDocument();
    expect(screen.getByText("01HTZ-INTEGRATION")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to the directory/i })).toBeInTheDocument();
  });

  it("renders the generic error surface (with request_id) for non-404 problems", async () => {
    mockProblem("getDoc", 500, {
      type: "/problems/internal",
      title: "Internal server error",
      status: 500,
      request_id: "01HTZ-INTEGRATION-500",
    });

    const Stub = createRoutesStub([
      {
        path: "/:type/:id",
        Component: DocPage,
        loader: stubLoader,
        HydrateFallback,
        ErrorBoundary,
      },
    ]);
    render(<Stub initialEntries={["/rfc/RFC-0001"]} />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /500 — internal server error/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("01HTZ-INTEGRATION-500")).toBeInTheDocument();
  });
});
