import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const CLINICAL_USE_WARNING = "Bundled demo content only. It is not synchronized with IBCC or any live clinical source, has no verified review date, and must not be used for clinical decision-making. Verify guidance against current institutional protocols and authoritative sources.";

const demoContent: Readonly<Record<string, string>> = Object.freeze({
    Resuscitation: "Demo topic outline covering fluid therapy, vasopressors, and airway management. No current protocol or treatment parameters are included.",
    Neurology: "Demo topic outline covering acute stroke, status epilepticus, and elevated intracranial pressure. No current protocol or treatment parameters are included.",
    Pulmonology: "Demo topic outline covering ARDS ventilation and asthma exacerbation. No current protocol or treatment parameters are included.",
    DKA: "Demo topic outline covering fluids, insulin, electrolyte monitoring, and resolution criteria. No current protocol or treatment parameters are included."
});

export interface DemoContentResult {
    text: string;
    structuredContent: {
        status: "unverified_demo_content";
        clinical_use: "not_for_clinical_decision_making";
        last_verified_at: null;
        requested_topic: string;
        matched_category: string | null;
        content: string;
        source: "Bundled demo content (not synchronized)";
        disclaimer: string;
    };
}

export function lookupDemoContent(topic: string): DemoContentResult {
    const requestedTopic = topic.trim();
    if (!requestedTopic) {
        throw new Error("Topic cannot be empty");
    }

    const topicWords: string[] = requestedTopic.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    const matchedCategory = Object.keys(demoContent).find(category =>
        topicWords.includes(category.toLowerCase())
    ) ?? null;

    const content = matchedCategory
        ? demoContent[matchedCategory]
        : `No bundled demo outline matched '${requestedTopic}'. Available demo topics: ${Object.keys(demoContent).join(", ")}.`;

    return {
        text: `WARNING: ${CLINICAL_USE_WARNING}\n\n## Demo topic: ${matchedCategory ?? requestedTopic}\n\n${content}\n\nSource: Bundled demo content (not synchronized)`,
        structuredContent: {
            status: "unverified_demo_content",
            clinical_use: "not_for_clinical_decision_making",
            last_verified_at: null,
            requested_topic: requestedTopic,
            matched_category: matchedCategory,
            content,
            source: "Bundled demo content (not synchronized)",
            disclaimer: CLINICAL_USE_WARNING
        }
    };
}

export function registerContentTools(server: McpServer) {
    server.registerTool(
        "clinical_sync_content",
        {
            title: "Search Bundled Clinical Demo Topics",
            description: `Searches a small set of bundled demo topic outlines. Despite the legacy tool name, this implementation does not synchronize content and does not connect to IBCC, institutional protocols, or another live clinical source. The outlines have no verified review date and are not clinical guidance.

Args:
  - topic (string): Demo topic to search for (for example, 'Resuscitation', 'Neurology', 'Pulmonology', or 'DKA').

Returns:
  A demo outline with explicit provenance, verification status, and a warning against clinical use.`,
            inputSchema: z.object({
                topic: z.string().trim().min(1, "Topic cannot be empty").max(200)
            }),
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false
            }
        },
        async ({ topic }) => {
            try {
                const result = lookupDemoContent(topic);
                return {
                    content: [{ type: "text", text: result.text }],
                    structuredContent: result.structuredContent
                };
            } catch (error: unknown) {
                return {
                    isError: true,
                    content: [{
                        type: "text",
                        text: `Error searching demo content: ${error instanceof Error ? error.message : String(error)}`
                    }]
                };
            }
        }
    );
}
