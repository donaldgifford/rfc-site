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
    document.documentElement.style.setProperty("--bg-elevated", "#181e2b");
    document.documentElement.style.setProperty("--fg-tertiary", "#7a8396");
    makeBlock("graph TD; A-->B;");
    renderMock.mockResolvedValueOnce({ svg: "<svg></svg>" });

    await hydrateMermaid();

    expect(initializeMock).toHaveBeenCalledTimes(1);
    expect(initializeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        startOnLoad: false,
        theme: "base",
        securityLevel: "loose",
        themeVariables: expect.objectContaining({
          primaryColor: "#181e2b",
          lineColor: "#7a8396",
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
    for (const name of [
      "--bg-base",
      "--bg-raised",
      "--bg-elevated",
      "--border-strong",
      "--fg-primary",
      "--fg-secondary",
      "--fg-tertiary",
      "--font-mono",
    ]) {
      document.documentElement.style.removeProperty(name);
    }
  });

  it("reads the current tokens when set (bg-elevated → primary, fg-tertiary → line)", () => {
    document.documentElement.style.setProperty("--bg-elevated", "#abcdef");
    document.documentElement.style.setProperty("--fg-tertiary", "#001122");
    const theme = mermaidThemeFromTokens();
    expect(theme.primaryColor).toBe("#abcdef");
    expect(theme.mainBkg).toBe("#abcdef");
    expect(theme.lineColor).toBe("#001122");
  });

  it("falls back to defaults when a token is empty", () => {
    // jsdom returns "" for unset custom properties.
    const theme = mermaidThemeFromTokens();
    expect(theme.primaryColor).toBe("#181e2b");
    expect(theme.lineColor).toBe("#7a8396");
    expect(theme.fontFamily).toBe("monospace");
  });

  it("uses the muted fg-tertiary token for arrows (not the bright accent)", () => {
    document.documentElement.style.setProperty("--fg-tertiary", "#7a8396");
    document.documentElement.style.setProperty("--accent", "#7dcfff");
    const theme = mermaidThemeFromTokens();
    // Previously lineColor read from --accent which produced the bright
    // cyan arrows we wanted to move away from.
    expect(theme.lineColor).toBe("#7a8396");
  });

  it("sets the flowchart-specific aliases (mainBkg / nodeBorder)", () => {
    document.documentElement.style.setProperty("--bg-elevated", "#111");
    document.documentElement.style.setProperty("--border-strong", "#222");
    const theme = mermaidThemeFromTokens();
    expect(theme.mainBkg).toBe("#111");
    expect(theme.nodeBorder).toBe("#222");
  });

  it("pins fontFamily to a plain monospace keyword (no CSS quotes/commas that break SVG attrs)", () => {
    document.documentElement.style.setProperty(
      "--font-mono",
      '"IBM Plex Mono", ui-monospace, monospace',
    );
    const theme = mermaidThemeFromTokens();
    // The full CSS font stack contains quotes + commas which broke
    // mermaid.render when forwarded into SVG font-family attributes.
    // We pin a safe value regardless of the token.
    expect(theme.fontFamily).toBe("monospace");
  });
});
