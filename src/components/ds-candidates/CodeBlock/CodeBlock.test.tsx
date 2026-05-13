import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CodeBlock } from "./CodeBlock";

// Mock Shiki entirely so jsdom doesn't load the real package's WASM
// regex engine — we just need to assert the lifecycle (fallback →
// highlighted) and the API contract (lang + themes get forwarded).
vi.mock("shiki", () => {
  return {
    codeToHtml: vi.fn((code: string, options: { lang: string }) =>
      Promise.resolve(
        `<pre class="shiki" data-mocked-lang="${options.lang}"><code>${code}</code></pre>`,
      ),
    ),
  };
});

beforeEach(() => {
  // Reset the singleton between tests so each test gets a fresh
  // call into the mocked codeToHtml.
  vi.clearAllMocks();
});

describe("<CodeBlock>", () => {
  it("renders an SSR-friendly <pre><code> fallback before Shiki resolves, then swaps to highlighted HTML", async () => {
    const { container } = render(<CodeBlock code="const x = 1;" language="ts" />);

    // Pre-resolve, the fallback exists.
    const fallback = container.querySelector("pre code");
    expect(fallback).not.toBeNull();
    expect(fallback?.textContent).toBe("const x = 1;");

    // Wait for the highlighted output to replace the fallback.
    await waitFor(() => {
      const shiki = container.querySelector(".shiki, [data-mocked-lang]");
      expect(shiki).not.toBeNull();
    });
    expect(container.querySelector('[data-mocked-lang="ts"]')).not.toBeNull();
  });

  it("forwards the language to the Shiki call (lang option)", async () => {
    const shiki = await import("shiki");
    render(<CodeBlock code="echo hi" language="bash" />);

    await waitFor(() => {
      expect(shiki.codeToHtml).toHaveBeenCalled();
    });

    const mock = shiki.codeToHtml as unknown as ReturnType<typeof vi.fn>;
    const firstCall = mock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const opts = firstCall?.[1] as { lang: string; themes: { light: string; dark: string } };
    expect(opts).toMatchObject({ lang: "bash" });
    expect(opts).toMatchObject({ themes: { light: "github-light", dark: "github-dark" } });
  });

  it("renders the language label when provided", () => {
    render(<CodeBlock code="x" language="curl" label="curl" />);
    expect(screen.getByText("curl")).toBeInTheDocument();
  });

  it("renders the copy button by default and writes the code to the clipboard", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<CodeBlock code="const z = 42;" language="ts" />);
    const button = screen.getByRole("button", { name: /copy code/i });
    await user.click(button);
    expect(writeText).toHaveBeenCalledWith("const z = 42;");

    // Button flips to the "Copied" state.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();
    });
  });

  it("hides the copy button when showCopy={false}", () => {
    render(<CodeBlock code="x" showCopy={false} />);
    expect(screen.queryByRole("button", { name: /copy/i })).not.toBeInTheDocument();
  });
});
