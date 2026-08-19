/**
 * Test mock loader: mocks use-notifications so patient hooks run without real toasts.
 * Hook tests that need a user must set __SUPABASE_AUTH_MOCK__.getSession and wrap with AuthProvider.
 */
function isUseNotifications(url) {
  const pathname = url.replace(/^file:\/\//, "");
  return pathname.includes("hooks/use-notifications") && (pathname.endsWith(".tsx") || pathname.endsWith(".ts"));
}

function isHindsightClient(url) {
  const pathname = url.replace(/^file:\/\//, "");
  return pathname.includes("lib/hindsightClient") && (pathname.endsWith(".tsx") || pathname.endsWith(".ts"));
}

const HINDSIGHT_MOCK_SPECIFIER = "file:///hindsight-client-mock.js";
const EDGE_HEADERS_MOCK_SPECIFIER = "file:///edge-function-headers-mock.js";
const HINDSIGHT_MOCK_SOURCE = `
export async function retainMemory() {
  return { ok: true };
}
export async function recallMemories() {
  return { memories: [] };
}
`;
const EDGE_HEADERS_MOCK_SOURCE = `
export async function getEdgeFunctionAuthHeaders(extra) {
  return { Authorization: "Bearer test-token", apikey: "test-key", ...(extra || {}) };
}
`;

export async function resolve(specifier, context, defaultResolve) {
  const norm = (specifier || "").replace(/\\/g, "/");
  if (norm === "@/lib/hindsightClient" || norm.endsWith("lib/hindsightClient") || norm.includes("lib/hindsightClient")) {
    return { url: HINDSIGHT_MOCK_SPECIFIER, shortCircuit: true };
  }
  if (norm === "@/lib/edgeFunctionHeaders" || norm.endsWith("lib/edgeFunctionHeaders") || norm.includes("lib/edgeFunctionHeaders")) {
    return { url: EDGE_HEADERS_MOCK_SPECIFIER, shortCircuit: true };
  }
  return defaultResolve(specifier, context);
}

export async function load(url, context, defaultLoad) {
  const normalized = url.split("?")[0];

  if (isUseNotifications(normalized)) {
    const mockSource = `
export function useNotifications() {
  return {
    success: () => {},
    error: () => {},
    warning: () => {},
    info: () => {},
  };
}
`;
    return { format: "module", source: mockSource, shortCircuit: true };
  }

  if (normalized === HINDSIGHT_MOCK_SPECIFIER || isHindsightClient(normalized)) {
    return { format: "module", source: HINDSIGHT_MOCK_SOURCE, shortCircuit: true };
  }

  if (normalized === EDGE_HEADERS_MOCK_SPECIFIER) {
    return { format: "module", source: EDGE_HEADERS_MOCK_SOURCE, shortCircuit: true };
  }

  return defaultLoad(url, context);
}
