/**
 * Lockfile reproducibility guard.
 *
 * Background: on 2026-08-17 `npm ci` began failing outright (EUSAGE, 26
 * out-of-sync entries) without any repo change. Root cause was
 * fhirclient -> isomorphic-webcrypto, whose optionalDependencies use floating
 * "*" ranges; `expo-random` peer-depends on `expo: *`, so an upstream Expo SDK
 * publish silently invalidated the committed tree. That break landed AFTER the
 * 2026-08-13 sign-off packet, invalidating its install-dependent evidence
 * without anything in CI noticing.
 *
 * This guard makes that failure mode loud instead of silent. Two assertions:
 *   1. `npm ci --dry-run` resolves cleanly against the committed lockfile.
 *   2. The Expo/React-Native subtree has not crept back into the lockfile.
 *
 * See docs/release/2026-08-11-release-hold-phase0.md (Update 2026-08-19) and
 * docs/security/2026-08-11-optional-dependency-risk-acceptance.md
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const lockPath = fileURLToPath(new URL("../package-lock.json", import.meta.url));

let failed = false;
const fail = (message) => {
  console.error(`[lockfile-reproducible] FAIL: ${message}`);
  failed = true;
};

// 1. The lockfile must satisfy package.json without mutation.
try {
  execFileSync("npm", ["ci", "--dry-run", "--ignore-scripts"], {
    cwd: repoRoot,
    stdio: "pipe",
    encoding: "utf8",
  });
  console.log("[lockfile-reproducible] npm ci --dry-run resolved cleanly");
} catch (error) {
  const detail = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim();
  fail(
    "`npm ci` cannot resolve the committed lockfile. This usually means an "
    + "upstream publish changed a floating dependency range. Regenerate the "
    + "lockfile under the pinned toolchain (Node 22 / npm 10.9.8) and review "
    + "what moved before committing.\n"
    + detail.split("\n").slice(0, 20).join("\n"),
  );
}

// 2. The Expo / React-Native optional subtree must stay out of the lockfile.
const lock = JSON.parse(readFileSync(lockPath, "utf8"));
const packages = lock.packages ?? {};
const FORBIDDEN_PREFIXES = [
  "expo",
  "@expo/",
  "@unimodules/",
  "react-native",
  "metro",
  "@react-native/",
  "hermes-",
];

const offenders = Object.keys(packages)
  .map((key) => key.replace(/^.*node_modules\//, ""))
  .filter((name) => name.length > 0)
  .filter((name) => FORBIDDEN_PREFIXES.some((prefix) => (
    prefix.endsWith("/") || prefix.endsWith("-")
      ? name.startsWith(prefix)
      : name === prefix || name.startsWith(`${prefix}-`)
  )));

const uniqueOffenders = [...new Set(offenders)].sort();
if (uniqueOffenders.length > 0) {
  fail(
    `Expo/React-Native packages reappeared in the lockfile (${uniqueOffenders.length}). `
    + "They are pulled in transitively via fhirclient -> isomorphic-webcrypto "
    + "optionalDependencies and must stay pinned out via the `overrides` block "
    + `in package.json:\n  ${uniqueOffenders.slice(0, 25).join("\n  ")}`,
  );
} else {
  console.log("[lockfile-reproducible] no Expo/React-Native packages in lockfile");
}

if (failed) {
  process.exit(1);
}
console.log("Lockfile reproducibility check passed.");
