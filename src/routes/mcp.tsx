import type { Route } from "./+types/mcp";
import { McpPage } from "../components/McpPage/McpPage";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "MCP — rfc-site" },
    {
      name: "description",
      content:
        "Install and configure rfcs-mcp to access RFCs from Claude Code, Cursor, and other MCP-aware clients.",
    },
  ];
}

export default function McpRoute() {
  return <McpPage />;
}
