import { assessDrugLookups, fetchDrugLabels, getOpenFDAUrl } from "./index.ts";

Deno.test("OpenFDA lookup searches brand OR generic name", () => {
  const search = new URL(getOpenFDAUrl("warfarin")).searchParams.get("search");
  if (
    search !==
      'openfda.brand_name:"warfarin" OR openfda.generic_name:"warfarin"'
  ) {
    throw new Error(`Unexpected OpenFDA search expression: ${search}`);
  }
});

Deno.test("provider failures remain explicit and are not treated as no interaction", async () => {
  const lookup = await fetchDrugLabels(
    "warfarin",
    () => Promise.resolve(new Response("unavailable", { status: 503 })),
  );
  if (lookup.coverage.status !== "provider_error") {
    throw new Error("Expected provider failure coverage");
  }

  const availableLookup = {
    coverage: {
      drug: "aspirin",
      status: "available" as const,
      labelsChecked: 1,
      message: "1 matching FDA product label reviewed.",
    },
    labels: [{ drug_interactions: ["No relevant statement in this label."] }],
  };
  const result = assessDrugLookups(
    ["warfarin", "aspirin"],
    new Map([
      ["warfarin", lookup],
      ["aspirin", availableLookup],
    ]),
  );

  if (
    result.overallStatus !== "inconclusive" ||
    result.assessments[0]?.status !== "inconclusive"
  ) {
    throw new Error(
      "Expected incomplete coverage to produce an inconclusive result",
    );
  }
});

Deno.test("interaction evidence is checked in both label directions without severity inference", () => {
  const result = assessDrugLookups(
    ["warfarin", "aspirin"],
    new Map([
      [
        "warfarin",
        {
          coverage: {
            drug: "warfarin",
            status: "available" as const,
            labelsChecked: 1,
            message: "label available",
          },
          labels: [{ drug_interactions: ["See monitoring guidance."] }],
        },
      ],
      [
        "aspirin",
        {
          coverage: {
            drug: "aspirin",
            status: "available" as const,
            labelsChecked: 1,
            message: "label available",
          },
          labels: [{
            drug_interactions: [
              "Concomitant warfarin may increase the risk of bleeding.",
            ],
          }],
        },
      ],
    ]),
  );

  if (result.assessments[0]?.status !== "interaction_found") {
    throw new Error("Expected reverse-label evidence to be detected");
  }
  if (result.interactions.length !== 1) {
    throw new Error("Expected one documented interaction mention");
  }
  if ("severity" in result.interactions[0]) {
    throw new Error(
      "FDA section placement must not be converted into severity",
    );
  }
});

Deno.test("complete label coverage distinguishes no documented mention", () => {
  const lookup = (drug: string) => ({
    coverage: {
      drug,
      status: "available" as const,
      labelsChecked: 1,
      message: "label available",
    },
    labels: [{ drug_interactions: ["No matching medication named here."] }],
  });
  const result = assessDrugLookups(
    ["drug a", "drug b"],
    new Map([
      ["drug a", lookup("drug a")],
      ["drug b", lookup("drug b")],
    ]),
  );

  if (
    result.overallStatus !== "complete" ||
    result.assessments[0]?.status !== "no_documented_interaction"
  ) {
    throw new Error(
      "Expected a documented-label negative, not an inconclusive result",
    );
  }
});
