import { afterEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

import { DocumentView } from "../../../../src/portal/markdown/DocumentView";
import type { Document } from "../../../../src/portal/api/__generated__/model";

// Mock mermaid so jsdom doesn't try to load the real ~700KB library and so
// the diagram render is deterministic. The render mock NEVER resolves by
// default — that lets us inspect the SSR fallback. Tests that want a
// resolved render override `mockRender` per-case.
const mockRender = vi.fn<(id: string, source: string) => Promise<{ svg: string }>>();
const mockInitialize = vi.fn();

vi.mock("mermaid", () => ({
  default: {
    initialize: (opts: unknown): void => {
      mockInitialize(opts);
    },
    render: (id: string, source: string): Promise<{ svg: string }> => mockRender(id, source),
  },
}));

afterEach(() => {
  mockRender.mockReset();
  mockInitialize.mockReset();
});

function fixture(body: string): Document {
  return {
    id: "RFC-0001",
    type: "rfc",
    status: "proposed",
    title: "Fixture",
    body,
    authors: [],
    links: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    source: { repo: "x/y", path: "z.md", commit: "deadbeef" },
  };
}

describe("<Pre>", () => {
  it("passes through plain code blocks unchanged (Shiki output)", async () => {
    const body = ["```ts", "const x = 1;", "```"].join("\n");
    const { container } = render(<DocumentView document={fixture(body)} />);
    await waitFor(() => {
      expect(container.querySelector("pre.shiki")).not.toBeNull();
    });
    expect(container.querySelector("[data-mermaid-block]")).toBeNull();
    expect(mockRender).not.toHaveBeenCalled();
  });

  it("routes mermaid blocks to <MermaidBlock> and replaces with the rendered SVG", async () => {
    mockRender.mockResolvedValue({ svg: "<svg data-mocked-mermaid='1'/>" });
    const body = ["```mermaid", "graph TD; A-->B", "```"].join("\n");
    const { container } = render(<DocumentView document={fixture(body)} />);
    await waitFor(() => {
      expect(container.querySelector("[data-mermaid-block]")).not.toBeNull();
    });
    await waitFor(() => {
      expect(container.querySelector("[data-mocked-mermaid]")).not.toBeNull();
    });
  });

  it("calls mermaid.render with the diagram source recovered from the <code> text", async () => {
    // Pending render so we can introspect the call without state churn.
    mockRender.mockReturnValue(new Promise<{ svg: string }>(() => undefined));
    const body = ["```mermaid", "sequenceDiagram", "  Alice->>Bob: Hi", "```"].join("\n");
    render(<DocumentView document={fixture(body)} />);
    await waitFor(() => {
      expect(mockRender).toHaveBeenCalled();
    });
    const lastCallArgs = mockRender.mock.calls.at(-1);
    expect(lastCallArgs?.[1]).toContain("sequenceDiagram");
    expect(lastCallArgs?.[1]).toContain("Alice->>Bob: Hi");
  });

  it("renders the SSR fallback <pre data-mermaid-source-fallback> until hydration completes", async () => {
    // Never resolves → fallback stays visible.
    mockRender.mockReturnValue(new Promise<{ svg: string }>(() => undefined));
    const body = ["```mermaid", "graph TD;", "```"].join("\n");
    const { container } = render(<DocumentView document={fixture(body)} />);
    await waitFor(() => {
      expect(container.querySelector("[data-mermaid-source-fallback]")).not.toBeNull();
    });
  });

  it("removes the SSR fallback after hydration completes", async () => {
    mockRender.mockResolvedValue({ svg: "<svg/>" });
    const body = ["```mermaid", "graph TD;", "```"].join("\n");
    const { container } = render(<DocumentView document={fixture(body)} />);
    await waitFor(() => {
      expect(container.querySelector("[data-mermaid-source-fallback]")).toBeNull();
    });
  });
});
