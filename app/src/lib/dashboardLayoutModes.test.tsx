import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { toLayoutMode, toPrefsMode, type SystemsLayoutMode } from "./dashboardLayoutModes"

// Mock the DashboardPrefs type for testing
type MockDashboardPrefs = {
  systemsReviewMode: "split" | "combine_all" | "combine_custom"
  // other fields not needed for these tests
}

describe("dashboardLayoutModes", () => {
  describe("toLayoutMode", () => {
    it("converts split -> split", () => {
      assert.equal(toLayoutMode("split"), "split")
    })
    it("converts combine_all -> combine_all", () => {
      assert.equal(toLayoutMode("combine_all"), "combine_all")
    })
    it("converts combine_custom -> custom", () => {
      assert.equal(toLayoutMode("combine_custom"), "custom")
    })
  })

  describe("toPrefsMode", () => {
    it("converts split -> split", () => {
      assert.equal(toPrefsMode("split"), "split")
    })
    it("converts combine_all -> combine_all", () => {
      assert.equal(toPrefsMode("combine_all"), "combine_all")
    })
    it("converts custom -> combine_custom", () => {
      assert.equal(toPrefsMode("custom"), "combine_custom")
    })
  })
})