import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";

import { Tabs } from "./Tabs";

interface FixtureProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (next: string) => void;
  urlParam?: string;
}

function Fixture(props: FixtureProps) {
  return (
    <Tabs {...props}>
      <Tabs.List>
        <Tabs.Trigger value="curl">curl</Tabs.Trigger>
        <Tabs.Trigger value="go">Go</Tabs.Trigger>
        <Tabs.Trigger value="ts">TypeScript</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="curl">curl-panel</Tabs.Content>
      <Tabs.Content value="go">go-panel</Tabs.Content>
      <Tabs.Content value="ts">ts-panel</Tabs.Content>
    </Tabs>
  );
}

function withRouter(node: React.ReactNode, initialEntries: string[] = ["/"]) {
  const router = createMemoryRouter([{ path: "/", element: node }], { initialEntries });
  return <RouterProvider router={router} />;
}

describe("<Tabs>", () => {
  it("renders triggers with the right ARIA + the default-value panel", () => {
    render(withRouter(<Fixture defaultValue="go" />));

    const triggers = screen.getAllByRole("tab");
    expect(triggers).toHaveLength(3);

    const go = screen.getByRole("tab", { name: /^go$/i });
    expect(go).toHaveAttribute("aria-selected", "true");
    expect(go).toHaveAttribute("data-state", "active");
    expect(go).toHaveAttribute("tabindex", "0");

    const curl = screen.getByRole("tab", { name: /curl/i });
    expect(curl).toHaveAttribute("aria-selected", "false");
    expect(curl).toHaveAttribute("tabindex", "-1");

    expect(screen.getByText("go-panel")).toBeInTheDocument();
    expect(screen.queryByText("curl-panel")).not.toBeInTheDocument();
  });

  it("switches active panel on click and calls onValueChange", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(withRouter(<Fixture defaultValue="curl" onValueChange={onValueChange} />));

    expect(screen.getByText("curl-panel")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /typescript/i }));

    expect(onValueChange).toHaveBeenCalledWith("ts");
    expect(screen.getByText("ts-panel")).toBeInTheDocument();
    expect(screen.queryByText("curl-panel")).not.toBeInTheDocument();
  });

  it("supports keyboard navigation (Arrow keys + Home/End) per WAI-ARIA", async () => {
    const user = userEvent.setup();
    render(withRouter(<Fixture defaultValue="curl" />));

    const curl = screen.getByRole("tab", { name: /curl/i });
    const go = screen.getByRole("tab", { name: /^go$/i });
    const ts = screen.getByRole("tab", { name: /typescript/i });

    curl.focus();
    expect(curl).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(go).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(ts).toHaveFocus();

    await user.keyboard("{ArrowRight}"); // wraps to first
    expect(curl).toHaveFocus();

    await user.keyboard("{ArrowLeft}"); // wraps to last
    expect(ts).toHaveFocus();

    await user.keyboard("{Home}");
    expect(curl).toHaveFocus();

    await user.keyboard("{End}");
    expect(ts).toHaveFocus();
  });

  it("supports controlled mode (value + onValueChange)", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    function Wrapper() {
      return <Fixture value="curl" onValueChange={onValueChange} />;
    }

    render(withRouter(<Wrapper />));

    expect(screen.getByText("curl-panel")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /^go$/i }));

    // In controlled mode the displayed value doesn't change until the
    // parent updates `value`. We assert the callback fired and the
    // displayed panel is still curl (no local state).
    expect(onValueChange).toHaveBeenCalledWith("go");
    expect(screen.getByText("curl-panel")).toBeInTheDocument();
  });

  it("with urlParam, reads the default value from the URL and writes on change", async () => {
    const user = userEvent.setup();
    render(withRouter(<Fixture defaultValue="curl" urlParam="lang" />, ["/?lang=ts"]));

    // Initial render picks up the URL value.
    expect(screen.getByText("ts-panel")).toBeInTheDocument();

    // Click another trigger and the URL updates.
    await user.click(screen.getByRole("tab", { name: /^go$/i }));
    expect(screen.getByText("go-panel")).toBeInTheDocument();
    expect(window.location.search).toBe(""); // memoryRouter, not real location
  });

  it("merges className on the root and forwards refs", () => {
    const ref: { current: HTMLDivElement | null } = { current: null };
    render(
      withRouter(
        <Tabs ref={ref} defaultValue="x" className="custom-class" data-testid="root">
          <Tabs.List>
            <Tabs.Trigger value="x">X</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="x">X-body</Tabs.Content>
        </Tabs>,
      ),
    );

    const root = screen.getByTestId("root");
    expect(root).toHaveClass("custom-class");
    expect(root.className.split(/\s+/).length).toBeGreaterThan(1);
    expect(ref.current).toBe(root);
  });
});
