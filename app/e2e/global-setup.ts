import { resetFullSuiteFixture } from "./fixture-state";

export default async function globalSetup(): Promise<void> {
  await resetFullSuiteFixture("setup");
}
