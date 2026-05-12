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

  it("renders type filter pills (All + one per DocumentType) with All selected by default", () => {
    renderModal({ initialOpen: true });

    // The toolbar should expose All + the 6 portal-supported types.
    const toolbar = screen.getByRole("toolbar", { name: /filter results by document type/i });
    expect(toolbar).toBeInTheDocument();

    expect(screen.getByTestId("filter-all")).toHaveTextContent(/all/i);
    for (const type of ["rfc", "adr", "design", "impl", "plan", "inv"]) {
      expect(screen.getByTestId(`filter-${type}`)).toBeInTheDocument();
    }

    // All-pill is the only selected one initially — its inner Badge
    // carries aria-pressed="true" while the per-type pills are false.
    expect(screen.getByTestId("filter-all").querySelector("[aria-pressed]")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("filter-rfc").querySelector("[aria-pressed]")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("filters visible results when a type pill is selected", async () => {
    const user = userEvent.setup();
    renderModal({ initialOpen: true });

    // Submit a broad query so we get a multi-type result set from MSW.
    const input = screen.getByRole("searchbox", { name: /search query/i });
    await user.type(input, "the");
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(screen.queryByText(/searching/i)).toBeNull();
    });

    // Activate the IMPL filter — the All pill should deselect, IMPL
    // should announce as pressed.
    await user.click(screen.getByTestId("filter-impl"));

    await waitFor(() => {
      expect(screen.getByTestId("filter-impl").querySelector("[aria-pressed]")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByTestId("filter-all").querySelector("[aria-pressed]")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });

    // Every visible hit's id should start with IMPL- now. The
    // results list re-renders so the assertion is wrapped in waitFor.
    await waitFor(() => {
      const ids = screen.getAllByText(/^[A-Z]+-\d+$/).map((node) => node.textContent);
      expect(ids.length).toBeGreaterThan(0);
      expect(ids.every((id) => id.startsWith("IMPL-"))).toBe(true);
    });
  });

  it("groups hits by document.type with a sticky heading per non-empty bucket", async () => {
    const user = userEvent.setup();
    renderModal({ initialOpen: true });

    const input = screen.getByRole("searchbox", { name: /search query/i });
    await user.type(input, "the");
    await user.keyboard("{Enter}");

    // Wait for the group headings to render — at least the IMPL bucket
    // is non-empty because the impl fixtures match "the".
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /impl/i, level: 3 })).toBeInTheDocument();
    });

    // The group is announced as a section with aria-labelledby pointing
    // at the heading; data-group-type pins the type on the wrapping
    // <section> so the test can assert on it.
    const implHeading = screen.getByRole("heading", { name: /impl/i, level: 3 });
    const implSection = implHeading.closest("section");
    expect(implSection).not.toBeNull();
    expect(implSection).toHaveAttribute("data-group-type", "impl");
  });

  it("clicking the All pill clears active type filters", async () => {
    const user = userEvent.setup();
    renderModal({ initialOpen: true });

    const input = screen.getByRole("searchbox", { name: /search query/i });
    await user.type(input, "the");
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(screen.queryByText(/searching/i)).toBeNull();
    });

    // Narrow then widen.
    await user.click(screen.getByTestId("filter-rfc"));
    await waitFor(() => {
      expect(screen.getByTestId("filter-rfc").querySelector("[aria-pressed]")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
    await user.click(screen.getByTestId("filter-all"));
    await waitFor(() => {
      expect(screen.getByTestId("filter-rfc").querySelector("[aria-pressed]")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      expect(screen.getByTestId("filter-all").querySelector("[aria-pressed]")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
  });
});
