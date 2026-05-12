import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { setupServer } from "msw/node";

import { SearchModal } from "./SearchModal";
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

function Host({ initialOpen = true }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        open
      </button>
      <SearchModal open={open} onOpenChange={setOpen} />
    </>
  );
}

function renderModal({ initialOpen = true }: { initialOpen?: boolean } = {}) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <Host initialOpen={initialOpen} />,
      },
      {
        path: "/:type/:id",
        element: <div>doc page</div>,
      },
    ],
    { initialEntries: ["/"] },
  );
  return render(<RouterProvider router={router} />);
}

describe("<SearchModal>", () => {
  it("does not render anything when open=false", () => {
    renderModal({ initialOpen: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders a labelled dialog with the search input focused on open", async () => {
    renderModal({ initialOpen: true });

    const dialog = screen.getByRole("dialog", { name: /search documents/i });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");

    const input = screen.getByRole("searchbox", { name: /search query/i });
    await waitFor(() => {
      expect(input).toHaveFocus();
    });
  });

  it("submits a query on Enter and renders SearchResult hits from MSW", async () => {
    const user = userEvent.setup();
    renderModal({ initialOpen: true });

    const input = screen.getByRole("searchbox", { name: /search query/i });
    await user.type(input, "portal");
    await user.keyboard("{Enter}");

    // MSW fixtures include "Adopt MSW-backed dev mode for the portal" — surface
    // in the modal. The title appears twice (link text + emphasised snippet)
    // so we assert >= 1 rather than exactly 1.
    await waitFor(() => {
      expect(screen.getAllByText(/Adopt MSW-backed dev mode/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("Escape closes the modal", async () => {
    const user = userEvent.setup();
    renderModal({ initialOpen: true });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("backdrop click closes the modal", async () => {
    const user = userEvent.setup();
    renderModal({ initialOpen: true });

    // The backdrop button has aria-label "Close search"; the inline close
    // button has aria-label "Close search dialog" — querying by the
    // exact backdrop label disambiguates.
    const backdrop = screen.getByRole("button", { name: "Close search" });
    await user.click(backdrop);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("Close button dismisses the modal", async () => {
    const user = userEvent.setup();
    renderModal({ initialOpen: true });

    const closeButton = screen.getByRole("button", { name: /close search dialog/i });
    await user.click(closeButton);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("renders the empty prompt when the query is blank", () => {
    renderModal({ initialOpen: true });
    expect(screen.getByText(/type a query and press/i)).toBeInTheDocument();
  });
});
