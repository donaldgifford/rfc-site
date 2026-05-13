import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider, useSearchParams } from "react-router";

import { DirectoryToolbar } from "./DirectoryToolbar";

/**
 * Renders the toolbar inside a memory router so `useSearchParams`
 * reads from / writes to the test URL. The router also renders a
 * sibling element that surfaces the current search string so we can
 * assert on URL state changes.
 */
function renderToolbar({
  initialUrl = "/",
  totalCount = 8,
  totalUnfiltered,
}: {
  initialUrl?: string;
  totalCount?: number;
  totalUnfiltered?: number;
} = {}) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <>
            <DirectoryToolbar totalCount={totalCount} totalUnfiltered={totalUnfiltered} />
            <URLProbe />
          </>
        ),
      },
    ],
    { initialEntries: [initialUrl] },
  );
  return render(<RouterProvider router={router} />);
}

function URLProbe() {
  const [params] = useSearchParams();
  return <output data-testid="url-probe">{params.toString()}</output>;
}

function readURL(): string {
  return screen.getByTestId("url-probe").textContent;
}

describe("<DirectoryToolbar>", () => {
  it("renders the toolbar landmark with a sort select and filter dropdown", () => {
    renderToolbar();
    const toolbar = screen.getByRole("toolbar", { name: /directory filters and sort/i });
    expect(toolbar).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /sort directory/i })).toBeInTheDocument();
    // The Type dropdown summary is the trigger.
    expect(screen.getByText(/^Type$/)).toBeInTheDocument();
  });

  it("toggling a type pill appends ?filter=type:<id> and clears the cursor", async () => {
    const user = userEvent.setup();
    renderToolbar({ initialUrl: "/?cursor=opaque" });

    // The filter panel is inside a <details>; open it before
    // interacting with the pills.
    await user.click(screen.getByText(/^Type$/));
    await user.click(screen.getByTestId("directory-filter-rfc"));

    // Cursor invalidates on filter change.
    const url = readURL();
    expect(url).toContain("filter=type%3Arfc");
    expect(url).not.toContain("cursor=");
  });

  it("multi-select: clicking two type pills emits both filter values (OR within field)", async () => {
    const user = userEvent.setup();
    renderToolbar();

    await user.click(screen.getByText(/^Type$/));
    await user.click(screen.getByTestId("directory-filter-rfc"));
    await user.click(screen.getByTestId("directory-filter-adr"));

    const url = readURL();
    expect(url).toContain("filter=type%3Arfc");
    expect(url).toContain("filter=type%3Aadr");
  });

  it("clicking the All pill removes every filter param", async () => {
    const user = userEvent.setup();
    renderToolbar({ initialUrl: "/?filter=type:rfc&filter=type:adr" });

    await user.click(screen.getByText(/^Type \(2\)$/));
    await user.click(screen.getByTestId("directory-filter-all"));

    expect(readURL()).not.toContain("filter=");
  });

  it("changing sort sets ?sort= AND deletes the cursor (cursor-sort mismatch protection)", async () => {
    const user = userEvent.setup();
    renderToolbar({ initialUrl: "/?cursor=midstream" });

    const select = screen.getByRole("combobox", { name: /sort directory/i });
    await user.selectOptions(select, "updated_asc");

    const url = readURL();
    expect(url).toContain("sort=updated_asc");
    expect(url).not.toContain("cursor=");
  });

  it("changing sort back to the default omits the param entirely (clean URL)", async () => {
    const user = userEvent.setup();
    renderToolbar({ initialUrl: "/?sort=updated_asc" });

    const select = screen.getByRole("combobox", { name: /sort directory/i });
    await user.selectOptions(select, "created_desc");

    expect(readURL()).not.toContain("sort=");
  });

  it("results count renders `N of M shown` when totalUnfiltered is present", () => {
    renderToolbar({ totalCount: 2, totalUnfiltered: 8 });
    // The widget reads `<strong>2</strong> of 8 shown`. waitFor isn't
    // needed — count comes from props synchronously.
    expect(screen.getByText(/2/)).toBeInTheDocument();
    expect(screen.getByText(/of 8 shown/i)).toBeInTheDocument();
  });

  it("results count renders `N documents` when totalUnfiltered is undefined", () => {
    renderToolbar({ totalCount: 8 });
    expect(screen.getByText(/8/)).toBeInTheDocument();
    expect(screen.getByText(/^documents$/i)).toBeInTheDocument();
  });

  it("renders the initial sort selection from the URL", () => {
    renderToolbar({ initialUrl: "/?sort=id_desc" });
    const select = screen.getByRole<HTMLSelectElement>("combobox", { name: /sort directory/i });
    expect(select.value).toBe("id_desc");
  });

  it("renders the active type filters as selected pills from the URL", async () => {
    const user = userEvent.setup();
    renderToolbar({ initialUrl: "/?filter=type:rfc&filter=type:adr" });

    // Summary indicates count.
    expect(screen.getByText(/^Type \(2\)$/)).toBeInTheDocument();

    // Open the dropdown and assert pill state via aria-pressed (Badge's
    // selected prop wires through to it).
    await user.click(screen.getByText(/^Type \(2\)$/));
    expect(
      screen.getByTestId("directory-filter-rfc").querySelector("[aria-pressed]"),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByTestId("directory-filter-adr").querySelector("[aria-pressed]"),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByTestId("directory-filter-design").querySelector("[aria-pressed]"),
    ).toHaveAttribute("aria-pressed", "false");
  });
});
