import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import ApiRoute, { meta } from "../../src/routes/api";
import { renderRoute } from "../utils/renderRoute";

function mountApi(initial = "/api") {
  return renderRoute(
    {
      path: "/api",
      Component: ApiRoute,
    },
    [initial],
  );
}

describe("/api route render", () => {
  it("sets a sensible title via meta()", () => {
    // Route.MetaArgs runtime shape varies; calling with an empty object
    // is the canonical way to assert the static metadata.
    const result = meta({} as Parameters<typeof meta>[0]);
    expect(result.some((m) => "title" in m && m.title === "API — rfc-site")).toBe(true);
  });

  it("renders the API sidebar brand block from the vendored spec", async () => {
    mountApi();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2, name: "rfc-api" })).toBeInTheDocument();
    });
  });

  it("renders at least one endpoint detail by default (first endpoint in the spec)", async () => {
    mountApi();
    await waitFor(() => {
      // The first endpoint in `api/openapi.yaml` is `GET /api/v1/types`.
      // That title doesn't appear elsewhere, so we can match on it directly.
      expect(
        screen.getByRole("heading", { level: 1, name: /List registered document types/i }),
      ).toBeInTheDocument();
    });
  });

  it("renders multiple endpoint groups in the sidebar (docs / search / etc.)", async () => {
    mountApi();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 3, name: "docs" })).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { level: 3, name: "search" })).toBeInTheDocument();
  });
});
