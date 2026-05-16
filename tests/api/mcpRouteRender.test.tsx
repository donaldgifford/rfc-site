import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import McpRoute from "../../src/routes/mcp";
import { renderRoute } from "../utils/renderRoute";

function mountMcp() {
  return renderRoute(
    {
      path: "/mcp",
      Component: McpRoute,
    },
    ["/mcp"],
  );
}

describe("/mcp route render", () => {
  it("renders the hero + h1 from the McpPage", async () => {
    mountMcp();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: /pull rfcs directly/i }),
      ).toBeInTheDocument();
    });
  });

  it("renders the 4 numbered setup-step headings", async () => {
    mountMcp();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 2, name: /Install the server/ }),
      ).toBeInTheDocument();
    });
    for (const label of [
      /Install the server/,
      /Configure your client/,
      /Available tools/,
      /Verify it works/,
    ]) {
      expect(screen.getByRole("heading", { level: 2, name: label })).toBeInTheDocument();
    }
  });
});
