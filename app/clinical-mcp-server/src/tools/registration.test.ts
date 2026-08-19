import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCalculationsTools } from "./calculations.js";
import { registerContentTools } from "./content.js";
import { registerInteractionsTools } from "./interactions.js";

function firstTextContent(content: unknown): string {
    assert.ok(Array.isArray(content));
    const firstItem: unknown = content[0];
    assert.ok(firstItem && typeof firstItem === "object" && "type" in firstItem && "text" in firstItem);
    assert.equal(firstItem.type, "text");
    const text = firstItem.text;
    assert.equal(typeof text, "string");
    if (typeof text !== "string") {
        throw new TypeError("Expected text MCP content");
    }
    return text;
}

test("registered MCP tools preserve validation and safety warnings end to end", async () => {
    const server = new McpServer({ name: "clinical-mcp-test", version: "1.0.0" });
    registerCalculationsTools(server);
    registerContentTools(server);
    registerInteractionsTools(server);

    const client = new Client({ name: "clinical-mcp-test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    try {
        const tools = await client.listTools();
        assert.deepEqual(
            tools.tools.map(tool => tool.name).sort(),
            ["clinical_calculate_score", "clinical_check_interactions", "clinical_sync_content"]
        );

        const invalidCalculation = await client.callTool({
            name: "clinical_calculate_score",
            arguments: {
                score_type: "bmi",
                params: { weight_kg: -70, height_cm: 175 }
            }
        });
        assert.equal(invalidCalculation.isError, true);

        const interactionCheck = await client.callTool({
            name: "clinical_check_interactions",
            arguments: { drugs: ["warfarin", "acetaminophen"] }
        });
        assert.equal(interactionCheck.isError, undefined);
        assert.equal(
            (interactionCheck.structuredContent as { authoritative_check_completed: boolean }).authoritative_check_completed,
            false
        );
        assert.match(firstTextContent(interactionCheck.content), /inconclusive result/i);

        const contentLookup = await client.callTool({
            name: "clinical_sync_content",
            arguments: { topic: "DKA" }
        });
        assert.equal(
            (contentLookup.structuredContent as { clinical_use: string }).clinical_use,
            "not_for_clinical_decision_making"
        );
    } finally {
        await client.close();
        await server.close();
    }
});
