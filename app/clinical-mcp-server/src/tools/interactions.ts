import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export type InteractionSeverity = "minor" | "moderate" | "major" | "contraindicated";

interface PlaceholderInteraction {
    drugs: string[];
    severity: InteractionSeverity;
    description: string;
    management: string;
}

export interface InteractionCheckResult {
    text: string;
    structuredContent: {
        checked_drugs: string[];
        severity_threshold: InteractionSeverity;
        authoritative_check_completed: false;
        coverage: "limited_placeholder_examples";
        interactions_detected_in_placeholder: number;
        interactions_found: number;
        interactions: PlaceholderInteraction[];
        disclaimer: string;
    };
}

const DISCLAIMER = "This limited placeholder dataset is not an authoritative drug-interaction check and cannot establish that a combination is safe. Verify every combination with a current authoritative interaction resource and clinical pharmacist.";

const severityRank: Record<InteractionSeverity, number> = {
    minor: 0,
    moderate: 1,
    major: 2,
    contraindicated: 3
};

function normalizeDrugName(drug: string): string {
    return drug.trim().toLowerCase();
}

export function checkPlaceholderInteractions(
    drugs: string[],
    severityThreshold: InteractionSeverity = "minor"
): InteractionCheckResult {
    const checkedDrugs = drugs.map(drug => drug.trim());
    const normalizedDrugs = checkedDrugs.map(normalizeDrugName);
    const uniqueDrugs = new Set(normalizedDrugs);

    if (checkedDrugs.length < 2 || checkedDrugs.some(drug => drug.length === 0)) {
        throw new Error("Provide at least two non-empty drug names");
    }
    if (uniqueDrugs.size < 2) {
        throw new Error("Provide at least two distinct drug names");
    }

    const detected: PlaceholderInteraction[] = [];

    if (
        normalizedDrugs.includes("lisinopril") &&
        (normalizedDrugs.includes("potassium") || normalizedDrugs.includes("potassium chloride"))
    ) {
        detected.push({
            drugs: ["lisinopril", "potassium chloride"],
            severity: "major",
            description: "Placeholder example: ACE inhibitors and potassium supplements may increase hyperkalemia risk.",
            management: "Do not act on this placeholder result alone; verify in a current interaction resource and review with a clinical pharmacist."
        });
    }

    if (normalizedDrugs.includes("omeprazole") && normalizedDrugs.includes("clopidogrel")) {
        detected.push({
            drugs: ["omeprazole", "clopidogrel"],
            severity: "major",
            description: "Placeholder example: omeprazole may reduce clopidogrel activation through CYP2C19 inhibition.",
            management: "Do not change therapy from this placeholder result; verify the interaction and alternatives with a current source and clinical pharmacist."
        });
    }

    const interactions = detected.filter(
        interaction => severityRank[interaction.severity] >= severityRank[severityThreshold]
    );

    let resultSummary: string;
    if (interactions.length > 0) {
        resultSummary = `The placeholder dataset contains ${interactions.length} example interaction(s) at or above the ${severityThreshold} threshold.`;
    } else if (detected.length > 0) {
        resultSummary = `The placeholder dataset contains ${detected.length} example interaction(s), but none meet the ${severityThreshold} threshold.`;
    } else {
        resultSummary = "The placeholder dataset contains no matching example for this combination. This is an inconclusive result, not a negative interaction check.";
    }

    let details = "";
    interactions.forEach((interaction, index) => {
        details += `\n\n${index + 1}. [${interaction.severity.toUpperCase()}] ${interaction.drugs.join(" + ")}\n`;
        details += `Description: ${interaction.description}\n`;
        details += `Management: ${interaction.management}`;
    });

    return {
        text: `WARNING: ${DISCLAIMER}\n\nChecked placeholder examples for: ${checkedDrugs.join(", ")}\n${resultSummary}${details}`,
        structuredContent: {
            checked_drugs: checkedDrugs,
            severity_threshold: severityThreshold,
            authoritative_check_completed: false,
            coverage: "limited_placeholder_examples",
            interactions_detected_in_placeholder: detected.length,
            interactions_found: interactions.length,
            interactions,
            disclaimer: DISCLAIMER
        }
    };
}

const drugSchema = z.string().trim().min(1, "Drug names cannot be empty").max(100);

export function registerInteractionsTools(server: McpServer) {
    server.registerTool(
        "clinical_check_interactions",
        {
            title: "Check Placeholder Drug-Interaction Examples",
            description: `Looks for a small number of bundled drug-interaction examples. This placeholder does not query an authoritative interaction database, does not provide comprehensive coverage, and must never be interpreted as evidence that a drug combination is safe.

Args:
  - drugs (array of strings): Drug names to compare against the placeholder examples.
  - severity_threshold (string, optional): Minimum severity to return ('minor', 'moderate', 'major', 'contraindicated'). Defaults to 'minor'.

Returns:
  Matching placeholder examples plus explicit coverage and verification warnings. Every combination requires verification with a current authoritative resource and clinical pharmacist.`,
            inputSchema: z.object({
                drugs: z.array(drugSchema).min(2, "Must provide at least two drugs").max(50),
                severity_threshold: z.enum(["minor", "moderate", "major", "contraindicated"]).default("minor")
            }),
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false
            }
        },
        async ({ drugs, severity_threshold }) => {
            try {
                const result = checkPlaceholderInteractions(drugs, severity_threshold);
                return {
                    content: [{ type: "text", text: result.text }],
                    structuredContent: result.structuredContent
                };
            } catch (error: unknown) {
                return {
                    isError: true,
                    content: [{
                        type: "text",
                        text: `Error checking placeholder interactions: ${error instanceof Error ? error.message : String(error)}`
                    }]
                };
            }
        }
    );
}
