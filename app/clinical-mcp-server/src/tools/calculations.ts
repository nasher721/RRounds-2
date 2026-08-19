import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export type ScoreType = "bmi" | "anion_gap" | "corrected_calcium";

export interface CalculationParams {
    weight_kg?: number;
    height_cm?: number;
    sodium?: number;
    chloride?: number;
    bicarbonate?: number;
    measured_calcium?: number;
    albumin?: number;
}

export interface CalculationResult {
    text: string;
    structuredContent: Record<string, number | string>;
}

const CALCULATION_WARNING = "Formula output only. Verify units, input accuracy, formula applicability, and local reference ranges before clinical use.";

function requireFinite(
    value: number | undefined,
    name: string,
    minimum: number,
    minimumInclusive: boolean
): number {
    if (value === undefined) {
        throw new Error(`Missing ${name}`);
    }

    if (!Number.isFinite(value)) {
        throw new Error(`${name} must be a finite number`);
    }

    const belowMinimum = minimumInclusive ? value < minimum : value <= minimum;
    if (belowMinimum) {
        const comparison = minimumInclusive ? "greater than or equal to" : "greater than";
        throw new Error(`${name} must be ${comparison} ${minimum}`);
    }

    return value;
}

function requireFiniteResult(value: number, name: string): number {
    if (!Number.isFinite(value)) {
        throw new Error(`${name} is outside the supported numeric range`);
    }
    return value;
}

export function calculateScore(scoreType: ScoreType, params: CalculationParams): CalculationResult {
    switch (scoreType) {
        case "bmi": {
            const weightKg = requireFinite(params.weight_kg, "weight_kg", 0, false);
            const heightCm = requireFinite(params.height_cm, "height_cm", 0, false);
            const heightM = heightCm / 100;
            const bmi = requireFiniteResult(weightKg / (heightM * heightM), "BMI result");
            const category = bmi < 18.5 ? "Underweight" :
                bmi < 25 ? "Normal weight" :
                    bmi < 30 ? "Overweight" : "Obese";

            return {
                text: `BMI: ${bmi.toFixed(1)} (${category})\n\nWarning: ${CALCULATION_WARNING}`,
                structuredContent: {
                    bmi,
                    category,
                    formula: "weight_kg / height_m^2",
                    disclaimer: CALCULATION_WARNING
                }
            };
        }

        case "anion_gap": {
            const sodium = requireFinite(params.sodium, "sodium", 0, false);
            const chloride = requireFinite(params.chloride, "chloride", 0, false);
            const bicarbonate = requireFinite(params.bicarbonate, "bicarbonate", 0, true);
            const anionGap = requireFiniteResult(sodium - (chloride + bicarbonate), "Anion Gap result");
            const interpretation = anionGap > 12 ? "High" : anionGap < 8 ? "Low" : "Normal";

            return {
                text: `Anion Gap: ${anionGap.toFixed(1)} mEq/L (${interpretation})\n\nWarning: ${CALCULATION_WARNING}`,
                structuredContent: {
                    anion_gap: anionGap,
                    interpretation,
                    formula: "sodium - (chloride + bicarbonate)",
                    disclaimer: CALCULATION_WARNING
                }
            };
        }

        case "corrected_calcium": {
            const measuredCalcium = requireFinite(params.measured_calcium, "measured_calcium", 0, true);
            const albumin = requireFinite(params.albumin, "albumin", 0, true);
            const correctedCalcium = requireFiniteResult(
                measuredCalcium + 0.8 * (4 - albumin),
                "Corrected Calcium result"
            );

            return {
                text: `Corrected Calcium: ${correctedCalcium.toFixed(2)} mg/dL\n\nWarning: ${CALCULATION_WARNING}`,
                structuredContent: {
                    corrected_calcium: correctedCalcium,
                    formula: "measured_calcium + 0.8 * (4 - albumin)",
                    disclaimer: CALCULATION_WARNING
                }
            };
        }
    }
}

const finiteOptionalNumber = z.number().finite().optional();

export function registerCalculationsTools(server: McpServer) {
    server.registerTool(
        "clinical_calculate_score",
        {
            title: "Calculate Clinical Score",
            description: `Calculates one of the supported formulas after validating that required inputs are finite and non-negative (strictly positive where zero would make the formula invalid).
Currently supports:
- BMI (Body Mass Index)
- Anion Gap
- Corrected Calcium

Args:
  - score_type (enum): The type of score to calculate ('bmi', 'anion_gap', 'corrected_calcium')
  - params (object): The parameters for the specific calculation.
    - For BMI: { weight_kg, height_cm }
    - For Anion Gap: { sodium, chloride, bicarbonate }
    - For Corrected Calcium: { measured_calcium, albumin }

Returns:
  A structured object with the calculated result and interpretation. Calculations do not replace clinical judgment or source verification.`,
            inputSchema: z.object({
                score_type: z.enum(["bmi", "anion_gap", "corrected_calcium"]),
                params: z.object({
                    weight_kg: finiteOptionalNumber,
                    height_cm: finiteOptionalNumber,
                    sodium: finiteOptionalNumber,
                    chloride: finiteOptionalNumber,
                    bicarbonate: finiteOptionalNumber,
                    measured_calcium: finiteOptionalNumber,
                    albumin: finiteOptionalNumber
                })
            }),
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false
            }
        },
        async ({ score_type, params }) => {
            try {
                const result = calculateScore(score_type, params);
                return {
                    content: [{ type: "text", text: result.text }],
                    structuredContent: result.structuredContent
                };
            } catch (error: unknown) {
                return {
                    isError: true,
                    content: [{
                        type: "text",
                        text: `Error calculating score: ${error instanceof Error ? error.message : String(error)}`
                    }]
                };
            }
        }
    );
}
