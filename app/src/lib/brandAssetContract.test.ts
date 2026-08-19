import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function readPngDimensions(path: string): { width: number; height: number } {
  const image = readFileSync(path);
  assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return {
    width: image.readUInt32BE(16),
    height: image.readUInt32BE(20),
  };
}

test("browser and installed-app icons use the Rolling Rounds asset set", () => {
  const html = readFileSync("index.html", "utf8");
  const app = readFileSync("src/App.tsx", "utf8");
  const auth = readFileSync("src/pages/Auth.tsx", "utf8");
  const landing = readFileSync("src/pages/Landing.tsx", "utf8");
  const mobileHeader = readFileSync("src/components/layout/MobileHeader.tsx", "utf8");
  const desktopDashboard = readFileSync("src/components/dashboard/DesktopDashboard.tsx", "utf8");
  const compactBrandSurfaces = `${landing}\n${mobileHeader}\n${desktopDashboard}`;
  const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8")) as {
    id: string;
    start_url: string;
    scope: string;
    display: string;
    background_color: string;
    theme_color: string;
    lang: string;
    dir: string;
    orientation: string;
    categories: string[];
    prefer_related_applications: boolean;
    icons: Array<{ src: string; sizes: string; type: string; purpose: string }>;
  };
  const serviceWorker = readFileSync("public/sw.js", "utf8");
  const themeBootstrap = readFileSync("public/theme-init.js", "utf8");

  assert.match(html, /href="\/icons\/favicon-64\.png"/);
  assert.match(html, /href="\/icons\/apple-touch-icon\.png"/);
  assert.match(app, /src="\/icons\/icon-192\.png"/);
  assert.match(auth, /src="\/icons\/icon-192\.png"/);
  assert.doesNotMatch(`${app}\n${auth}`, /rolling-rounds-logo\.png/);
  assert.match(landing, /\/icons\/favicon-64\.png/);
  assert.match(mobileHeader, /\/icons\/favicon-64\.png/);
  assert.match(desktopDashboard, /\/icons\/favicon-64\.png/);
  assert.match(desktopDashboard, /\/icons\/icon-192\.png/);
  assert.doesNotMatch(compactBrandSurfaces, /rolling-rounds-logo\.png/);
  assert.deepEqual({
    id: manifest.id,
    startUrl: manifest.start_url,
    scope: manifest.scope,
    display: manifest.display,
    backgroundColor: manifest.background_color,
    themeColor: manifest.theme_color,
    lang: manifest.lang,
    dir: manifest.dir,
    orientation: manifest.orientation,
    categories: manifest.categories,
    preferRelatedApplications: manifest.prefer_related_applications,
  }, {
    id: "/",
    startUrl: "/",
    scope: "/",
    display: "standalone",
    backgroundColor: "#f5f7f3",
    themeColor: "#00c56a",
    lang: "en",
    dir: "ltr",
    orientation: "any",
    categories: ["medical", "productivity"],
    preferRelatedApplications: false,
  });
  assert.deepEqual(manifest.icons.map(({ src, sizes, type, purpose }) => ({ src, sizes, type, purpose })), [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
  ]);
  assert.match(serviceWorker, /'\/icons\/favicon-64\.png'/);
  assert.match(serviceWorker, /'\/icons\/icon-192\.png'/);
  assert.match(serviceWorker, /'\/theme-init\.js'/);
  assert.match(html, /<meta name="theme-color" content="#f5f7f3" \/>/);
  assert.match(html, /<script src="\/theme-init\.js"><\/script>/);
  assert.ok(
    html.indexOf('name="theme-color"') < html.indexOf('src="/theme-init.js"'),
    "theme metadata must exist before the synchronous first-paint bootstrap",
  );
  assert.match(html, /<meta name="mobile-web-app-capable" content="yes" \/>/);
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes" \/>/);
  assert.match(html, /<meta name="apple-mobile-web-app-title" content="Rolling Rounds" \/>/);
  assert.match(themeBootstrap, /window\.localStorage\.getItem\('vite-ui-theme'\)/);
  assert.match(themeBootstrap, /window\.localStorage\.getItem\('vite-ui-high-contrast'\)/);
  assert.match(themeBootstrap, /'#f5f7f3'/);
  assert.match(themeBootstrap, /'#0a0b0a'/);
  assert.doesNotMatch(`${html}\n${JSON.stringify(manifest)}\n${serviceWorker}`, /\/favicon\.ico/);

  assert.deepEqual(readPngDimensions("public/icons/favicon-64.png"), { width: 64, height: 64 });
  assert.deepEqual(readPngDimensions("public/icons/apple-touch-icon.png"), { width: 180, height: 180 });
  assert.deepEqual(readPngDimensions("public/icons/icon-192.png"), { width: 192, height: 192 });
  assert.deepEqual(readPngDimensions("public/icons/icon-512.png"), { width: 512, height: 512 });

  for (const retiredAsset of [
    "public/favicon.ico",
    "public/landing-hero-poster.svg",
    "public/placeholder.svg",
    "public/video_d947dcb3-9916-4d7f-b617-a3beb20d3fdf.mp4",
  ]) {
    assert.equal(existsSync(retiredAsset), false, `${retiredAsset} must not ship`);
  }
});
