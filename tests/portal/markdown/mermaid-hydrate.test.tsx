import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const renderMock = vi.fn();
const initializeMock = vi.fn();

vi.mock("mermaid", () => ({
  default: {
    initialize: initializeMock,
    render: renderMock,
  },
}));

// Import AFTER vi.mock so the hydrate module's lazy `import("mermaid")`
// resolves to the mocked module.
const { hydrateMermaid, mermaidThemeFromTokens } =
  await import("../../../src/portal/markdown/mermaid-hydrate");

function makeBlock(source: string): HTMLPreElement {
  const pre = document.createElement("pre");
  pre.setAttribute("data-mermaid-source", "");
  pre.textContent = source;
  document.body.appendChild(pre);
  return pre;
}

describe("hydrateMermaid", () => {
  beforeEach(() => {
    renderMock.mockReset();
    initializeMock.mockReset();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("is a no-op when no [data-mermaid-source] blocks exist", async () => {
    await hydrateMermaid();
    expect(initializeMock).not.toHaveBeenCalled();
    expect(renderMock).not.toHaveBeenCalled();
  });

  it("replaces a single block's content with the rendered SVG and tags it .mermaid-diagram", async () => {
    const block = makeBlock("graph TD; A-->B;");
    renderMock.mockResolvedValueOnce({ svg: '<svg id="m1"><g></g></svg>' });

    await hydrateMermaid();

    expect(initializeMock).toHaveBeenCalledTimes(1);
    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(renderMock).toHaveBeenCalledWith(expect.stringMatching(/^mermaid-/), "graph TD; A-->B;");
    expect(block.innerHTML).toContain('<svg id="m1">');
    expect(block.classList.contains("mermaid-diagram")).toBe(true);
    expect(block.hasAttribute("data-mermaid-source")).toBe(false);
  });

  it("hydrates every block independently when there are several", async () => {
    const a = makeBlock("graph TD; A-->B;");
    const b = makeBlock("sequenceDiagram\nA->>B: hi");
    renderMock
      .mockResolvedValueOnce({ svg: "<svg>A</svg>" })
      .mockResolvedValueOnce({ svg: "<svg>B</svg>" });

    await hydrateMermaid();

    expect(renderMock).toHaveBeenCalledTimes(2);
    expect(a.innerHTML).toContain("<svg>A</svg>");
    expect(b.innerHTML).toContain("<svg>B</svg>");
    expect(a.classList.contains("mermaid-diagram")).toBe(true);
    expect(b.classList.contains("mermaid-diagram")).toBe(true);
  });

  it("passes theme variables derived from the document's CSS tokens", async () => {
    document.documentElement.style.setProperty("--bg-raised", "#1a1d28");
    document.documentElement.style.setProperty("--accent", "#7aa2f7");
    makeBlock("graph TD; A-->B;");
    renderMock.mockResolvedValueOnce({ svg: "<svg></svg>" });

    await hydrateMermaid();

    expect(initializeMock).toHaveBeenCalledTimes(1);
    expect(initializeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        startOnLoad: false,
        theme: "base",
        securityLevel: "strict",
        themeVariables: expect.objectContaining({
          primaryColor: "#1a1d28",
          lineColor: "#7aa2f7",
        }) as unknown,
      }),
    );
  });

  it("logs and continues when mermaid.render rejects (block retains source text)", async () => {
    const block = makeBlock("not a valid mermaid graph");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // Suppress noisy expected-error logs from this test.
    });
    renderMock.mockRejectedValueOnce(new Error("parse fail"));

    await hydrateMermaid();

    expect(consoleSpy).toHaveBeenCalled();
    // Source remains; class not added so the user sees the raw code.
    expect(block.textContent).toContain("not a valid mermaid graph");
    expect(block.classList.contains("mermaid-diagram")).toBe(false);
    consoleSpy.mockRestore();
  });

  it("removes the data-mermaid-source attribute on an empty block (no render call)", async () => {
    const block = makeBlock("   ");
    await hydrateMermaid();
    expect(renderMock).not.toHaveBeenCalled();
    expect(block.hasAttribute("data-mermaid-source")).toBe(false);
  });
});

describe("mermaidThemeFromTokens", () => {
  beforeEach(() => {
    // Reset every documented token so each test starts from a clean slate.
    document.documentElement.style.removeProperty("--bg-raised");
    document.documentElement.style.removeProperty("--fg-primary");
    document.documentElement.style.removeProperty("--border-hairline");
    document.documentElement.style.removeProperty("--accent");
    document.documentElement.style.removeProperty("--bg-elevated");
    document.documentElement.style.removeProperty("--bg-base");
    document.documentElement.style.removeProperty("--font-mono");
  });

  it("reads the current --bg-raised etc. when set", () => {
    document.documentElement.style.setProperty("--bg-raised", "#abcdef");
    document.documentElement.style.setProperty("--accent", "#001122");
    const theme = mermaidThemeFromTokens();
    expect(theme.primaryColor).toBe("#abcdef");
    expect(theme.lineColor).toBe("#001122");
  });

  it("falls back to defaults when a token is empty", () => {
    // jsdom returns "" for unset custom properties.
    const theme = mermaidThemeFromTokens();
    expect(theme.primaryColor).toBe("#1a1d28");
    expect(theme.lineColor).toBe("#7aa2f7");
    expect(theme.fontFamily).toBe("monospace");
  });
});
