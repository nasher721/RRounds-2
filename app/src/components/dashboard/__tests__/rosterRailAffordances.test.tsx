import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function readSource(relativePath: string) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

const railSource = readSource("src/components/dashboard/PatientRosterRail.tsx");
const workspaceSource = readSource("src/components/dashboard/PatientWorkspace.tsx");
const cssSource = readSource("src/index.css");

describe("shared workspace keyboard navigation", () => {
  it("routes both the rail and the documentation tabs through one traversal module", () => {
    // Divergent wrap/clamp rules between the two navigators would be a subtle
    // inconsistency for anyone driving the chart from the keyboard.
    assert.match(
      readSource("src/lib/rosterNavigation.ts"),
      /from "@\/lib\/listKeyboardNavigation"/,
    );
    assert.match(workspaceSource, /from "@\/lib\/listKeyboardNavigation"/);
  });

  it("gives each navigator the orientation its layout implies", () => {
    assert.match(readSource("src/lib/rosterNavigation.ts"), /orientation: "vertical"/);
    assert.match(workspaceSource, /orientation: "horizontal"/);
  });
});

describe("desktop roster rail keyboard navigation", () => {
  it("routes roster key presses through the shared navigation resolver", () => {
    assert.match(railSource, /resolveRosterNavigationIndex/);
    assert.match(railSource, /onKeyDown=\{handleRosterKeyDown\}/);
  });

  it("ignores modified key presses so app shortcuts keep working", () => {
    assert.match(
      railSource,
      /if \(event\.altKey \|\| event\.ctrlKey \|\| event\.metaKey \|\| event\.shiftKey\) return;/,
    );
  });

  it("keeps selection following focus so the open chart matches the highlighted row", () => {
    assert.match(railSource, /setDesktopSelectedPatientId\(nextPatient\.id\);/);
    assert.match(railSource, /rowRefs\.current\.get\(nextPatient\.id\)\?\.focus\(\);/);
  });

  it("uses a roving tabindex so Tab does not walk every patient row", () => {
    assert.match(railSource, /tabIndex=\{isActive \? 0 : -1\}/);
  });

  it("documents the navigation keys for assistive technology", () => {
    assert.match(railSource, /aria-describedby="roster-keyboard-hint"/);
    assert.match(railSource, /id="roster-keyboard-hint" className="sr-only"/);
  });

  it("scrolls the selected row into view when selection changes elsewhere", () => {
    assert.match(railSource, /scrollIntoView\(\{ block: "nearest" \}\)/);
    // jsdom and older engines have no scrollIntoView; the rail must not throw.
    assert.match(railSource, /typeof node\?\.scrollIntoView !== "function"/);
  });
});

describe("desktop roster rail search and empty state", () => {
  it("offers an inline clear control for an active search", () => {
    assert.match(railSource, /data-testid="clear-roster-search"/);
    assert.match(railSource, /aria-label="Clear search"/);
  });

  it("clears the search on Escape without swallowing Escape when empty", () => {
    assert.match(railSource, /if \(event\.key !== "Escape" \|\| !searchQuery\) return;/);
  });

  it("offers a recovery action when filters hide the entire roster", () => {
    assert.match(railSource, /data-testid="roster-empty-clear-filters"/);
    assert.match(railSource, /onClick=\{clearFilters\}/);
  });

  it("never renders two identical clear-filter controls at once", () => {
    // The meta-row link stands down while the empty-state button is showing.
    assert.match(railSource, /activeFilterCount > 0 && filteredPatients\.length > 0 \?/);
  });
});

describe("desktop roster rail row status", () => {
  it("reports documentation readiness in the row's accessible name", () => {
    assert.match(railSource, /\$\{readySectionCount\} of \$\{sectionStatuses\.length\} sections ready/);
  });

  it("keeps the e2e-facing 'Select <name>,' accessible-name prefix", () => {
    assert.match(railSource, /aria-label=\{`Select \$\{patient\.name \|\| "unnamed patient"\},/);
  });
});

describe("desktop roster rail selected-row styling", () => {
  it("marks the open chart with an accent fill and leading accent bar", () => {
    assert.match(cssSource, /\.rr-roster-item\.rr-sel,\s*\n\s*\.rr-roster-item\.rr-sel:hover \{ background: var\(--rr-light-blue-bg\); \}/);
    assert.match(cssSource, /\.rr-roster-item\.rr-sel::before \{/);
  });

  it("falls back to system colors under forced-colors mode", () => {
    const forcedColorsBlocks = cssSource.match(/@media \(forced-colors: active\) \{[\s\S]*?\n\}/g) ?? [];
    assert.ok(
      forcedColorsBlocks.some((block) => block.includes(".rr-roster-item.rr-sel")),
      "expected a forced-colors fallback for the selected roster row",
    );
  });
});
