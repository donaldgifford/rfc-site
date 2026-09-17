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

// Post-IMPL-0006 the loader runs the full Shiki pipeline server-side,
// which has a one-time WASM cold-start cost. Locally ~2s; on GitHub
// Actions runners ~8s (the perf test logs `cold=8040ms`). Bumping
// waitFor's polling timeout so the first test in the file doesn't
// race the warmup. Stays comfortably under vitest's testTimeout=15s.
const WAITFOR_TIMEOUT = 12000;

describe("/$type/$id route render", () => {
  it("renders the NumberLine eyebrow + serif h1 from the loader data", async () => {
    mountDocPage();
    await waitFor(
      () => {
        expect(screen.getByText(/RFC \/ 0001/)).toBeInTheDocument();
      },
      { timeout: WAITFOR_TIMEOUT },
    );
    // Post-IMPL-0006: the rendered Markdown body now lives in the same
    // tree as the <DocHeader>, so two h1s exist (one from <DocHeader>,
    // one from the Markdown body's `# Title`). The DocHeader h1 is the
    // first match — getAllByRole returns DOM order.
    const titles = screen.getAllByRole("heading", { level: 1, name: /Adopt MSW-backed dev mode/ });
    expect(titles.length).toBeGreaterThanOrEqual(1);
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
    expect(screen.getByText(/no other RFCs reference this one/i)).toBeInTheDocument();
  });

  it("renders the rendered Markdown body inside the article column", async () => {
    mountDocPage();
    // Post-IMPL-0006: the loader server-side renders Markdown to HTML
    // and DocumentView injects it via dangerouslySetInnerHTML. Headings
    // are present in the very first paint — no Suspense fallback flash.
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2, name: /Motivation/i })).toBeInTheDocument();
    });
  });

  it("renders the article HTML with the markdown-body class (SSR'd via dangerouslySetInnerHTML)", async () => {
    const { container } = mountDocPage();
    await waitFor(() => {
      const article = container.querySelector("article.markdown-body");
      expect(article).not.toBeNull();
      // The article element should have actual content (the rendered HTML),
      // not just be an empty Suspense placeholder.
      expect(article?.innerHTML.length ?? 0).toBeGreaterThan(0);
    });
  });
});
