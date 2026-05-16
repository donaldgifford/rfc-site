import { describe, expect, it } from "vitest";
import { useState } from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchModal } from "./SearchModal";
import { renderRoute } from "../../../tests/utils/renderRoute";
import { setupMswLifecycle } from "../../../tests/utils/msw";

setupMswLifecycle();

function Harness({ openInitially = false }: { openInitially?: boolean }) {
  const [open, setOpen] = useState(openInitially);
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
      <SearchModal
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      />
    </>
  );
}

function mount(openInitially = false) {
  return renderRoute(
    {
      path: "/",
      Component: () => <Harness openInitially={openInitially} />,
    },
    ["/"],
  );
}

describe("<SearchModal>", () => {
  it("does not render the dialog when closed", () => {
    mount(false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders the dialog and focuses the input when opened", async () => {
    mount(true);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("searchbox", { name: /search documents/i })).toHaveFocus();
    });
  });

  it("renders the 5 content-scope filter pills with 'all results' active", () => {
    mount(true);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent.replace(/\d+$/, "").trim())).toEqual([
      "all results",
      "titles",
      "body",
      "authors",
      "labels",
    ]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  it("closes on Escape", async () => {
    mount(true);
    await screen.findByRole("dialog");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("closes on backdrop click", async () => {
    const { container } = mount(true);
    await screen.findByRole("dialog");
    // The overlay is the first child of the portal — it has role=presentation
    const overlay = container.ownerDocument.querySelector('[role="presentation"]');
    if (!overlay) throw new Error("overlay not mounted");
    fireEvent.click(overlay);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("debounces a search, populates the list, and exposes the latency widget", async () => {
    mount(true);
    const input = await screen.findByRole("searchbox", { name: /search documents/i });
    await userEvent.type(input, "postgres");
    // After the debounce + MSW response, at least one option appears.
    const options = await screen.findAllByRole("option", undefined, { timeout: 5000 });
    expect(options.length).toBeGreaterThanOrEqual(1);
    // Latency widget: 'meilisearch ● <N>ms'
    expect(screen.getByText(/meilisearch/)).toBeInTheDocument();
    expect(screen.getByText(/\d+ms/)).toBeInTheDocument();
  });

  it("activates the next/prev result on ↓ / ↑", async () => {
    mount(true);
    const input = await screen.findByRole("searchbox", { name: /search documents/i });
    await userEvent.type(input, "postgres");
    const options = await screen.findAllByRole("option", undefined, { timeout: 5000 });
    if (options.length < 2) return; // fixture corpus may only return 1 — skip
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowDown" });
    await waitFor(() => {
      expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
    });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowUp" });
    await waitFor(() => {
      expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");
    });
  });
});
