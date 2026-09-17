import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { McpPage } from "./McpPage";

describe("<McpPage>", () => {
  it("renders the eyebrow + serif h1 + lede in the hero", () => {
    render(<McpPage />);
    expect(screen.getByText("Model Context Protocol")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: /pull rfcs directly/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/MCP server that exposes/)).toBeInTheDocument();
  });

  it("renders the two related-server cards with their tags", () => {
    render(<McpPage />);
    expect(screen.getByText("rfcs-mcp")).toBeInTheDocument();
    expect(screen.getByText("this server")).toBeInTheDocument();
    expect(screen.getByText("docs-mcp")).toBeInTheDocument();
    expect(screen.getByText("related")).toBeInTheDocument();
  });

  it("renders the 4 numbered setup steps with the step chip", () => {
    render(<McpPage />);
    expect(
      screen.getByRole("heading", { level: 2, name: /Install the server/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /Configure your client/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /Available tools/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /Verify it works/ })).toBeInTheDocument();
    // Step chips 1..4 render as text inside the heading.
    for (const n of ["1", "2", "3", "4"]) {
      expect(screen.getByText(n, { selector: "span" })).toBeInTheDocument();
    }
  });

  it("renders 4 download items (macOS arm64, macOS amd64, linux x86_64, linux arm64)", () => {
    render(<McpPage />);
    const dlLinks = screen.getAllByRole("link", { name: /^Download / });
    expect(dlLinks.length).toBe(4);
    expect(dlLinks[0]).toHaveTextContent(/darwin_arm64/);
  });

  it("renders the 5 MCP tools with their names as code", () => {
    render(<McpPage />);
    // The card descriptions also reference some tool names; scope to the
    // tool list under "Available tools" (step 3).
    const heading = screen.getByRole("heading", { level: 2, name: /Available tools/ });
    const toolsSection = heading.parentElement;
    if (!toolsSection) throw new Error("tools section heading has no parent");
    for (const tool of ["list_rfcs", "get_rfc", "search_rfcs", "get_links", "get_activity"]) {
      const matches = toolsSection.querySelectorAll("code");
      const found = Array.from(matches).some((c) => c.textContent === tool);
      expect(found).toBe(true);
    }
  });

  it("ExampleTabs starts on Claude Code and shows its config", () => {
    render(<McpPage />);
    const claudeCodeTab = screen.getByRole("tab", { name: "Claude Code" });
    expect(claudeCodeTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText(/Claude Code MCP config/i)).toHaveTextContent(
      /~\/.config\/claude-code\/mcp.json/,
    );
  });

  it("ExampleTabs switches the visible config when another tab is clicked", async () => {
    render(<McpPage />);
    await userEvent.click(screen.getByRole("tab", { name: "Cursor" }));
    expect(screen.getByRole("tab", { name: "Cursor" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Claude Code" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByLabelText(/Cursor MCP config/i)).toHaveTextContent(/cursor\/mcp.json/);
  });
});
