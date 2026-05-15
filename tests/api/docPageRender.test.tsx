import { describe, expect, it, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import DocPageRoute, { loader } from "../../src/routes/$type.$id";
import { setupMswLifecycle } from "../utils/msw";
import { renderRoute } from "../utils/renderRoute";

class IntersectionObserverMock {
  callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }
  observe() {
    // noop
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
  // jsdom doesn't ship IntersectionObserver; the TOC scroll-spy uses it.
  globalThis.IntersectionObserver = IntersectionObserverMock;
});

setupMswLifecycle();

function mountDocPage(initial = "/rfc/0001") {
  return renderRoute(
    {
      path: "/:type/:id",
      Component: DocPageRoute,
      loader,
    },
    [initial],
  );
}

describe("/$type/$id route render", () => {
  it("renders the NumberLine eyebrow + serif h1 from the loader data", async () => {
    mountDocPage();
    await waitFor(() => {
      expect(screen.getByText(/RFC \/ 0001/)).toBeInTheDocument();
    });
    expect(
      screen.getByRole("heading", { level: 1, name: /Adopt MSW-backed dev mode/ }),
    ).toBeInTheDocument();
  });

  it("renders the metadata sidebar with the status colour mapped from doc.status", async () => {
    mountDocPage();
    await waitFor(() => {
      expect(screen.getByText("Metadata")).toBeInTheDocument();
    });
    // Default fixture status is "proposed".
    const headerMeta = screen.getAllByText(/Proposed/);
    expect(headerMeta.length).toBeGreaterThan(0);
  });

  it("renders the References footer with empty back-references", async () => {
    mountDocPage();
    await waitFor(() => {
      expect(screen.getByText("References")).toBeInTheDocument();
    });
    expect(screen.getByText("Referenced by")).toBeInTheDocument();
    expect(screen.getByText(/back-references arrive once rfc-api/i)).toBeInTheDocument();
  });

  it("renders the rendered Markdown body inside the article column", async () => {
    mountDocPage();
    // The default fixture body has Motivation / Proposal / Alternatives
    // headings. They should land in the article — the TOC harvests them
    // via the MutationObserver/effect on the first paint.
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2, name: /Motivation/i })).toBeInTheDocument();
    });
  });
});
