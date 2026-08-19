/**
 * Bundle-reachability guard for the optional Expo/React-Native dependency tree.
 *
 * Background: fhirclient → isomorphic-webcrypto declares OPTIONAL native
 * dependencies (expo, react-native, @expo/*) that carry npm audit advisories.
 * They must never be reachable from shipped browser bundles. This script fails
 * the build if any marker leaks into dist/.
 *
 * See docs/security/2026-08-11-optional-dependency-risk-acceptance.md
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const assetsDir = new URL("../dist/assets/", import.meta.url).pathname;

const FORBIDDEN_MARKERS = [
  "expo-modules-core",
  "ExpoModulesCore",
  "isomorphic-webcrypto",
  "react-native/Libraries",
  "@expo/config-plugins",
];

const offenders = [];
for (const file of readdirSync(assetsDir)) {
  if (!/\.(js|css|map)$/.test(file)) continue;
  const content = readFileSync(join(assetsDir, file), "utf8");
  for (const marker of FORBIDDEN_MARKERS) {
    if (content.includes(marker)) {
      offenders.push(`${file} contains "${marker}"`);
    }
  }
}

if (offenders.length > 0) {
  console.error("Optional native dependency tree leaked into the browser bundle:");
  for (const line of offenders) console.error(`  - ${line}`);
  process.exit(1);
}

console.log(
  `[bundle-reachability] no Expo/React-Native/isomorphic-webcrypto markers in ${assetsDir}`,
);
