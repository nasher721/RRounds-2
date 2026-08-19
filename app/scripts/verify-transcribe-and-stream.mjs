#!/usr/bin/env node
/** One-off: live-test transcribe-audio with a generated speech clip, and
 *  ai-clinical-assistant in streaming mode. Never prints secrets. */
import { readFileSync } from "node:fs";

function loadEnvFile(path) {
  try {
    const out = {};
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}
const env = { ...loadEnvFile(".env"), ...loadEnvFile(".env.local") };
const SUPABASE_URL = env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const ANON_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;

const signin = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: env.E2E_TEST_EMAIL, password: env.E2E_TEST_PASSWORD }),
});
const { access_token: token } = await signin.json();
if (!token) { console.error("sign-in failed"); process.exit(2); }

let failures = 0;

// 1) transcribe-audio with real speech
const audioB64 = readFileSync("/tmp/rrn-audio/clip.m4a").toString("base64");
const t0 = Date.now();
const tRes = await fetch(`${SUPABASE_URL}/functions/v1/transcribe-audio`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ audio: audioB64, mimeType: "audio/m4a", enhanceMedical: false }),
});
const tBody = await tRes.text();
const tOk = tRes.ok && !tBody.includes('"error"');
if (!tOk) failures++;
console.log(`${tOk ? "PASS" : "FAIL"} transcribe-audio [HTTP ${tRes.status}, ${((Date.now() - t0) / 1000).toFixed(1)}s] ${tBody.slice(0, 160)}`);

// 2) ai-clinical-assistant streaming
const s0 = Date.now();
const sRes = await fetch(`${SUPABASE_URL}/functions/v1/ai-clinical-assistant`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ feature: "smart_expand", text: "pt intubated on AC/VC", stream: true }),
});
let streamed = "";
const reader = sRes.body?.getReader();
if (reader) {
  const dec = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    streamed += dec.decode(value, { stream: true });
  }
}
const sOk = sRes.ok && streamed.length > 20;
if (!sOk) failures++;
console.log(`${sOk ? "PASS" : "FAIL"} ai-clinical-assistant (stream) [HTTP ${sRes.status}, ${((Date.now() - s0) / 1000).toFixed(1)}s] ${streamed.replace(/\s+/g, " ").slice(0, 120)}`);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
