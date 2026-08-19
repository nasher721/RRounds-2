import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";

const distDir = new URL("../dist/", import.meta.url);
const html = readFileSync(new URL("index.html", distDir), "utf8");
const entryMatch = html.match(/<script[^>]+src="\/assets\/([^"]+\.js)"/);

const canonicalMatch = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/);
const openGraphUrlMatch = html.match(/<meta[^>]+property="og:url"[^>]+content="([^"]+)"/);
const openGraphImageMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/);
if (
  !canonicalMatch
  || !openGraphUrlMatch
  || !openGraphImageMatch
  || !canonicalMatch[1].startsWith("https://")
  || openGraphUrlMatch[1] !== canonicalMatch[1]
  || !openGraphImageMatch[1].startsWith(canonicalMatch[1])
) {
  throw new Error("Production metadata must use one absolute HTTPS canonical origin");
}

if (!entryMatch) {
  throw new Error("Bundle budget check could not find the production entry script");
}

const assetsDir = join(distDir.pathname, "assets");
const assetFiles = readdirSync(assetsDir);
const initialJavaScript = [
  ...html.matchAll(/(?:src|href)="\/assets\/([^"]+\.js)"/g),
].map((match) => match[1]);

const budgets = [
  // Keep the public shell lean. Auth and callback recovery remain eager, while
  // the authenticated workspace and interaction-only tools load on demand.
  { label: "application entry", file: entryMatch[1], maxBytes: 300_000 },
];

const initialJavaScriptBytes = initialJavaScript.reduce(
  (total, file) => total + statSync(join(assetsDir, file)).size,
  0,
);
// This lower ceiling makes a future eager import of the workspace graph fail CI.
const maxInitialJavaScriptBytes = 750_000;
if (initialJavaScriptBytes > maxInitialJavaScriptBytes) {
  throw new Error(
    `initial JavaScript is ${initialJavaScriptBytes.toLocaleString()} bytes; budget is ${maxInitialJavaScriptBytes.toLocaleString()} bytes`,
  );
}
console.log(
  `[bundle-budget] initial JavaScript: ${initialJavaScriptBytes.toLocaleString()} / ${maxInitialJavaScriptBytes.toLocaleString()} bytes`,
);

const chunkBudgets = [
  // Heavy interaction-gated vendors; keep them lazy and bounded.
  { label: "export vendor", pattern: /^vendor-export-.*\.js$/, maxBytes: 2_000_000 },
  { label: "charts vendor", pattern: /^vendor-charts-.*\.js$/, maxBytes: 450_000 },
  { label: "React runtime", pattern: /^vendor-react-.*\.js$/, maxBytes: 160_000 },
  { label: "Supabase runtime", pattern: /^vendor-supabase-.*\.js$/, maxBytes: 230_000 },
  { label: "authenticated workspace shared chunk", pattern: /^ThemeToggle-.*\.js$/, maxBytes: 400_000 },
  { label: "spreadsheet import parser", pattern: /^xlsx-.*\.js$/, maxBytes: 550_000 },
  { label: "Word import parser", pattern: /^lib-.*\.js$/, maxBytes: 550_000 },
  // AI assistant surfaces must stay route/interaction-lazy and small.
  { label: "AI chatbot chunk", pattern: /^UnifiedAIChatbot-.*\.js$/, maxBytes: 60_000 },
  { label: "AI streaming chunk", pattern: /^useStreamingAI-.*\.js$/, maxBytes: 20_000 },
  // The print UI must stay light; format engines load only after the matching
  // export action. Separate ceilings prevent an eager re-import from hiding in
  // a still-passing aggregate budget.
  { label: "print export modal chunk", pattern: /^PrintExportModal-.*\.js$/, maxBytes: 300_000 },
  { label: "vector PDF engine", pattern: /^jspdf\.es\.min-.*\.js$/, maxBytes: 450_000 },
  { label: "PDF table engine", pattern: /^jspdf\.plugin\.autotable-.*\.js$/, maxBytes: 50_000 },
  { label: "HTML PDF fallback", pattern: /^html2pdf-.*\.js$/, maxBytes: 800_000 },
  { label: "HTML canvas fallback", pattern: /^html2canvas-.*\.js$/, maxBytes: 250_000 },
];

for (const chunk of chunkBudgets) {
  const file = assetFiles.find((name) => chunk.pattern.test(name));
  if (file) {
    budgets.push({ label: chunk.label, file, maxBytes: chunk.maxBytes });
  }
}

for (const budget of budgets) {
  const bytes = statSync(join(assetsDir, budget.file)).size;
  if (bytes > budget.maxBytes) {
    throw new Error(
      `${budget.label} ${basename(budget.file)} is ${bytes.toLocaleString()} bytes; budget is ${budget.maxBytes.toLocaleString()} bytes`,
    );
  }
  console.log(`[bundle-budget] ${budget.label}: ${bytes.toLocaleString()} / ${budget.maxBytes.toLocaleString()} bytes`);
}
