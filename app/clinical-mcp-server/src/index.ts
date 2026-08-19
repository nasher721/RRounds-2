import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerCalculationsTools } from "./tools/calculations.js";
import { registerInteractionsTools } from "./tools/interactions.js";
import { registerContentTools } from "./tools/content.js";

// Create MCP server instance
const server = new McpServer({
    name: "clinical-mcp-server",
    version: "1.0.0"
});

// Register domain-specific tools
registerCalculationsTools(server);
registerInteractionsTools(server);
registerContentTools(server);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Clinical MCP Server running on stdio");
}

main().catch(error => {
    console.error("Server error:", error);
    process.exit(1);
});
