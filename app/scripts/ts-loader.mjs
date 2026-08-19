import { access, readFile, stat } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { transform } from "esbuild";

const tsExtensions = new Set([".ts", ".tsx"]);

const tryResolveWithExtensions = async (basePath) => {
  const candidates = [
    `${basePath}.ts`,
    `${basePath}.tsx`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
  ];
  try {
    const st = await stat(basePath);
    if (st.isFile()) {
      candidates.unshift(basePath);
    }
  } catch {
    /* path missing */
  }

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
};

export async function resolve(specifier, context, defaultResolve) {
  if (specifier.startsWith("@/")) {
    const projectRoot = path.dirname(fileURLToPath(import.meta.url));
    const basePath = path.join(projectRoot, "..", "src", specifier.replace("@/", ""));
    const resolvedPath = await tryResolveWithExtensions(basePath);
    const finalPath = resolvedPath ?? basePath;
    return defaultResolve(pathToFileURL(finalPath).href, context);
  }

  // Node ESM does not resolve extensionless relative imports; TS sources use ./Foo not ./Foo.ts
  if (
    context.parentURL &&
    (specifier.startsWith("./") || specifier.startsWith("../"))
  ) {
    const parentPath = fileURLToPath(context.parentURL);
    const parentDir = path.dirname(parentPath);
    const basePath = path.resolve(parentDir, specifier);
    const resolvedPath = await tryResolveWithExtensions(basePath);
    if (resolvedPath) {
      return defaultResolve(pathToFileURL(resolvedPath).href, context);
    }
  }

  return defaultResolve(specifier, context);
}

export async function load(url, context, defaultLoad) {
  const parsedUrl = new URL(url);
  const ext = path.extname(parsedUrl.pathname);

  if (!tsExtensions.has(ext)) {
    return defaultLoad(url, context, defaultLoad);
  }

  const source = await readFile(parsedUrl, "utf8");
  const { code, map } = await transform(source, {
    loader: ext === ".tsx" ? "tsx" : "ts",
    format: "esm",
    jsx: "automatic",
    sourcemap: "inline",
    target: "node18",
    sourcefile: parsedUrl.pathname,
  });

  return {
    format: "module",
    source: code,
    shortCircuit: true,
  };
}
