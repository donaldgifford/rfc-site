/**
 * Portal-local MCP setup content. Mockup §3922-4056.
 *
 * Lives in the portal because rfcs-mcp itself doesn't ship docs;
 * this view is the canonical install + configure surface. Values
 * are placeholders until the rfcs-mcp repo exists publicly — keep
 * them realistic so the page reads as documentation rather than
 * a stub.
 */

export interface DownloadEntry {
  filename: string;
  platform: string;
  icon: string;
  href: string;
}

export interface ConfigSnippet {
  client: string;
  comment: string;
  body: string;
}

export interface McpTool {
  name: string;
  description: string;
}

export interface RelatedServer {
  name: string;
  tag: string;
  tagVariant: "this" | "related";
  description: string;
  meta: string[];
  sourceHref: string;
}

export const MCP_VERSION = "0.4.2";

export const MCP_SERVERS: readonly RelatedServer[] = [
  {
    name: "rfcs-mcp",
    tag: "this server",
    tagVariant: "this",
    description:
      "Exposes the portal's RFC read API as MCP tools — `list_rfcs`, `get_rfc`, `search_rfcs`, `get_links`. No write operations; authoring still happens in Git.",
    meta: [`v${MCP_VERSION}`, "Go 1.22+"],
    sourceHref: "https://github.com/donaldgifford/rfcs-mcp",
  },
  {
    name: "docs-mcp",
    tag: "related",
    tagVariant: "related",
    description:
      "Sibling project. Same architecture, but indexes MkDocs/Backstage TechDocs across your service repos. Useful when you want both RFCs and service documentation available as tools.",
    meta: ["v0.2.0", "Go 1.22+"],
    sourceHref: "https://github.com/donaldgifford/docs-mcp",
  },
];

export const MCP_DOWNLOADS: readonly DownloadEntry[] = [
  {
    filename: `rfcs-mcp_${MCP_VERSION}_darwin_arm64.tar.gz`,
    platform: "macOS · Apple Silicon · 8.2 MB",
    icon: "⌘",
    href: "#",
  },
  {
    filename: `rfcs-mcp_${MCP_VERSION}_darwin_amd64.tar.gz`,
    platform: "macOS · Intel · 8.4 MB",
    icon: "⌘",
    href: "#",
  },
  {
    filename: `rfcs-mcp_${MCP_VERSION}_linux_amd64.tar.gz`,
    platform: "Linux · x86_64 · 8.1 MB",
    icon: "🐧",
    href: "#",
  },
  {
    filename: `rfcs-mcp_${MCP_VERSION}_linux_arm64.tar.gz`,
    platform: "Linux · ARM64 · 8.0 MB",
    icon: "🐧",
    href: "#",
  },
];

export const MCP_BUILD_FROM_SOURCE = `# requires Go 1.22+
$ go install github.com/donaldgifford/rfcs-mcp/cmd/rfcs-mcp@latest
$ rfcs-mcp --version
rfcs-mcp v${MCP_VERSION} (commit 3f8e2a1, built 2026-04-12)`;

export const MCP_CONFIG_SNIPPETS: readonly ConfigSnippet[] = [
  {
    client: "Claude Code",
    comment: "// ~/.config/claude-code/mcp.json",
    body: `{
  "mcpServers": {
    "rfcs": {
      "command": "rfcs-mcp",
      "args": [
        "--api-url", "https://rfcs.internal/api/v1"
      ],
      "env": {
        "RFCS_MCP_TOKEN": "$RFCS_READ_TOKEN"
      }
    }
  }
}`,
  },
  {
    client: "Cursor",
    comment: "// ~/.cursor/mcp.json",
    body: `{
  "mcpServers": {
    "rfcs": {
      "command": "rfcs-mcp",
      "args": ["--api-url", "https://rfcs.internal/api/v1"]
    }
  }
}`,
  },
  {
    client: "Claude Desktop",
    comment: "// ~/Library/Application Support/Claude/claude_desktop_config.json",
    body: `{
  "mcpServers": {
    "rfcs": {
      "command": "/usr/local/bin/rfcs-mcp",
      "args": ["--api-url", "https://rfcs.internal/api/v1"]
    }
  }
}`,
  },
];

export const MCP_TOOLS: readonly McpTool[] = [
  {
    name: "list_rfcs",
    description:
      "list all RFCs with optional status and label filters. Returns id, title, status, authors, updated_at.",
  },
  {
    name: "get_rfc",
    description:
      "fetch a single RFC by id, including rendered markdown body and resolved cross-references.",
  },
  {
    name: "search_rfcs",
    description:
      "full-text search across titles, bodies, authors, and labels. Returns ranked results with highlighted snippets.",
  },
  {
    name: "get_links",
    description:
      "get the full reference graph for an RFC: what it references, what references it, and transitive depth.",
  },
  {
    name: "get_activity",
    description:
      'recent changes across all RFCs, useful for "what\'s happening this week" prompts.',
  },
];

export const MCP_VERIFY_PROMPT = `# in your LLM chat:
"Summarize RFC 0011 in three bullet points and list any RFCs it references."`;
