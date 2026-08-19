import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const fromRoot = (...segments: string[]) => path.join(process.cwd(), ...segments);

const readSource = (file: string) => readFileSync(fromRoot(file), "utf8");

test("desktop sidebar roster fills workspace height without a 42vh clamp", () => {
  const source = readSource("src/components/dashboard/VirtualizedPatientList.tsx");
  const patientListAsideMatch = source.match(
    /<aside\s+className="([^"]+)"\s+aria-label="Patient list"/,
  );

  assert.ok(patientListAsideMatch, "Expected the desktop patient list aside to exist");

  const patientListAsideClasses = patientListAsideMatch[1].trim().split(/\s+/);
  const desktopMaxHeightClasses = patientListAsideClasses.filter((className) =>
    className.startsWith("lg:max-h-"),
  );

  assert.deepEqual(
    ["lg:h-full", "lg:min-h-0", "lg:max-h-none"].map((className) =>
      patientListAsideClasses.includes(className),
    ),
    [true, true, true],
  );
  assert.deepEqual(desktopMaxHeightClasses, ["lg:max-h-none"]);
  assert.match(
    source,
    /<ScrollArea className="flex-1 min-h-0" id="desktop-patient-list-content">/,
  );
  assert.doesNotMatch(source, /max-h-\[42vh\]/);
});
