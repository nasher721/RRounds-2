import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";

/** Fail release-grade E2E runs when any discovered scenario is skipped. */
export default class NoSkippedReporter implements Reporter {
  private readonly skippedTests: string[] = [];

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status === "skipped") {
      this.skippedTests.push(test.titlePath().join(" > "));
    }
  }

  onEnd(result: FullResult): { status?: FullResult["status"] } | undefined {
    if (process.env.E2E_REQUIRE_FULL_SUITE !== "1" || this.skippedTests.length === 0) {
      return undefined;
    }

    console.error(
      `Release E2E requires zero skipped scenarios; skipped ${this.skippedTests.length}:`,
    );
    for (const title of this.skippedTests) {
      console.error(`- ${title}`);
    }
    return { status: "failed" };
  }
}
