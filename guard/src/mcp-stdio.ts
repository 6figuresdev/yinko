import "./env.ts";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { bscContext } from "./chain.ts";
import { createMcpServer } from "./mcp.ts";

// stdout belongs to the MCP protocol: log to stderr only.
await createMcpServer(bscContext()).connect(new StdioServerTransport());
console.error("yinko MCP server ready on stdio");
