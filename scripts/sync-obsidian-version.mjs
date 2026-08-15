import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const pkgPath = resolve(rootDir, "packages/obsidian-kakoune/package.json");
const manifestPath = resolve(rootDir, "packages/obsidian-kakoune/manifest.json");
const versionsPath = resolve(rootDir, "packages/obsidian-kakoune/versions.json");

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const versions = JSON.parse(readFileSync(versionsPath, "utf8"));

manifest.version = pkg.version;
versions[pkg.version] = manifest.minAppVersion;

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
writeFileSync(versionsPath, JSON.stringify(versions, null, 2) + "\n");
console.log(`Synced obsidian manifest.json and versions.json to ${pkg.version}`);
