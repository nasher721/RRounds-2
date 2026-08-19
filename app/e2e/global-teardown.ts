import { resetFullSuiteFixture } from "./fixture-state";

export default async function globalTeardown(): Promise<void> {
  await resetFullSuiteFixture("teardown");
}
