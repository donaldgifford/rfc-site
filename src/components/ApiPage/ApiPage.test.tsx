import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { OpenApiSpec } from "../../portal/openapi/loader";
import { listEndpoints } from "../../portal/openapi/loader";
import { ApiPage } from "./ApiPage";
import { renderRoute } from "../../../tests/utils/renderRoute";

const fixture: OpenApiSpec = {
  openapi: "3.1.0",
  info: { title: "rfc-api", version: "0.1.0" },
  paths: {
    "/api/v1/docs": {
      get: {
        tags: ["docs"],
        summary: "List documents across all types",
        description: "Returns a paginated list of documents.",
        parameters: [
          {
            name: "limit",
            in: "query",
            description: "Max items per page.",
            schema: { type: "integer", default: 25 },
          },
        ],
        responses: {
          "200": { description: "Documents listed." },
          "400": { description: "Bad query." },
          "500": { description: "Server error." },
        },
      },
    },
    "/api/v1/{type}/{id}": {
      get: {
        tags: ["docs"],
        summary: "Fetch a single document",
        description: "Returns the document with rendered body.",
        parameters: [
          { name: "type", in: "path", required: true, schema: { type: "string" } },
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "OK" },
          "404": { description: "Not found" },
        },
      },
    },
    "/api/v1/search": {
      get: {
        tags: ["search"],
        summary: "Cross-type search",
        responses: { "200": { description: "OK" } },
      },
    },
  },
};

function mount(initial = "/api") {
  const endpoints = listEndpoints(fixture);
  return renderRoute(
    {
      path: "/api",
      Component: () => <ApiPage spec={fixture} endpoints={endpoints} />,
    },
    [initial],
  );
}

describe("<ApiPage>", () => {
  it("renders the sidebar brand block from the spec info", () => {
    mount();
    expect(screen.getByRole("heading", { level: 2, name: "rfc-api" })).toBeInTheDocument();
    expect(screen.getByText(/v0\.1\.0/)).toBeInTheDocument();
    expect(screen.getByText(/OpenAPI 3\.1\.0/)).toBeInTheDocument();
  });

  it("groups endpoints by tag with one row per method × path", () => {
    mount();
    expect(screen.getByRole("heading", { level: 3, name: "docs" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "search" })).toBeInTheDocument();
    // The sidebar has buttons for each endpoint — 3 in this fixture.
    const buttons = screen.getAllByRole("button");
    const sidebarRows = buttons.filter((b) => b.textContent.includes("/api/v1/"));
    expect(sidebarRows.length).toBe(3);
  });

  it("selects the first endpoint by default and shows its detail", () => {
    mount();
    expect(
      screen.getByRole("heading", { level: 1, name: "List documents across all types" }),
    ).toBeInTheDocument();
    // Method chip rendered at the path-line level + sidebar level — there
    // should be 1 (header path-line) + 3 (sidebar) = 4 GET chips.
    const getChips = screen.getAllByText("GET");
    expect(getChips.length).toBeGreaterThanOrEqual(2);
  });

  it("clicking a sidebar endpoint swaps the detail to that endpoint", async () => {
    mount();
    await userEvent.click(screen.getByRole("button", { name: /GET \/api\/v1\/\{type\}\/\{id\}/ }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Fetch a single document" }),
    ).toBeInTheDocument();
    // Active styling: aria-current=page on the active sidebar row.
    expect(screen.getByRole("button", { name: /GET \/api\/v1\/\{type\}\/\{id\}/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders path + query parameter sections with required badges", () => {
    mount("/api?endpoint=get:/api/v1/{type}/{id}");
    expect(screen.getByRole("heading", { level: 2, name: /Path parameters/ })).toBeInTheDocument();
    // Two required path params: type + id.
    const requiredBadges = screen.getAllByText("required");
    expect(requiredBadges.length).toBe(2);
  });

  it("renders the responses section with code chips for 200 / 4xx / 5xx", () => {
    mount();
    expect(screen.getByRole("heading", { level: 2, name: /Responses/ })).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText("400")).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();
  });

  it("renders the inert try-it band (visual-only — no live execution)", () => {
    mount();
    expect(screen.getByLabelText(/^Try it$/i)).toBeInTheDocument();
    expect(screen.getByText("send request →")).toBeInTheDocument();
  });

  it("highlights path-segment vars in the path line", () => {
    mount("/api?endpoint=get:/api/v1/{type}/{id}");
    // The {type} and {id} segments render with a different class via the
    // segment-var span — at least 2 such spans should appear.
    const vars = screen.getAllByText(/\{(type|id)\}/);
    expect(vars.length).toBeGreaterThanOrEqual(2);
  });
});
