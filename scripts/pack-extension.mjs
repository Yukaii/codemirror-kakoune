import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const extDir = resolve(rootDir, "apps/browser-extension");
const distDir = resolve(extDir, "dist");
const pkg = JSON.parse(readFileSync(resolve(extDir, "package.json"), "utf8"));

const version = pkg.version;
const zipFileName = `browser-kakoune-v${version}.zip`;
const latestZipFileName = `browser-kakoune.zip`;
const zipPath = resolve(extDir, zipFileName);
const latestZipPath = resolve(extDir, latestZipFileName);

if (!existsSync(distDir)) {
  console.error("[pack] dist/ directory not found. Please build the extension first.");
  process.exit(1);
}

if (existsSync(zipPath)) {
  rmSync(zipPath);
}
if (existsSync(latestZipPath)) {
  rmSync(latestZipPath);
}

console.log(`[pack] Packaging extension into ${zipFileName} and ${latestZipFileName}...`);
execSync(`cd "${distDir}" && zip -r -9 "${zipPath}" ./*`, { stdio: "inherit" });
execSync(`cd "${distDir}" && zip -r -9 "${latestZipPath}" ./*`, { stdio: "inherit" });

console.log(`[pack] Successfully created:
- ${zipPath}
- ${latestZipPath}`);
