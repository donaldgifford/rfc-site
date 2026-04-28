import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { RouteErrorBoundary } from "./RouteErrorBoundary";

function renderWithThrow(payload: unknown, status: number): void {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        loader: () => {
          // Intentional: RR7's documented escape hatch for surfacing
          // problem+json from a loader to the ErrorBoundary.
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw new Response(JSON.stringify(payload), {
            status,
            headers: { "content-type": "application/problem+json" },
          });
        },
        Component: () => <p>should not render</p>,
        ErrorBoundary: RouteErrorBoundary,
      },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
}

describe("<RouteErrorBoundary>", () => {
  it("renders the not-found surface for ErrNotFound (404 + /problems/not-found)", async () => {
    renderWithThrow(
      {
        type: "/problems/not-found",
        title: "Resource not found",
        status: 404,
        detail: "rfc RFC-9999 not found",
        request_id: "01HTZ-NOT-FOUND",
      },
      404,
    );

    expect(await screen.findByRole("heading", { name: /document not found/i })).toBeInTheDocument();
    expect(screen.getByText(/rfc RFC-9999 not found/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to the directory/i })).toBeInTheDocument();
    expect(screen.getByText("01HTZ-NOT-FOUND")).toBeInTheDocument();
  });

  it("surfaces request_id on the generic error surface for non-404 problems", async () => {
    renderWithThrow(
      {
        type: "/problems/internal",
        title: "Internal server error",
        status: 500,
        request_id: "01HTZ-INTERNAL",
      },
      500,
    );

    expect(
      await screen.findByRole("heading", { name: /500 — internal server error/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("01HTZ-INTERNAL")).toBeInTheDocument();
  });
});
