import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const pkgPath = resolve(rootDir, "apps/browser-extension/package.json");
const manifestPath = resolve(rootDir, "apps/browser-extension/manifest.json");

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

manifest.version = pkg.version;

const manifestContent = JSON.stringify(manifest, null, 2) + "\n";
writeFileSync(manifestPath, manifestContent);

console.log(`Synced browser-extension manifest.json to ${pkg.version}`);
