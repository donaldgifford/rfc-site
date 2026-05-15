import { describe, expect, it, beforeEach } from "vitest";
import { useRef } from "react";
import { render, screen } from "@testing-library/react";
import { TableOfContents } from "./TableOfContents";

class IntersectionObserverMock {
  callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }
  observe() {
    // noop — tests don't assert on scroll behaviour.
  }
  unobserve() {
    // noop
  }
  disconnect() {
    // noop
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  root: Element | Document | null = null;
  rootMargin = "";
  thresholds: readonly number[] = [];
}

beforeEach(() => {
  // jsdom doesn't ship IntersectionObserver. Provide a no-op shim so the
  // scroll-spy effect mounts without throwing.
  globalThis.IntersectionObserver = IntersectionObserverMock;
});

function Harness({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  return (
    <>
      <TableOfContents articleRef={ref} />
      <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}

describe("<TableOfContents>", () => {
  it("returns null when the article has no headings", () => {
    const { container } = render(<Harness html="<p>just prose</p>" />);
    expect(container.querySelector("nav")).toBeNull();
  });

  it("renders one entry per <h2 id> and labels nested h3 entries", async () => {
    render(
      <Harness
        html={
          '<h2 id="summary">Summary</h2>' +
          "<p>x</p>" +
          '<h2 id="motivation">Motivation</h2>' +
          '<h3 id="components">Components</h3>'
        }
      />,
    );

    expect(await screen.findByRole("link", { name: "Summary" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Motivation" })).toBeInTheDocument();
    const components = screen.getByRole("link", { name: "Components" });
    expect(components.closest("li")?.className).toMatch(/nested/);
  });

  it("ignores headings without an id", async () => {
    render(<Harness html={'<h2 id="kept">Kept</h2>' + "<h2>No anchor</h2>"} />);

    expect(await screen.findByRole("link", { name: "Kept" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "No anchor" })).not.toBeInTheDocument();
  });

  it("links each entry to its anchor", async () => {
    render(<Harness html='<h2 id="summary">Summary</h2>' />);
    const link = await screen.findByRole("link", { name: "Summary" });
    expect(link).toHaveAttribute("href", "#summary");
  });
});
