import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { RFCPreviewCard } from "./RFCPreviewCard";
import { handlers } from "../../../portal/api/msw/handlers";

const server = setupServer(...handlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "warn" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

function renderTrigger(
  ui: React.ReactElement,
  { triggerText = "Open" }: { triggerText?: string } = {},
): { client: QueryClient } {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  // Smoke check the trigger is mounted.
  expect(screen.getByText(triggerText)).toBeInTheDocument();
  return { client };
}

describe("<RFCPreviewCard>", () => {
  it("does not render the popover until the trigger is hovered or focused", () => {
    renderTrigger(
      <RFCPreviewCard type="rfc" id="0001" openDelay={0}>
        <a href="/rfc/0001">Open</a>
      </RFCPreviewCard>,
    );
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("opens the popover on hover and fetches the target metadata", async () => {
    const user = userEvent.setup();
    renderTrigger(
      <RFCPreviewCard type="rfc" id="0001" openDelay={0}>
        <a href="/rfc/0001">Open</a>
      </RFCPreviewCard>,
    );

    await user.hover(screen.getByText("Open"));

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });
    // Popover ends in a Loading state, then resolves to the fixture
    // metadata once MSW responds.
    await waitFor(() => {
      // Either fixture title or fallback id rendered.
      const tooltip = screen.getByRole("tooltip");
      expect(tooltip.textContent).toMatch(/RFC-0001|portal|MSW/i);
    });
  });

  it("closes the popover when the pointer leaves the trigger", async () => {
    const user = userEvent.setup();
    renderTrigger(
      <RFCPreviewCard type="rfc" id="0001" openDelay={0}>
        <a href="/rfc/0001">Open</a>
      </RFCPreviewCard>,
    );

    await user.hover(screen.getByText("Open"));
    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });

    await user.unhover(screen.getByText("Open"));
    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).toBeNull();
    });
  });

  it("closes the popover on Escape", async () => {
    const user = userEvent.setup();
    renderTrigger(
      <RFCPreviewCard type="rfc" id="0001" openDelay={0}>
        <a href="/rfc/0001">Open</a>
      </RFCPreviewCard>,
    );

    await user.hover(screen.getByText("Open"));
    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).toBeNull();
    });
  });

  it("renders an inert error surface when the target is not found", async () => {
    server.use(
      http.get("*/api/v1/rfc/9999", () =>
        HttpResponse.json(
          {
            // The classifyProblem helper parses the tail of `type` —
            // sentinel matching only fires when the URL tail equals
            // "not-found" (or one of the other registered sentinels).
            type: "https://rfc-api.example/problems/not-found",
            title: "Not Found",
            status: 404,
            detail: "no such document",
            request_id: "test-1",
          },
          { status: 404, headers: { "content-type": "application/problem+json" } },
        ),
      ),
    );

    const user = userEvent.setup();
    renderTrigger(
      <RFCPreviewCard type="rfc" id="9999" openDelay={0}>
        <a href="/rfc/9999">Open</a>
      </RFCPreviewCard>,
    );

    await user.hover(screen.getByText("Open"));

    await waitFor(() => {
      expect(screen.getByText(/not found/i)).toBeInTheDocument();
    });
  });
});
