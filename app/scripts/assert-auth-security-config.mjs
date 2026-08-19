import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const workflowPath = path.resolve(".github/workflows/deploy-supabase.yml");
const workflow = await readFile(workflowPath, "utf8");
const compactWorkflow = workflow.replace(/\s+/g, " ");

assert.match(
  compactWorkflow,
  /--request PATCH .*\/config\/auth/i,
  "The Supabase deploy must update the hosted Auth configuration",
);
assert.match(
  compactWorkflow,
  /sessions_inactivity_timeout:\$inactivity/i,
  "Production deployment must disable public signup, enable leaked-password protection, and set an inactivity timeout",
);
assert.match(
  compactWorkflow,
  /\.disable_signup == true and \.password_hibp_enabled == true and \.sessions_inactivity_timeout == \$inactivity/i,
  "Deployment must verify the hosted Auth API returned every required control",
);
assert.match(
  compactWorkflow,
  /PRODUCTION_SESSION_IDLE_TIMEOUT_SECONDS must be between 300 and 3600/i,
  "Deployment must reject disabled or unbounded inactivity settings",
);
assert.match(
  compactWorkflow,
  /exit 1/i,
  "Auth configuration verification must fail closed",
);

console.log(
  "Hosted Auth security config OK: restricted signup, leaked-password protection, and bounded inactivity termination are enforced and verified.",
);
